import { useEffect, useState } from 'react';
import {
  applyTheme,
  cacheTheme,
  prefersDark,
  resolveTheme,
  watchSystemTheme,
  type ResolvedTheme,
  type Theme,
} from '../lib/theme';
import { useSetting } from './use-setting';

/**
 * The theme, applied. Reading it is like any other setting; the effect is
 * what puts it on the document — including when 'system' means the browser
 * changed its mind while the app was open.
 */
export function useTheme(): [Theme, (theme: Theme) => void] {
  const [theme, setTheme] = useSetting('ui.theme');

  useEffect(() => {
    applyTheme(theme);
    cacheTheme(theme);
    if (theme !== 'system') return;
    return watchSystemTheme(() => applyTheme(theme));
  }, [theme]);

  return [theme, setTheme];
}

/**
 * Which of the two themes is actually on screen. For the things CSS cannot
 * reach: the cube diagrams are images built from a palette, so they have to be
 * told.
 */
export function useResolvedTheme(): ResolvedTheme {
  const [theme] = useSetting('ui.theme');
  const [isSystemDark, setSystemDark] = useState(prefersDark);

  useEffect(() => watchSystemTheme(setSystemDark), []);

  return resolveTheme(theme, isSystemDark);
}
