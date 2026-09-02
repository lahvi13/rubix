import type { ScrambleResponse } from '../workers/scramble.worker';

/**
 * Scrambles are generated in a worker so the main thread never janks. The
 * worker is not trusted to be there, though: a module worker that fails to
 * load fires an error nobody awaits, and the app would sit on "Generating
 * scramble…" forever. So the first failure — or a worker that simply never
 * answers — latches a main thread fallback for the rest of the session.
 *
 * cubing.js does its own work off-thread internally, so the fallback costs a
 * short pause on the first call, not a frozen timer.
 */

// Generous on purpose: a phone cold-starting the wasm solver can legitimately
// need over ten seconds, and a premature fallback is expensive — it means
// loading a second copy of cubing on the main thread.
const WORKER_TIMEOUT_MS = 15_000;

interface Pending {
  resolve: (scramble: string) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

let worker: Worker | null = null;
let workerUsable = true;
let nextRequestId = 0;
const pending = new Map<number, Pending>();

function failAllPending(reason: string): void {
  for (const [id, request] of pending) {
    clearTimeout(request.timer);
    pending.delete(id);
    request.reject(new Error(reason));
  }
}

function getWorker(): Worker {
  if (worker) return worker;

  worker = new Worker(new URL('../workers/scramble.worker.ts', import.meta.url), {
    type: 'module',
  });

  worker.addEventListener('message', (event: MessageEvent<ScrambleResponse>) => {
    const response = event.data;
    const request = pending.get(response.id);
    if (!request) return;

    clearTimeout(request.timer);
    pending.delete(response.id);
    if ('error' in response) request.reject(new Error(response.error));
    else request.resolve(response.scramble);
  });

  // Without these the promise would hang instead of failing over.
  worker.addEventListener('error', (event) => {
    failAllPending(event.message || 'scramble worker failed to load');
  });
  worker.addEventListener('messageerror', () => {
    failAllPending('scramble worker sent an unreadable message');
  });

  return worker;
}

function fromWorker(eventId: string): Promise<string> {
  const id = nextRequestId++;

  return new Promise<string>((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`scramble worker did not answer in ${WORKER_TIMEOUT_MS}ms`));
    }, WORKER_TIMEOUT_MS);

    pending.set(id, { resolve, reject, timer });
    getWorker().postMessage({ id, eventId });
  });
}

/**
 * cubing.js spawns an internal worker of its own even on the "main thread"
 * path, and when that one hangs as well (a stale service worker feeding the
 * page mismatched chunks does exactly this), awaiting it would keep the UI on
 * "Generating scramble…" forever. The timeout turns that into a visible
 * failure with a retry instead.
 */
const MAIN_THREAD_TIMEOUT_MS = 20_000;

/**
 * The fallback path shares the UI thread with the running timer, and the hook
 * prefetches — so without this queue two wasm searches could grind away at
 * once, which is enough to get the page killed on a low-end phone. One at a
 * time, in order.
 */
let mainThreadQueue: Promise<unknown> = Promise.resolve();

function fromMainThread(eventId: string): Promise<string> {
  const result = mainThreadQueue.then(() => generateOnMainThread(eventId));
  mainThreadQueue = result.catch(() => {});
  return result;
}

async function generateOnMainThread(eventId: string): Promise<string> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`scramble generation did not finish in ${MAIN_THREAD_TIMEOUT_MS}ms`));
    }, MAIN_THREAD_TIMEOUT_MS);
  });

  const generate = async (): Promise<string> => {
    const [{ randomScrambleForEvent }, { setSearchDebug }] = await Promise.all([
      import('cubing/scramble'),
      import('cubing/search'),
    ]);
    // Same reasoning as in the worker: skip instantiation strategies that
    // request unbundled URLs which do not exist in a Vite build.
    setSearchDebug({ prioritizeEsbuildWorkaroundForWorkerInstantiation: true });
    const alg = await randomScrambleForEvent(eventId);
    return alg.toString();
  };

  try {
    return await Promise.race([timeout, generate()]);
  } finally {
    clearTimeout(timer);
  }
}

export function requestScramble(eventId = '333'): Promise<string> {
  if (!workerUsable) return fromMainThread(eventId);

  return fromWorker(eventId).catch((cause: unknown) => {
    workerUsable = false;
    // Terminate, don't just drop: a wedged worker keeps its whole copy of the
    // wasm solver alive, and on a phone that plus the main thread fallback is
    // enough memory pressure to get the entire page killed.
    worker?.terminate();
    worker = null;
    console.warn('Scramble worker unavailable, falling back to the main thread.', cause);
    return fromMainThread(eventId);
  });
}

/** Test seam: forget the latched fallback between cases. */
export function resetScrambleClient(): void {
  failAllPending('reset');
  worker?.terminate();
  worker = null;
  workerUsable = true;
  mainThreadQueue = Promise.resolve();
}
