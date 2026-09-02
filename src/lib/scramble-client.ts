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

const WORKER_TIMEOUT_MS = 8000;

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

async function fromMainThread(eventId: string): Promise<string> {
  const { randomScrambleForEvent } = await import('cubing/scramble');
  const alg = await randomScrambleForEvent(eventId);
  return alg.toString();
}

export function requestScramble(eventId = '333'): Promise<string> {
  if (!workerUsable) return fromMainThread(eventId);

  return fromWorker(eventId).catch((cause: unknown) => {
    workerUsable = false;
    worker = null;
    console.warn('Scramble worker unavailable, falling back to the main thread.', cause);
    return fromMainThread(eventId);
  });
}

/** Test seam: forget the latched fallback between cases. */
export function resetScrambleClient(): void {
  failAllPending('reset');
  worker = null;
  workerUsable = true;
}
