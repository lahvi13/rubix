import type { ScrambleResponse } from '../workers/scramble.worker';

/**
 * Thin promise wrapper around the scramble worker. One worker for the whole
 * app, kept alive between requests — spinning it up costs more than it saves.
 */

let worker: Worker | null = null;
let nextRequestId = 0;

interface Pending {
  resolve: (scramble: string) => void;
  reject: (error: Error) => void;
}

const pending = new Map<number, Pending>();

function getWorker(): Worker {
  if (worker) return worker;

  worker = new Worker(new URL('../workers/scramble.worker.ts', import.meta.url), {
    type: 'module',
  });

  worker.addEventListener('message', (event: MessageEvent<ScrambleResponse>) => {
    const response = event.data;
    const request = pending.get(response.id);
    if (!request) return;
    pending.delete(response.id);

    if ('error' in response) request.reject(new Error(response.error));
    else request.resolve(response.scramble);
  });

  return worker;
}

export function requestScramble(eventId = '333'): Promise<string> {
  const id = nextRequestId++;
  return new Promise<string>((resolve, reject) => {
    pending.set(id, { resolve, reject });
    getWorker().postMessage({ id, eventId });
  });
}
