import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  checkForUpdate,
  connectUpdates,
  disconnectUpdates,
  type UpdateRegistration,
} from './app-update';

/** Enough of a worker to change state; jsdom has no service workers at all. */
class FakeWorker extends EventTarget {
  state: ServiceWorkerState = 'installing';

  finish(state: ServiceWorkerState) {
    this.state = state;
    this.dispatchEvent(new Event('statechange'));
  }
}

interface FakeRegistration extends UpdateRegistration {
  installing: FakeWorker | null;
  waiting: FakeWorker | null;
}

function connect(registration: FakeRegistration): () => void {
  const offer = vi.fn();
  connectUpdates(registration, offer);
  return offer;
}

describe('checkForUpdate', () => {
  afterEach(disconnectUpdates);

  it('has nothing to check without a service worker', async () => {
    expect(await checkForUpdate()).toBe('unavailable');
  });

  it('says so when the server cannot be reached', async () => {
    connect({ update: () => Promise.reject(new TypeError('offline')), installing: null, waiting: null });

    expect(await checkForUpdate()).toBe('offline');
  });

  it('finds nothing newer and offers no reload', async () => {
    const offer = connect({ update: () => Promise.resolve(), installing: null, waiting: null });

    expect(await checkForUpdate()).toBe('current');
    expect(offer).not.toHaveBeenCalled();
  });

  it('waits for a new build to install before offering the reload', async () => {
    const worker = new FakeWorker();
    const registration: FakeRegistration = { update: () => Promise.resolve(), installing: worker, waiting: null };
    const offer = connect(registration);

    const check = checkForUpdate();
    await Promise.resolve();
    registration.installing = null;
    registration.waiting = worker;
    worker.finish('installed');

    expect(await check).toBe('ready');
    expect(offer).toHaveBeenCalledOnce();
  });

  // A "Later" on the banner leaves the build waiting, and the banner does not
  // come back by itself.
  it('offers the reload again for a build that was already waiting', async () => {
    const offer = connect({ update: () => Promise.resolve(), installing: null, waiting: new FakeWorker() });

    expect(await checkForUpdate()).toBe('ready');
    expect(offer).toHaveBeenCalledOnce();
  });

  it('reports current when the new build fails to install', async () => {
    const worker = new FakeWorker();
    const registration: FakeRegistration = { update: () => Promise.resolve(), installing: worker, waiting: null };
    connect(registration);

    const check = checkForUpdate();
    await Promise.resolve();
    registration.installing = null;
    worker.finish('redundant');

    expect(await check).toBe('current');
  });
});
