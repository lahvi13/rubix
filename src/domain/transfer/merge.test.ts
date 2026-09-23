import { describe, expect, it } from 'vitest';
import type { Setting, Solve, Tag, Tombstone } from '../../db/types';
import { SPLITS_SCHEMA_VERSION } from '../../db/types';
import { hasChanges, planImport, totalCounts } from './merge';
import { emptyExportData, type ExportData } from './types';

function data(partial: Partial<ExportData> = {}): ExportData {
  return { ...emptyExportData(), ...partial };
}

function solve(id: string, updatedAt: number, rawMs = 12_000): Solve {
  return {
    id,
    sessionId: 'session-1',
    puzzle: '333',
    mode: 'freestyle',
    caseId: null,
    scramble: "R U R' U'",
    scrambleSource: 'generated',
    rawMs,
    penalty: 'none',
    penaltySource: 'auto',
    inspectionMs: null,
    startedAt: updatedAt,
    splits: [],
    splitsSchemaVersion: SPLITS_SCHEMA_VERSION,
    tagIds: [],
    note: null,
    starred: 0,
    editedAt: null,
    createdAt: updatedAt,
    updatedAt,
  };
}

function tag(id: string, name: string, updatedAt: number): Tag {
  return { id, name, color: '#4ade80', createdAt: updatedAt, updatedAt };
}

function setting(key: string, value: unknown, deviceLocal: 0 | 1, updatedAt = 1): Setting {
  return { key, value, deviceLocal, updatedAt };
}

function grave(id: string, table: string, deletedAt: number): Tombstone {
  return { id, table, deletedAt };
}

describe('planImport — merge', () => {
  it('adds rows the device has never seen', () => {
    const plan = planImport('merge', data(), data({ solves: [solve('a', 100)] }));

    expect(plan.puts.solves.map((row) => row.id)).toEqual(['a']);
    expect(plan.counts.solves).toEqual({ added: 1, updated: 0, deleted: 0, unchanged: 0 });
  });

  it('lets the newer edit win, whichever side it is on', () => {
    const older = solve('a', 100, 12_000);
    const newer = solve('a', 200, 13_000);

    const incomingWins = planImport('merge', data({ solves: [older] }), data({ solves: [newer] }));
    expect(incomingWins.puts.solves[0]?.rawMs).toBe(13_000);
    expect(incomingWins.counts.solves.updated).toBe(1);

    const localWins = planImport('merge', data({ solves: [newer] }), data({ solves: [older] }));
    expect(localWins.puts.solves).toEqual([]);
    expect(localWins.counts.solves.unchanged).toBe(1);
  });

  it('writes nothing when both sides hold the same row', () => {
    const plan = planImport(
      'merge',
      data({ solves: [solve('a', 100)] }),
      data({ solves: [solve('a', 100)] }),
    );

    expect(plan.puts.solves).toEqual([]);
    expect(hasChanges(plan.counts)).toBe(false);
  });

  it('applies a tombstone from the file to a local row', () => {
    const plan = planImport(
      'merge',
      data({ solves: [solve('a', 100)] }),
      data({ tombstones: [grave('a', 'solves', 150)] }),
    );

    expect(plan.deletes.solves).toEqual(['a']);
    expect(plan.puts.tombstones).toHaveLength(1);
    expect(plan.counts.solves.deleted).toBe(1);
  });

  it('keeps a row that was edited after the other device deleted it', () => {
    const plan = planImport(
      'merge',
      data({ solves: [solve('a', 300)] }),
      data({ tombstones: [grave('a', 'solves', 150)] }),
    );

    expect(plan.deletes.solves).toEqual([]);
    expect(plan.counts.solves.deleted).toBe(0);
  });

  it('does not resurrect a row this device already deleted', () => {
    const plan = planImport(
      'merge',
      data({ tombstones: [grave('a', 'solves', 200)] }),
      data({ solves: [solve('a', 100)] }),
    );

    expect(plan.puts.solves).toEqual([]);
    expect(plan.counts.solves.added).toBe(0);
  });

  it('takes back a row that was edited after this device deleted it', () => {
    const plan = planImport(
      'merge',
      data({ tombstones: [grave('a', 'solves', 200)] }),
      data({ solves: [solve('a', 300)] }),
    );

    expect(plan.puts.solves.map((row) => row.id)).toEqual(['a']);
  });

  it('does not let a tombstone of one table delete a same-id row in another', () => {
    const plan = planImport(
      'merge',
      data({ tags: [tag('pll', 'PLL', 100)] }),
      data({ tombstones: [grave('pll', 'algSets', 500)] }),
    );

    expect(plan.deletes.tags).toEqual([]);
  });

  it('keeps the newest deletion when both sides deleted the same row', () => {
    const plan = planImport(
      'merge',
      data({ tombstones: [grave('a', 'solves', 100)] }),
      data({ tombstones: [grave('a', 'solves', 200)] }),
    );

    expect(plan.puts.tombstones).toEqual([grave('a', 'solves', 200)]);
  });

  it('never overwrites a device-local setting, whatever the file says', () => {
    const plan = planImport(
      'merge',
      data({ settings: [setting('audio.thresholdDb', -30, 1, 100)] }),
      data({ settings: [setting('audio.thresholdDb', -12, 0, 900)] }),
    );

    expect(plan.puts.settings).toEqual([]);
    expect(plan.deletes.settings).toEqual([]);
  });

  it('ignores device-local rows that a hand-edited file carries', () => {
    const plan = planImport(
      'merge',
      data(),
      data({ settings: [setting('audio.inputDeviceId', 'mic-2', 1, 900)] }),
    );

    expect(plan.puts.settings).toEqual([]);
  });

  it('merges shared settings by time like any other row', () => {
    const plan = planImport(
      'merge',
      data({ settings: [setting('timer.holdThresholdMs', 300, 0, 100)] }),
      data({ settings: [setting('timer.holdThresholdMs', 500, 0, 200)] }),
    );

    expect(plan.puts.settings[0]?.value).toBe(500);
    expect(plan.counts.settings.updated).toBe(1);
  });

  it('converges: importing each side into the other ends with the same rows', () => {
    const left = data({ solves: [solve('a', 100), solve('b', 400)] });
    const right = data({
      solves: [solve('a', 300, 9_000), solve('c', 500)],
      tombstones: [grave('b', 'solves', 600)],
    });

    const intoLeft = planImport('merge', left, right);
    const intoRight = planImport('merge', right, left);

    expect(resultIds(left, intoLeft)).toEqual(resultIds(right, intoRight));
  });
});

