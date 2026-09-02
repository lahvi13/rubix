/// <reference lib="webworker" />
import { randomScrambleForEvent } from 'cubing/scramble';
import { setSearchDebug } from 'cubing/search';

// cubing's default worker-instantiation order starts with unbundled URLs that
// do not exist in a Vite build; each failed attempt costs a doomed network
// round trip. The esbuild workaround is the strategy Vite rewrites correctly,
// so it goes first.
setSearchDebug({ prioritizeEsbuildWorkaroundForWorkerInstantiation: true });

/**
 * Random-state scrambles are expensive enough to drop frames on the first
 * call, so generation never happens on the main thread.
 */

export interface ScrambleRequest {
  id: number;
  eventId: string;
}

export type ScrambleResponse =
  | { id: number; scramble: string }
  | { id: number; error: string };

const worker = self as unknown as DedicatedWorkerGlobalScope;

worker.addEventListener('message', (event: MessageEvent<ScrambleRequest>) => {
  const { id, eventId } = event.data;
  randomScrambleForEvent(eventId)
    .then((alg) => {
      worker.postMessage({ id, scramble: alg.toString() } satisfies ScrambleResponse);
    })
    .catch((error: unknown) => {
      worker.postMessage({
        id,
        error: error instanceof Error ? error.message : String(error),
      } satisfies ScrambleResponse);
    });
});
