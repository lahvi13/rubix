import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * The module listens on the window and keeps what it caught, so every case
 * needs its own copy of it — hence the dynamic imports.
 */
async function load() {
  vi.resetModules();
  return import('./install');
}

/** What Chromium hands over; jsdom has no such event of its own. */
class FakePrompt extends Event implements BeforeInstallPromptEvent {
  wasPrompted = false;
  private readonly outcome: 'accepted' | 'dismissed';

  constructor(outcome: 'accepted' | 'dismissed' = 'accepted') {
    super('beforeinstallprompt', { cancelable: true });
    this.outcome = outcome;
  }

  prompt(): Promise<void> {
    this.wasPrompted = true;
    return Promise.resolve();
  }

  get userChoice(): Promise<{ outcome: 'accepted' | 'dismissed' }> {
    return Promise.resolve({ outcome: this.outcome });
  }
}

function setIos(standalone: boolean | undefined): void {
  if (standalone === undefined) {
    Reflect.deleteProperty(window.navigator, 'standalone');
    return;
  }
  Object.defineProperty(window.navigator, 'standalone', {
    value: standalone,
    configurable: true,
  });
}

afterEach(() => setIos(undefined));

describe('installState', () => {
  it('says nothing in a browser that neither offers nor needs installing', async () => {
    const install = await load();
    expect(install.installState()).toBe('none');
  });

  it('asks for the share sheet on iOS, which fires no event', async () => {
    setIos(false);
    const install = await load();
    expect(install.installState()).toBe('manual');
  });

  it('is done once iOS opens it from the home screen', async () => {
    setIos(true);
    const install = await load();
    expect(install.installState()).toBe('installed');
  });

  it('offers the browser prompt once the browser has offered it', async () => {
    const install = await load();
    window.dispatchEvent(new FakePrompt());
    expect(install.installState()).toBe('prompt');
  });

  it('is done after the browser reports the install, tab or no tab', async () => {
    const install = await load();
    window.dispatchEvent(new FakePrompt());
    window.dispatchEvent(new Event('appinstalled'));
    expect(install.installState()).toBe('installed');
  });
});

describe('showInstallPrompt', () => {
  it('spends the held event, and does not hold it twice', async () => {
    const install = await load();
    const event = new FakePrompt();
    window.dispatchEvent(event);

    await install.showInstallPrompt();

    expect(event.wasPrompted).toBe(true);
    expect(install.installState()).toBe('none');
  });

  it('is a no-op with nothing held', async () => {
    const install = await load();
    await expect(install.showInstallPrompt()).resolves.toBeUndefined();
  });

  it('tells whoever is watching that the offer changed', async () => {
    const install = await load();
    const seen: string[] = [];
    const unsubscribe = install.subscribeInstall(() => seen.push(install.installState()));

    window.dispatchEvent(new FakePrompt());
    await install.showInstallPrompt();
    unsubscribe();

    expect(seen).toEqual(['prompt', 'none']);
  });
});
