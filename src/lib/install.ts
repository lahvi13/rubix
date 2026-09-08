/**
 * How — and whether — this browser puts the app on the home screen.
 *
 * Two worlds. Chromium hands the page a `beforeinstallprompt` event it can
 * spend later, so installing is one button. iOS fires nothing and never will:
 * Add to Home Screen lives in the share sheet, and a page cannot open it, so
 * all that is left there is the sentence describing where it is.
 *
 * The event arrives long before any screen that would offer it is mounted, so
 * it is caught here, at module load, and kept.
 */

export type InstallState =
  /** Already on the home screen — nothing to offer. */
  | 'installed'
  /** The browser will install on request; `showInstallPrompt` does it. */
  | 'prompt'
  /** iOS: the reader has to go through the share sheet themselves. */
  | 'manual'
  /** A browser that does not install. */
  | 'none';

let deferred: BeforeInstallPromptEvent | null = null;
let installedHere = false;
const listeners = new Set<() => void>();

function announce(): void {
  for (const listener of listeners) listener();
}

window.addEventListener('beforeinstallprompt', (event) => {
  // Without this the browser shows its own bar, and the event is gone.
  event.preventDefault();
  deferred = event;
  announce();
});

window.addEventListener('appinstalled', () => {
  // This tab is still a plain tab — display-mode does not change under it —
  // so the fact has to be remembered rather than asked for.
  deferred = null;
  installedHere = true;
  announce();
});

/** Running from the home screen rather than in a browser tab. */
export function isStandalone(): boolean {
  return (
    installedHere ||
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true
  );
}

/**
 * iOS, by the one property only WebKit-on-iOS defines. Every browser on the
 * phone is WebKit underneath, and all of them install the same way, so this is
 * the whole question — a name in the user agent would answer a narrower one.
 */
export function isIosWebKit(): boolean {
  return 'standalone' in window.navigator;
}

export function installState(): InstallState {
  if (isStandalone()) return 'installed';
  if (deferred) return 'prompt';
  if (isIosWebKit()) return 'manual';
  return 'none';
}

export function subscribeInstall(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Only ever from a click: the browser refuses it without a live gesture. */
export async function showInstallPrompt(): Promise<void> {
  const event = deferred;
  if (!event) return;
  try {
    await event.prompt();
    await event.userChoice;
  } catch {
    // A dialog that would not open is not worth taking the screen down for.
  }
  // Spent either way. A reader who said no is offered it again on a later
  // visit, by the browser, on its own schedule.
  deferred = null;
  announce();
}
