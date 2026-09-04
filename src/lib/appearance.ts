/**
 * What the app looks like, on the document. The stylesheet does the work — a
 * palette through `light-dark()`, a face and two sizes behind attributes on
 * the root element — so all that happens here is setting those attributes,
 * plus the browser-chrome colour, which CSS cannot reach.
 */

export const THEMES = ['system', 'light', 'dark'] as const;
export const FONTS = ['sans', 'mono', 'system'] as const;
export const SIZES = ['small', 'medium', 'large'] as const;

export type Theme = (typeof THEMES)[number];
export type Font = (typeof FONTS)[number];
export type Size = (typeof SIZES)[number];

export type ResolvedTheme = 'light' | 'dark';

export interface Appearance {
  theme: Theme;
  font: Font;
  /** The whole interface, scaled: every size in the stylesheet is in rem. */
  textSize: Size;
  /** The clock alone, which is read from further away than the rest. */
  clockSize: Size;
}

export const DEFAULT_APPEARANCE: Appearance = {
  theme: 'system',
  font: 'sans',
  textSize: 'medium',
  clockSize: 'medium',
};

/** Must match --bg in index.css: this is the same surface, painted by the browser. */
const CHROME_COLOUR: Record<ResolvedTheme, string> = {
  light: '#e9ecf2',
  dark: '#0f1115',
};

const STORAGE_KEY = 'rubix.appearance';

const DARK_QUERY = '(prefers-color-scheme: dark)';

export function isTheme(value: unknown): value is Theme {
  return THEMES.includes(value as Theme);
}

export function isFont(value: unknown): value is Font {
  return FONTS.includes(value as Font);
}

export function isSize(value: unknown): value is Size {
  return SIZES.includes(value as Size);
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

export function applyAppearance(appearance: Appearance): void {
  // A value written by a newer version can be anything, and it would end up on
  // the document either way; the defaults are the only shape we know.
  const { theme, font, textSize, clockSize } = sanitised(appearance);
  const root = document.documentElement;

  // The default of each is what the stylesheet already says, and leaving the
  // attribute off is what hands 'system' back to the media query.
  set(root, 'theme', theme, 'system');
  set(root, 'font', font, 'sans');
  set(root, 'textSize', textSize, 'medium');
  set(root, 'clockSize', clockSize, 'medium');

  const meta = document.querySelector('meta[name="theme-color"]');
  meta?.setAttribute('content', CHROME_COLOUR[resolveTheme(theme, prefersDark())]);
}

function set(root: HTMLElement, key: string, value: string, fallback: string): void {
  if (value === fallback) delete root.dataset[key];
  else root.dataset[key] = value;
}

/**
 * Appearance is kept in the database like every other setting, but that answer
 * arrives an async tick too late to paint the first frame with. A copy in
 * localStorage is readable before anything renders; the database stays the one
 * that is edited.
 */
export function cachedAppearance(): Appearance {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
    return sanitised(stored);
  } catch {
    // Storage can be denied outright, and the copy can be from any version.
    return DEFAULT_APPEARANCE;
  }
}

export function cacheAppearance(appearance: Appearance): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(appearance));
  } catch {
    // Nothing to do — it only costs a flash of the wrong theme next launch.
  }
}

function sanitised(value: unknown): Appearance {
  const stored = (typeof value === 'object' && value !== null ? value : {}) as Partial<Appearance>;
  return {
    theme: isTheme(stored.theme) ? stored.theme : DEFAULT_APPEARANCE.theme,
    font: isFont(stored.font) ? stored.font : DEFAULT_APPEARANCE.font,
    textSize: isSize(stored.textSize) ? stored.textSize : DEFAULT_APPEARANCE.textSize,
    clockSize: isSize(stored.clockSize) ? stored.clockSize : DEFAULT_APPEARANCE.clockSize,
  };
}
