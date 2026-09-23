import { describe, expect, it } from 'vitest';
import type { Method, Session, Solve, Tag } from '../../db/types';
import { solvesToCsv, type CsvFormat } from './csv';
import { emptyExportData, type ExportData } from './types';

/** Fixed on purpose: the point is the CSV, not the device's idea of a date. */
const format: CsvFormat = {
  dateTime: (timestamp) => `t${timestamp}`,
  time: (ms) => (ms === null ? 'DNF' : `${ms}ms`),
};

const cfop: Method = {
  id: 'cfop',
  name: 'CFOP',
  puzzle: '333',
  phases: [
    { key: 'cross', label: 'Cross', order: 0 },
    { key: 'f2l', label: 'F2L', order: 1 },
    { key: 'oll', label: 'OLL', order: 2 },
    { key: 'pll', label: 'PLL', order: 3 },
  ],
  createdAt: 1,
  updatedAt: 1,
};

const evening: Session = {
  id: 'session-1',
  name: 'Evening',
  puzzle: '333',
  mode: 'freestyle',
  methodId: 'cfop',
  isArchived: 0,
  isActive: 1,
  createdAt: 1,
  updatedAt: 1,
};

function makeSolve(overrides: Partial<Solve> = {}): Solve {
  return {
    id: 'solve-1',
    sessionId: 'session-1',
    puzzle: '333',
    mode: 'freestyle',
    caseId: null,
    scramble: "R U R' U'",
    scrambleSource: 'generated',
    rawMs: 12_340,
    penalty: 'none',
    penaltySource: 'auto',
    inspectionMs: null,
    startedAt: 1000,
    splits: [],
    splitsSchemaVersion: 1,
    tagIds: [],
    note: null,
    starred: 0,
    editedAt: null,
    createdAt: 1000,
    updatedAt: 1000,
    ...overrides,
  };
}

function makeData(solves: Solve[], extra: Partial<ExportData> = {}): ExportData {
  return {
    ...emptyExportData(),
    sessions: [evening],
    methods: [cfop],
    solves,
    ...extra,
  };
}

function lines(csv: string): string[] {
  return csv.split('\r\n');
}

function cells(line: string | undefined): string[] {
  return (line ?? '').split(',');
}

describe('solvesToCsv', () => {
  it('writes a header even when there is nothing to write', () => {
    const csv = solvesToCsv(emptyExportData(), format);

    expect(lines(csv)).toHaveLength(1);
    expect(cells(lines(csv)[0])).toEqual([
      'date',
      'session',
      'puzzle',
      'mode',
      'case',
      'time',
      'penalty',
      'finalMs',
      'rawMs',
      'inspectionMs',
      'starred',
      'scramble',
      'note',
      'tags',
    ]);
  });

  it('adds one column per phase of every method in the file', () => {
    const csv = solvesToCsv(makeData([]), format);

    expect(cells(lines(csv)[0]).slice(-4)).toEqual(['crossMs', 'f2lMs', 'ollMs', 'pllMs']);
  });

  it('writes a solve with its session name and its result', () => {
    const csv = solvesToCsv(makeData([makeSolve({ inspectionMs: 9000 })]), format);

    expect(cells(lines(csv)[1])).toEqual([
      't1000',
      'Evening',
      '333',
      'freestyle',
      '',
      '12340ms',
      '',
      '12340',
      '12340',
      '9000',
      '0',
      "R U R' U'",
      '',
      '',
      '',
      '',
      '',
      '',
    ]);
  });

  it.each([
    { penalty: 'plus2' as const, time: '14340ms', label: '+2', final: '14340' },
    { penalty: 'dnf' as const, time: 'DNF', label: 'DNF', final: '' },
  ])('states the penalty and what it did to the time ($penalty)', (expected) => {
    const csv = solvesToCsv(makeData([makeSolve({ penalty: expected.penalty })]), format);
    const row = cells(lines(csv)[1]);

    expect(row[5]).toBe(expected.time);
    expect(row[6]).toBe(expected.label);
    expect(row[7]).toBe(expected.final);
  });

  it('writes phase lengths, not the stored boundaries', () => {
    const solve = makeSolve({
      rawMs: 12_000,
      splits: [
        { phase: 'cross', atMs: 2000, source: 'manual' },
        { phase: 'f2l', atMs: 8000, source: 'manual' },
        { phase: 'oll', atMs: 10_000, source: 'manual' },
      ],
    });

    const csv = solvesToCsv(makeData([solve]), format);

    expect(cells(lines(csv)[1]).slice(-4)).toEqual(['2000', '6000', '2000', '2000']);
  });

  it('leaves a phase empty when its boundary was never measured', () => {
    const solve = makeSolve({
      rawMs: 12_000,
      // No cross boundary: cross and F2L are only known together.
      splits: [
        { phase: 'f2l', atMs: 8000, source: 'manual' },
        { phase: 'oll', atMs: 10_000, source: 'manual' },
      ],
    });

    const csv = solvesToCsv(makeData([solve]), format);

    expect(cells(lines(csv)[1]).slice(-4)).toEqual(['', '', '2000', '2000']);
  });

  it('leaves the phase columns empty for a solve timed as a whole', () => {
    const csv = solvesToCsv(makeData([makeSolve()]), format);

    expect(cells(lines(csv)[1]).slice(-4)).toEqual(['', '', '', '']);
  });

  it('survives a solve whose session or method is not in the file', () => {
    const orphan = makeSolve({ sessionId: 'gone' });
    const csv = solvesToCsv(makeData([orphan]), format);
    const row = cells(lines(csv)[1]);

    expect(row[1]).toBe('');
    expect(row.slice(-4)).toEqual(['', '', '', '']);
  });

  it('quotes only what has to be quoted', () => {
    const tags: Tag[] = [
      { id: 'tag-1', name: 'one, handed', color: '#fff', createdAt: 1, updatedAt: 1 },
      { id: 'tag-2', name: 'warm up', color: '#000', createdAt: 1, updatedAt: 1 },
    ];
    const solve = makeSolve({
      note: 'said "no"\nand meant it',
      tagIds: ['tag-1', 'tag-2'],
    });

    const csv = solvesToCsv(makeData([solve], { tags }), format);

    expect(csv).toContain('"said ""no""\nand meant it"');
    expect(csv).toContain('"one, handed|warm up"');
    // The plain fields around them stay plain.
    expect(csv).toContain('t1000,Evening,333,freestyle');
  });

  it('names the drilled case and keeps drill attempts in the file', () => {
    const solve = makeSolve({ mode: 'drill', caseId: 'pll-t' });
    const csv = solvesToCsv(
      makeData([solve], {
        algCases: [
          {
            id: 'pll-t',
            setId: 'pll',
            name: 'T',
            label: null,
            group: null,
            setupAlg: '',
            order: 0,
            isCustom: 0,
            packVersion: 1,
            createdAt: 1,
            updatedAt: 1,
          },
        ],
      }),
      format,
    );
    const row = cells(lines(csv)[1]);

    expect(row[3]).toBe('drill');
    expect(row[4]).toBe('T');
  });

  it('writes the solves oldest first, whatever order they came in', () => {
    const csv = solvesToCsv(
      makeData([
        makeSolve({ id: 'b', createdAt: 3000 }),
        makeSolve({ id: 'a', createdAt: 1000 }),
        makeSolve({ id: 'c', createdAt: 2000 }),
      ]),
      format,
    );

    expect(lines(csv).slice(1).map((line) => cells(line)[0])).toEqual(['t1000', 't2000', 't3000']);
  });
});
