/**
 * The chosen theme, on the document. The stylesheet does the work through
 * `light-dark()`; all that is set here is which colour scheme the root
 * element is in, plus the browser-chrome colour, which CSS cannot reach.
 */

export const THEMES = ['system', 'light', 'dark'] as const;

export type Theme = (typeof THEMES)[number];

export type ResolvedTheme = 'light' | 'dark';

/** Must match --bg in index.css: this is the same surface, painted by the browser. */
const CHROME_COLOUR: Record<ResolvedTheme, string> = {
  light: '#e9ecf2',
  dark: '#0f1115',
};

const STORAGE_KEY = 'rubix.theme';

const DARK_QUERY = '(prefers-color-scheme: dark)';

export function isTheme(value: unknown): value is Theme {
  return THEMES.includes(value as Theme);
}

export function resolveTheme(theme: Theme, prefersDark: boolean): ResolvedTheme {
  if (theme === 'system') return prefersDark ? 'dark' : 'light';
  return theme;
}

export function prefersDark(): boolean {
  return window.matchMedia(DARK_QUERY).matches;
}

/** Calls back whenever the system preference flips, for as long as it is needed. */
export function watchSystemTheme(onChange: (prefersDark: boolean) => void): () => void {
  const query = window.matchMedia(DARK_QUERY);
  const listener = (event: MediaQueryListEvent) => onChange(event.matches);
  query.addEventListener('change', listener);
  return () => query.removeEventListener('change', listener);
}

export function applyTheme(value: Theme): void {
  // A value written by a newer version can be anything, and it ends up on the
  // document either way; the system preference is the safe reading of it.
  const theme = isTheme(value) ? value : 'system';
  const root = document.documentElement;
  // 'system' leaves the attribute off, which is what hands the decision back
  // to the media query inside `color-scheme: light dark`.
  if (theme === 'system') delete root.dataset.theme;
  else root.dataset.theme = theme;

  const meta = document.querySelector('meta[name="theme-color"]');
  meta?.setAttribute('content', CHROME_COLOUR[resolveTheme(theme, prefersDark())]);
}

/**
 * The theme is kept in the database like every other setting, but that answer
 * arrives an async tick too late to paint the first frame with. A copy in
 * localStorage is readable before anything renders; the database stays the
 * one that is edited.
 */
export function cachedTheme(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return isTheme(stored) ? stored : 'system';
  } catch {
    // Storage can be denied outright; the system preference is a fine answer.
    return 'system';
  }
}

export function cacheTheme(theme: Theme): void {
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Nothing to do — it only costs a flash of the wrong theme next launch.
  }
}
