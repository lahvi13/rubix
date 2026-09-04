import { useEffect, useMemo, useState } from 'react';
import {
  applyAppearance,
  cacheAppearance,
  prefersDark,
  resolveTheme,
  watchSystemTheme,
  type Appearance,
  type ResolvedTheme,
} from '../lib/appearance';
import { useSetting } from './use-setting';

/**
 * The look of the app, applied. Reading the pieces is like any other setting;
 * the effect is what puts them on the document — including when 'system' means
 * the browser changed its mind while the app was open.
 */
export function useAppearance(): void {
  const appearance = useAppearanceSettings();

  useEffect(() => {
    applyAppearance(appearance);
    cacheAppearance(appearance);
    if (appearance.theme !== 'system') return;
    return watchSystemTheme(() => applyAppearance(appearance));
  }, [appearance]);
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

function useAppearanceSettings(): Appearance {
  const [theme] = useSetting('ui.theme');
  const [font] = useSetting('ui.font');
  const [textSize] = useSetting('ui.textSize');
  const [clockSize] = useSetting('ui.clockSize');

  // One object, stable while the settings are, so applying it is not a thing
  // that happens on every render of the whole app.
  return useMemo(
    () => ({ theme, font, textSize, clockSize }),
    [theme, font, textSize, clockSize],
  );
}
