import { db } from '../schema';
import type { Flag } from '../types';
import { now } from '../../lib/clock';

/**
 * Key-value settings. Device-local entries (mic calibration, chosen audio
 * input) are flagged so the exporter can skip them.
 */
export const SETTING_DEFAULTS = {
  'timer.holdThresholdMs': 300,
  'timer.inspectionEnabled': true,
  'timer.inspectionCues': [8000, 12000],
  'ui.twistyMode': '2D',
} as const;

export type SettingKey = keyof typeof SETTING_DEFAULTS;

const DEVICE_LOCAL_PREFIXES = ['audio.', 'ui.theme'];

function isDeviceLocal(key: string): Flag {
  return DEVICE_LOCAL_PREFIXES.some((prefix) => key.startsWith(prefix)) ? 1 : 0;
}

export async function getSetting<K extends SettingKey>(
  key: K,
): Promise<(typeof SETTING_DEFAULTS)[K]> {
  const row = await db.settings.get(key);
  if (row === undefined) return SETTING_DEFAULTS[key];
  return row.value as (typeof SETTING_DEFAULTS)[K];
}

export async function setSetting(key: string, value: unknown): Promise<void> {
  await db.settings.put({
    key,
    value,
    deviceLocal: isDeviceLocal(key),
    updatedAt: now(),
  });
}
