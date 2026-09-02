/**
 * Scramble generation via cubing.js, which does the actual solving inside its
 * OWN worker — the main thread only holds a comlink proxy. The app used to
 * wrap this in a second worker of its own; that bought nothing (the work was
 * already off-thread) and cost a whole extra process holding a duplicate copy
 * of the cubing module graph — real memory on a phone.
 *
 * Two guarantees the UI relies on:
 * - a request either resolves or rejects; the timeout turns a wedged worker
 *   into a visible "tap to retry" instead of an eternal spinner
 * - requests run one at a time, so a prefetch can never stack a second
 *   solver run on top of the first
 */

const GENERATION_TIMEOUT_MS = 20_000;

type CubingScramble = typeof import('cubing/scramble');

let cubingPromise: Promise<CubingScramble> | null = null;

function loadCubing(): Promise<CubingScramble> {
  if (!cubingPromise) {
    cubingPromise = (async () => {
      const [scramble, search] = await Promise.all([
        import('cubing/scramble'),
        import('cubing/search'),
      ]);
      // cubing's default worker-instantiation order starts with unbundled
      // URLs that do not exist in a Vite build; each failed attempt costs a
      // doomed network round trip. The esbuild workaround is the strategy
      // Vite rewrites correctly, so it goes first.
      search.setSearchDebug({ prioritizeEsbuildWorkaroundForWorkerInstantiation: true });
      return scramble;
    })();
    // A failed load (offline first visit, wedged service worker) must not
    // poison every later attempt.
    cubingPromise.catch(() => {
      cubingPromise = null;
    });
  }
  return cubingPromise;
}

let queue: Promise<unknown> = Promise.resolve();

export function requestScramble(eventId = '333'): Promise<string> {
  const result = queue.then(() => generateOnce(eventId));
  queue = result.catch(() => {});
  return result;
}

async function generateOnce(eventId: string): Promise<string> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`scramble generation did not finish in ${GENERATION_TIMEOUT_MS}ms`));
    }, GENERATION_TIMEOUT_MS);
  });

  const generate = async (): Promise<string> => {
    const { randomScrambleForEvent } = await loadCubing();
    const alg = await randomScrambleForEvent(eventId);
    return alg.toString();
  };

  try {
    return await Promise.race([timeout, generate()]);
  } finally {
    clearTimeout(timer);
  }
}

/** Test seam: forget the cached module and any queued work between cases. */
export function resetScrambleClient(): void {
  cubingPromise = null;
  queue = Promise.resolve();
}
