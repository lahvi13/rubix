import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { db } from '../schema';
import {
  SETTING_DEFAULTS,
  readSetting,
  setSetting,
  watchSettings,
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
