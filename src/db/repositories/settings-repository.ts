import { db } from '../schema';
import type { Flag } from '../types';
import { now } from '../../lib/clock';

/**
 * Key-value settings. Device-local entries (mic calibration, chosen audio
 * input) are flagged so the exporter can skip them.
 */
export interface SettingValues {
  'timer.holdThresholdMs': number;
  'timer.inspectionEnabled': boolean;
  'timer.inspectionCues': readonly number[];
  'ui.twistyMode': '2D' | '3D';
  'ui.cubeSkin': string;
  /** Which route through the last layer the trainer opens on. */
  'trainer.twoLookDefault': boolean;
  'stats.chartWindow': number;
}

export const SETTING_DEFAULTS: SettingValues = {
  'timer.holdThresholdMs': 300,
  'timer.inspectionEnabled': true,
  'timer.inspectionCues': [8000, 12000],
  'ui.twistyMode': '2D',
  'ui.cubeSkin': 'classic',
  'trainer.twoLookDefault': false,
  'stats.chartWindow': 100,
};

export type SettingKey = keyof SettingValues;

const DEVICE_LOCAL_PREFIXES = ['audio.', 'ui.theme'];

function isDeviceLocal(key: string): Flag {
  return DEVICE_LOCAL_PREFIXES.some((prefix) => key.startsWith(prefix)) ? 1 : 0;
}

export async function getSetting<K extends SettingKey>(key: K): Promise<SettingValues[K]> {
  const row = await db.settings.get(key);
  // A value written by a newer version can be anything; the default is the
  // only thing we know is the right shape.
  return isValueFor(key, row?.value) ? row.value : SETTING_DEFAULTS[key];
}

function isValueFor<K extends SettingKey>(key: K, value: unknown): value is SettingValues[K] {
  const fallback = SETTING_DEFAULTS[key];
  if (Array.isArray(fallback)) return Array.isArray(value);
  return typeof value === typeof fallback;
}

export async function setSetting(key: string, value: unknown): Promise<void> {
  await db.settings.put({
    key,
    value,
    deviceLocal: isDeviceLocal(key),
    updatedAt: now(),
  });
}
