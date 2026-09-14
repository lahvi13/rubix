import { strings } from './strings';

/**
 * Whether this browser can draw the app at all.
 *
 * The palette is written in `light-dark()`, and the layout leans on `:has()`,
 * `dvh` and `color-mix()`. A browser missing any of them does not fail loudly:
 * it draws a page whose colours have no value, which reads as broken rather
 * than as old. Safari got the last of them in 17.5 (see IOS-CHECKLIST.md).
 */
export function isBrowserSupported(): boolean {
  if (typeof CSS === 'undefined' || typeof CSS.supports !== 'function') return false;
  if (typeof indexedDB === 'undefined') return false;
  return (
    CSS.supports('color', 'light-dark(#000, #fff)') &&
    CSS.supports('color', 'color-mix(in srgb, #000, #fff)') &&
    CSS.supports('height', '1dvh') &&
    CSS.supports('selector(:has(a))')
  );
}

/**
 * Says so in plain HTML instead of starting the app. The colours are written
 * out here rather than taken from the stylesheet, because the stylesheet's
 * colours are the very thing this browser cannot read.
 */
export function showUnsupportedBrowser(container: HTMLElement): void {
  const box = document.createElement('div');
  box.setAttribute('role', 'alert');
  box.style.cssText =
    'max-width:28rem;margin:4rem auto;padding:0 1rem;font:16px/1.5 system-ui,sans-serif;color:#e5e7eb';
  const title = document.createElement('h1');
  title.style.cssText = 'font-size:1.25rem;margin:0 0 0.5rem';
  title.textContent = strings.unsupportedBrowser.title;
  const message = document.createElement('p');
  message.style.cssText = 'margin:0;color:#9ca3af';
  message.textContent = strings.unsupportedBrowser.message;
  box.append(title, message);
  document.body.style.background = '#0f1115';
  container.replaceChildren(box);
}
