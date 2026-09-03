import { useLiveQuery } from 'dexie-react-hooks';
import { watchWrite } from '../lib/errors';
import {
  SETTING_DEFAULTS,
  getSetting,
  setSetting,
  type SettingKey,
  type SettingValues,
} from '../db/repositories/settings-repository';

/**
 * One setting, live. Every screen that shows a setting also has to see it
 * change from somewhere else — the timer's inspection toggle and the settings
 * screen are the same switch.
 */
export function useSetting<K extends SettingKey>(
  key: K,
): [SettingValues[K], (value: SettingValues[K]) => void] {
  const value = useLiveQuery(() => getSetting(key), [key], SETTING_DEFAULTS[key]);

  return [
    value,
    (next) => {
      watchWrite(setSetting(key, next), key);
    },
  ];
}
