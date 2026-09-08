/** Injected at build time from package.json via Vite `define`. */
declare const __APP_VERSION__: string;

/**
 * The two pieces of the install story that no standard describes, and that
 * neither engine's type definitions carry.
 */

/**
 * Chromium only: the browser offers the page a chance to ask for installation
 * itself. Held back on `beforeinstallprompt` and spent later from a click —
 * `prompt()` is only allowed while a gesture is being handled.
 */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface WindowEventMap {
  beforeinstallprompt: BeforeInstallPromptEvent;
  appinstalled: Event;
}

interface Navigator {
  /**
   * iOS WebKit only: whether the page was opened from the home screen. That it
   * exists at all is the thing worth reading — no other engine defines it, and
   * on iOS every browser is WebKit.
   */
  readonly standalone?: boolean;
}
