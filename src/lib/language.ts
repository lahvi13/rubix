/**
 * Which language the interface is in.
 *
 * Read once, before anything renders, and never again: the sixty-odd modules
 * that import `strings` read it at import time, so switching means reloading
 * the page. That is the whole reason this lives in localStorage rather than in
 * the database with the other settings — the database answers an async tick
 * too late, and a first frame in the wrong language is worse than a reload.
 * It is a property of this device, not of the data, and so it is not exported
 * in a backup either.
 */

export const LANGUAGES = ['cs', 'en'] as const;

export type Language = (typeof LANGUAGES)[number];

const STORAGE_KEY = 'rubix.language';

export function isLanguage(value: unknown): value is Language {
  return LANGUAGES.includes(value as Language);
}

/**
 * What a device that has never been asked gets. Czech only where the browser
 * asks for Czech: everybody else is better served by the language the app was
 * written in than by one they cannot read.
 */
export function defaultLanguage(): Language {
  const preferred = typeof navigator === 'undefined' ? [] : navigator.languages ?? [navigator.language];
  for (const tag of preferred) {
    const base = tag.toLowerCase().split('-')[0];
    if (isLanguage(base)) return base;
  }
  return 'en';
}

export function currentLanguage(): Language {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (isLanguage(stored)) return stored;
  } catch {
    // Storage can be denied outright; the browser's own preference still works.
  }
  return defaultLanguage();
}

/** Written for the next load, which is what the caller then asks for. */
export function storeLanguage(language: Language): void {
  try {
    localStorage.setItem(STORAGE_KEY, language);
  } catch {
    // Nothing to do: the choice cannot be kept, so it lasts this visit only.
  }
}