describe('planImport — merge, tags by name', () => {
  const tagged = (id: string, updatedAt: number, tagIds: string[]): Solve => ({
    ...solve(id, updatedAt),
    tagIds,
  });

  it('folds a tag of the same name into the one already here, solves and all', () => {
    const plan = planImport(
      'merge',
      data({ tags: [tag('desk', 'OLL skip', 100)] }),
      data({ tags: [tag('phone', 'OLL skip', 200)], solves: [tagged('s', 300, ['phone'])] }),
    );

    expect(plan.puts.tags).toEqual([]);
    expect(plan.puts.solves[0]?.tagIds).toEqual(['desk']);
    expect(plan.counts.tags).toEqual({ added: 0, updated: 0, deleted: 0, unchanged: 1 });
  });

  it('keeps one id where a solve carries both halves of a folded tag', () => {
    const plan = planImport(
      'merge',
      data({ tags: [tag('desk', 'PLL skip', 100)] }),
      data({ tags: [tag('phone', 'PLL skip', 200)], solves: [tagged('s', 300, ['desk', 'phone'])] }),
    );

    expect(plan.puts.solves[0]?.tagIds).toEqual(['desk']);
  });

  it('leaves out a rename onto a name another tag here holds', () => {
    const plan = planImport(
      'merge',
      data({ tags: [tag('a', 'Lucky', 100), tag('b', 'Skip', 100)] }),
      data({ tags: [tag('a', 'Skip', 200)] }),
    );

    expect(plan.puts.tags).toEqual([]);
    expect(plan.counts.tags).toEqual({ added: 0, updated: 0, deleted: 0, unchanged: 1 });
  });

  it.each([
    [
      'a rename gives it up',
      data({ tags: [tag('a', 'Skip', 100)] }),
      data({ tags: [tag('a', 'Lucky', 200), tag('n', 'Skip', 200)] }),
    ],
    [
      'the tag holding it is deleted by the file',
      data({ tags: [tag('a', 'Skip', 100)] }),
      data({ tags: [tag('n', 'Skip', 200)], tombstones: [grave('a', 'tags', 150)] }),
    ],
  ])('lets a new tag have a name once %s', (_name, local, incoming) => {
    const plan = planImport('merge', local, incoming);
    expect(plan.puts.tags.map((row) => row.id)).toContain('n');
  });

  it('leaves the names alone when nothing collides', () => {
    const plan = planImport(
      'merge',
      data({ tags: [tag('a', 'Skip', 100)] }),
      data({ tags: [tag('n', 'Lucky', 200)], solves: [tagged('s', 300, ['n'])] }),
    );

    expect(plan.puts.tags.map((row) => row.id)).toEqual(['n']);
    expect(plan.puts.solves[0]?.tagIds).toEqual(['n']);
  });
});

describe('planImport — replace', () => {
  it('takes the file wholesale and reports what is lost', () => {
    const plan = planImport(
      'replace',
      data({ solves: [solve('a', 100), solve('b', 100)] }),
      data({ solves: [solve('b', 100), solve('c', 100)] }),
    );

    expect(plan.puts.solves.map((row) => row.id)).toEqual(['b', 'c']);
    expect(plan.deletes.solves).toEqual([]);
    expect(plan.counts.solves).toEqual({ added: 1, updated: 0, deleted: 1, unchanged: 1 });
  });

  it('keeps this device its own settings', () => {
    const plan = planImport(
      'replace',
      data({
        settings: [setting('audio.thresholdDb', -30, 1), setting('stats.chartWindow', 50, 0)],
      }),
      data({ settings: [setting('stats.chartWindow', 100, 0, 5)] }),
    );

    expect(plan.puts.settings.map((row) => row.key)).toEqual([
      'audio.thresholdDb',
      'stats.chartWindow',
    ]);
    expect(plan.puts.settings[1]?.value).toBe(100);
  });

  it('ignores a deletion that never applied to anything', () => {
    const plan = planImport('replace', data(), data({ tombstones: [grave('a', 'solves', 100)] }));

    expect(totalCounts(plan.counts)).toEqual({ added: 1, updated: 0, deleted: 0, unchanged: 0 });
  });
});

/** The ids a plan leaves behind in the solves table. */
function resultIds(local: ExportData, plan: ReturnType<typeof planImport>): string[] {
  const rows = new Map(local.solves.map((row) => [row.id, row]));
  for (const row of plan.puts.solves) rows.set(row.id, row);
  for (const id of plan.deletes.solves) rows.delete(id);
  return [...rows.keys()].sort();
}
