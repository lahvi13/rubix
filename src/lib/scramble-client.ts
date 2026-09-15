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

interface Cubing {
  scramble: typeof import('cubing/scramble');
  search: typeof import('cubing/search');
}

let cubingPromise: Promise<Cubing> | null = null;

function loadCubing(): Promise<Cubing> {
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
      return { scramble, search };
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
  return enqueue(async () => {
    const { scramble } = await loadCubing();
    const alg = await scramble.randomScrambleForEvent(eventId);
    return alg.toString();
  });
}

/**
 * A scramble that reaches the state `target` leaves a solved cube in, found by
 * cubing's 3×3 solver and handed back inverted. Only face turns come out, so
 * the target must leave the centres where they started (see drillScramble).
 */
export function requestCaseScramble(target: string): Promise<string> {
  return enqueue(async () => {
    const [{ search }, { cube3x3x3 }] = await Promise.all([
      loadCubing(),
      import('cubing/puzzles'),
    ]);
    const kpuzzle = await cube3x3x3.kpuzzle();
    const pattern = kpuzzle.defaultPattern().applyAlg(target);
    const solution = await search.experimentalSolve3x3x3IgnoringCenters(pattern);
    return solution.invert().toString();
  });
}

function enqueue(work: () => Promise<string>): Promise<string> {
  const result = queue.then(() => withTimeout(work));
  queue = result.catch(() => {});
  return result;
}

async function withTimeout(work: () => Promise<string>): Promise<string> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`scramble generation did not finish in ${GENERATION_TIMEOUT_MS}ms`));
    }, GENERATION_TIMEOUT_MS);
  });

  try {
    return await Promise.race([timeout, work()]);
  } finally {
    clearTimeout(timer);
  }
}

/** Test seam: forget the cached module and any queued work between cases. */
export function resetScrambleClient(): void {
  cubingPromise = null;
  queue = Promise.resolve();
}
