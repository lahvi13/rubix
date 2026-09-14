/**
 * Looking for a new build on request, as against the hourly look the update
 * prompt takes on its own. After a deploy that hour is the wait between
 * pushing a fix and seeing it on the phone.
 *
 * The prompt owns the service worker registration and the banner, and hands
 * both over here once it has them; this module only asks the browser to look.
 */

export type UpdateCheck =
  /** Nothing newer on the server. */
  | 'current'
  /** A new build is installed and waiting; the banner offers the reload. */
  | 'ready'
  /** The server could not be reached. */
  | 'offline'
  /** No service worker: a dev build, or a browser that keeps nothing offline. */
  | 'unavailable';

/** The part of a service worker registration a check reads. */
export interface UpdateRegistration {
  update(): Promise<unknown>;
  readonly installing: UpdateWorker | null;
  readonly waiting: UpdateWorker | null;
}

interface UpdateWorker extends EventTarget {
  readonly state: ServiceWorkerState;
}

let registration: UpdateRegistration | null = null;
let offerReload: (() => void) | null = null;

export function connectUpdates(found: UpdateRegistration, offer: () => void): void {
  registration = found;
  offerReload = offer;
}

/** Forgets the registration; only tests have a reason to. */
export function disconnectUpdates(): void {
  registration = null;
  offerReload = null;
}

export async function checkForUpdate(): Promise<UpdateCheck> {
  const current = registration;
  if (current === null) return 'unavailable';

  try {
    await current.update();
  } catch {
    return 'offline';
  }

  const installing = current.installing;
  if (installing !== null) await settled(installing);
  if (current.waiting === null) return 'current';

  // The banner shows by itself for a build that has just installed, but not
  // for one that was already waiting and got a "Later".
  offerReload?.();
  return 'ready';
}

/** Resolves once the worker is past installing, whether it made it or not. */
function settled(worker: UpdateWorker): Promise<void> {
  return new Promise((resolve) => {
    const onChange = () => {
      if (worker.state === 'installing') return;
      worker.removeEventListener('statechange', onChange);
      resolve();
    };
    worker.addEventListener('statechange', onChange);
    onChange();
  });
}
