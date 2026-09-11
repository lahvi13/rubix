import { db } from '../schema';
import type { Flag } from '../types';
import { now } from '../../lib/clock';
import type { ClockFace, Font, Size, Theme } from '../../lib/appearance';

/**
 * Key-value settings. Device-local entries (mic calibration, chosen audio
 * input) are flagged so the exporter can skip them.
 */
export interface SettingValues {
  'timer.holdThresholdMs': number;
  'timer.inspectionEnabled': boolean;
  'timer.inspectionCues': readonly number[];
  /** Whether the timer draws the scrambled cube at all. */
  'timer.showScramblePreview': boolean;
  /**
   * 'phases' turns the timer into the guided solve: a tap ends the phase in
   * progress instead of stopping the clock, and the last one stops it.
   */
  'timer.splitMode': 'total' | 'phases';
  /** Device-local: the same account can prefer a different theme on each screen. */
  'ui.theme': Theme;
  /** Which typeface the app is set in; 'system' hands it back to the device. */
  'ui.font': Font;
  /** Device-local, like the two below it: this is about the screen in front of
   * the reader, not about what they like. */
  'ui.textSize': Size;
  'ui.clockSize': Size;
  /** Taste, not fit, so it travels with a backup like the cube skin does. */
  'ui.clockFace': ClockFace;
  'ui.twistyMode': '2D' | '3D';
  'ui.cubeSkin': string;
  /**
   * Whether the beginner's guide is offered in the menu. Somebody who solves
   * the cube already has no use for it, and a screen they will never open is
   * one more thing between them and the timer.
   */
  'ui.showLearn': boolean;
  /** Which route through the last layer the trainer opens on. */
  'trainer.twoLookDefault': boolean;
  /** Print the algorithm on every card, not just in the case sheet. */
  'trainer.showAlgs': boolean;
  /** Offer the built-in variants that start by turning the cube. */
  'trainer.showRotationAlgs': boolean;
  /**
   * Which set the trainer opens on. Somebody halfway through OLL comes back to
   * OLL — the same courtesy the drill already pays with the key below.
   */
  'trainer.setId': string;
  /** Which set the drill draws its cases from. */
  'trainer.drillSetId': string;
  /**
   * Which half of the drill screen is open: solving the case against the
   * clock, or only telling which case it is. Both draw from the same set and
   * the same ticked cases — it is the same practice, timed differently.
   */
  'trainer.drillMode': DrillMode;
  /**
   * Cases ticked for drilling. One flat list across every set — case ids are
   * unique, so the drill simply keeps the ones belonging to the set it is on,
   * and a subset picked for PLL survives a detour through OLL.
   */
  'trainer.drillCaseIds': readonly string[];
  /**
   * Which side the reader has in front when they solve the cross, as the face
   * the app's own model calls it. It decides how the cross solution is
   * written, and it is remembered because most people pick the cube up the
   * same way every time.
   */
  'trainer.crossFront': string;
  'stats.chartWindow': number;
  /**
   * How the phase trend is drawn. Stacked shows the whole solve, separate puts
   * every phase on its own baseline (the only way to see F2L alone come down),
   * share drops the total and keeps the proportions.
   */
  'stats.phaseTrendMode': PhaseTrendMode;
  /**
   * Draw the 5-solve rolling mean instead of the raw times. Off by default:
   * smoothing costs the first four solves, and a chart whose axis starts at 5
   * has to be asked for rather than arrived at.
   */
  'stats.phaseTrendSmoothed': boolean;
}

export const DRILL_MODES = ['solve', 'recognise'] as const;
export type DrillMode = (typeof DRILL_MODES)[number];

export const PHASE_TREND_MODES = ['stacked', 'separate', 'share'] as const;
export type PhaseTrendMode = (typeof PHASE_TREND_MODES)[number];

export const SETTING_DEFAULTS: SettingValues = {
  'timer.holdThresholdMs': 300,
  'timer.inspectionEnabled': false,
  'timer.inspectionCues': [8000, 12000],
  'timer.showScramblePreview': true,
  'timer.splitMode': 'total',
  'ui.theme': 'dark',
  'ui.font': 'sans',
  'ui.textSize': 'medium',
  'ui.clockSize': 'large',
  'ui.clockFace': 'digital',
  'ui.twistyMode': '2D',
  'ui.cubeSkin': 'classic',
  'ui.showLearn': true,
  'trainer.twoLookDefault': true,
  'trainer.showAlgs': true,
  'trainer.showRotationAlgs': true,
  'trainer.setId': 'f2l',
  'trainer.drillSetId': 'pll',
  'trainer.drillMode': 'solve',
  'trainer.drillCaseIds': [],
  'trainer.crossFront': 'F',
  'stats.chartWindow': 100,
  'stats.phaseTrendMode': 'stacked',
  'stats.phaseTrendSmoothed': false,
};

export type SettingKey = keyof SettingValues;

const DEVICE_LOCAL_PREFIXES = ['audio.', 'ui.theme', 'ui.textSize', 'ui.clockSize'];

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
