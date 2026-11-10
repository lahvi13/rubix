import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { db } from '../schema';
import {
  SETTING_DEFAULTS,
  getSetting,
  readSetting,
  setSetting,
  watchSettings,
  type SettingKey,
  type StoredSettings,
} from './settings-repository';

describe('watchSettings', () => {
  let snapshots: StoredSettings[];
  let stop: () => void;

  beforeEach(async () => {
    await Promise.all(db.tables.map((table) => table.clear()));
    snapshots = [];
    stop = () => {};
  });

  afterEach(() => stop());

  function watch(): void {
    stop = watchSettings(
      (stored) => snapshots.push(stored),
      (cause) => {
        throw cause;
      },
    );
  }

  async function nextSnapshot(count: number): Promise<StoredSettings> {
    await expect.poll(() => snapshots.length).toBeGreaterThanOrEqual(count);
    const latest = snapshots[snapshots.length - 1];
    if (latest === undefined) throw new Error('no snapshot');
    return latest;
  }

  it('delivers what is stored, and every write after', async () => {
    await setSetting('ui.theme', 'light');
    watch();

    expect((await nextSnapshot(1)).get('ui.theme')).toBe('light');

    await setSetting('ui.theme', 'system');
    await expect.poll(() => snapshots.at(-1)?.get('ui.theme')).toBe('system');
  });

  it('hands out the same list again when a different setting was written', async () => {
    await setSetting('trainer.drillCaseIds', ['pll-t', 'pll-y']);
    watch();
    const first = (await nextSnapshot(1)).get('trainer.drillCaseIds');

    await setSetting('ui.theme', 'light');
    await expect.poll(() => snapshots.at(-1)?.get('ui.theme')).toBe('light');

    expect(snapshots.at(-1)?.get('trainer.drillCaseIds')).toBe(first);
  });

  it('hands out a new list once the list itself changed', async () => {
    await setSetting('trainer.drillCaseIds', ['pll-t']);
    watch();
    const first = (await nextSnapshot(1)).get('trainer.drillCaseIds');

    await setSetting('trainer.drillCaseIds', ['pll-t', 'pll-y']);
    await expect
      .poll(() => snapshots.at(-1)?.get('trainer.drillCaseIds'))
      .toEqual(['pll-t', 'pll-y']);

    expect(snapshots.at(-1)?.get('trainer.drillCaseIds')).not.toBe(first);
  });
});

describe('readSetting', () => {
  it.each([
    ['nothing stored', new Map<string, unknown>(), 'dark'],
    ['a value of the right shape', new Map<string, unknown>([['ui.theme', 'light']]), 'light'],
    ['a value of the wrong shape', new Map<string, unknown>([['ui.theme', 42]]), 'dark'],
  ])('with %s', (_, stored, expected) => {
    expect(readSetting(stored, 'ui.theme')).toBe(expected);
  });

  it('keeps the layout of the trainer to the device it was chosen on', async () => {
    await setSetting('ui.caseLayout', 'list');

    // The phone and the monitor want different layouts, so it stays out of an
    // export the way text size does.
    expect((await db.settings.get('ui.caseLayout'))?.deviceLocal).toBe(1);
  });

  it('falls back to the default itself, not a copy of it', () => {
    expect(readSetting(new Map(), 'trainer.drillCaseIds')).toBe(
      SETTING_DEFAULTS['trainer.drillCaseIds'],
    );
  });
});

/*
 * What is stored is not only what this version wrote: a backup from a newer
 * one brings values this code has never heard of, and they are strings and
 * numbers like the ones it has.
 */
describe('a stored value this version does not know', () => {
  const stored = (key: SettingKey, value: unknown): Map<string, unknown> => new Map([[key, value]]);
  const KEYS = Object.keys(SETTING_DEFAULTS).filter((key): key is SettingKey =>
    Object.hasOwn(SETTING_DEFAULTS, key),
  );

  // Every setting that is one of a list: [key, a member other than the default, a stranger].
  it.each<[SettingKey, string, string]>([
    ['timer.splitMode', 'phases', 'laps'],
    ['timer.runningDisplay', 'tenths', 'thousandths'],
    ['ui.theme', 'light', 'sepia'],
    ['ui.font', 'mono', 'serif'],
    ['ui.textSize', 'large', 'huge'],
    ['ui.clockSize', 'small', 'huge'],
    ['ui.clockFace', 'mono', 'analogue'],
    ['ui.twistyMode', '2D', '4D'],
    ['ui.caseLayout', 'list', 'carousel'],
    ['ui.welcome', 'asked', 'later'],
    ['trainer.drillMode', 'recognise', 'both'],
    ['stats.phaseTrendMode', 'share', 'pie'],
    ['stats.scope', 'session', 'week'],
  ])('%s keeps %s and reads %s as the default', (key, member, stranger) => {
    expect(readSetting(stored(key, member), key)).toBe(member);
    expect(readSetting(stored(key, stranger), key)).toBe(SETTING_DEFAULTS[key]);
  });

  it.each<[SettingKey, unknown]>([
    ['timer.holdThresholdMs', -300],
    ['timer.holdThresholdMs', Number.NaN],
    ['timer.holdThresholdMs', '300'],
    ['timer.inspectionCues', [8000, 'twelve']],
    ['timer.inspectionCues', 8000],
    ['stats.chartWindow', 0],
    ['stats.goalMs', -1],
    ['stats.goalMs', Number.POSITIVE_INFINITY],
    ['trainer.drillCaseIds', ['pll-t', 7]],
    ['trainer.lastLevels', 'f2l-advanced'],
    ['timer.inspectionEnabled', 1],
    ['ui.cubeSkin', null],
  ])('%s does not take %j', (key, value) => {
    expect(readSetting(stored(key, value), key)).toBe(SETTING_DEFAULTS[key]);
  });

  it.each<[SettingKey, unknown]>([
    ['timer.holdThresholdMs', 0],
    ['timer.inspectionCues', []],
    ['stats.chartWindow', 25],
    ['audio.voiceLoudnessDb', -12.5],
    ['ui.cubeSkin', 'a skin from the future'],
    ['trainer.drillCaseIds', ['pll-t', 'pll-y']],
  ])('%s takes %j', (key, value) => {
    expect(readSetting(stored(key, value), key)).toEqual(value);
  });

  // A guard that refused its own default would reset the setting on every read
  // and nothing would say so.
  it.each(KEYS)('%s accepts its own default', (key) => {
    const fallback = SETTING_DEFAULTS[key];
    // A different object where the default is a list, so that getting the
    // default back cannot pass for the stored value having been accepted.
    const value = Array.isArray(fallback) ? [...fallback] : fallback;
    const read = readSetting(stored(key, value), key);
    if (Array.isArray(fallback)) expect(read).toBe(value);
    else expect(read).toBe(fallback);
  });

  it('is read as the default from the database too', async () => {
    await Promise.all(db.tables.map((table) => table.clear()));
    await setSetting('timer.runningDisplay', 'thousandths');
    await setSetting('stats.scope', 'recent');

    expect(await getSetting('timer.runningDisplay')).toBe('hundredths');
    expect(await getSetting('stats.scope')).toBe('recent');
  });
});
