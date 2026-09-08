import { describe, expect, it } from 'vitest';
import {
  csTimerSolveKey,
  parseCsTimerCsv,
  parseCsTimerJson,
  parseCsvTime,
  planCsTimerImport,
} from './cstimer';

/**
 * Real exports, byte for byte, from csTimer's Export/Import → "Export to
 * file". Everything else in here is built to the shape csTimer's own source
 * writes; these two are the ground truth the parser was written against.
 */
import REAL_EXPORT from '../../test/fixtures/cstimer-export-one-solve.txt?raw';
import REAL_PHASES from '../../test/fixtures/cstimer-export-phases.txt?raw';
import REAL_CSV from '../../test/fixtures/cstimer-export-session.csv?raw';

function json(sessions: Record<string, unknown>, sessionData?: Record<string, unknown>): string {
  return JSON.stringify({
    session1: [],
    ...sessions,
    properties: { sessionData: JSON.stringify(sessionData ?? {}) },
  });
}

/** [[penalty, phase ends…], scramble, comment, unix seconds]. */
function record(
  times: number[],
  overrides: { scramble?: string; comment?: string; at?: number } = {},
): unknown {
  return [
    times,
    overrides.scramble ?? "R U R' U'",
    overrides.comment ?? '',
    overrides.at ?? 1_788_509_385,
  ];
}

function firstSolve(text: string) {
  const parsed = parseCsTimerJson(text);
  if (!parsed.ok) throw new Error(`expected a readable file, got ${parsed.problem}`);
  const session = parsed.file.sessions[0];
  if (session === undefined) throw new Error('expected a session');
  return { session, solve: session.solves[0], skipped: parsed.file.skipped };
}

describe('parseCsTimerJson', () => {
  it('reads a real export', () => {
    const parsed = parseCsTimerJson(REAL_EXPORT);

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.file.sessions).toHaveLength(1);
    expect(parsed.file.sessions[0]).toMatchObject({
      // A default session is named by a number, and JSON keeps it one.
      name: '1',
      puzzle: '333',
    });
    expect(parsed.file.sessions[0]?.solves[0]).toEqual({
      rawMs: 2056,
      penalty: 'none',
      scramble: "D' R F2 B2 L F' R U2 B' U2 B2 R2 B2 U2 R2 D' L2 F2 R2",
      note: null,
      startedAt: 1_788_509_385_000,
      phaseEndsMs: [],
      phaseCount: 1,
    });
    expect(parsed.file.skipped).toEqual([]);
  });

  it('reads a real export of a session that was timed by phase', () => {
    const parsed = parseCsTimerJson(REAL_PHASES);

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.file.skipped).toEqual([]);

    const solves = parsed.file.sessions[0]?.solves ?? [];
    expect(
      solves.map((solve) => [solve.rawMs, solve.penalty, solve.phaseCount, solve.note]),
    ).toEqual([
      // A DNF keeps the time it was, and the comment with it.
      [2056, 'dnf', 1, 'comment test'],
      [12_778, 'none', 1, null],
      [29_496, 'none', 4, null],
      // Deliberately timed in five phases; csTimer allows up to ten.
      [32_706, 'plus2', 5, null],
      [29_248, 'none', 4, null],
    ]);
  });

  it('turns a real four-phase solve into boundaries that add up', () => {
    const parsed = parseCsTimerJson(REAL_PHASES);
    if (!parsed.ok) throw new Error('unreadable');
    const solve = parsed.file.sessions[0]?.solves[2];

    // csTimer stored [29496, 23081, 16416, 6320]: the last tap first.
    expect(solve?.phaseEndsMs).toEqual([6320, 16_416, 23_081]);
    // Which is a 6.32s cross, 10.10s F2L, 6.67s OLL and a 6.42s PLL.
    const lengths = [...(solve?.phaseEndsMs ?? []), solve?.rawMs ?? 0].map(
      (end, index, all) => end - (index === 0 ? 0 : (all[index - 1] ?? 0)),
    );
    expect(lengths).toEqual([6320, 10_096, 6665, 6415]);
  });

  it('keeps the name and the puzzle csTimer gave the session', () => {
    const text = json(
      { session2: [record([0, 5000])] },
      { 2: { name: 'Evening 2×2', opt: { scrType: '222so' }, rank: 1 } },
    );

    const { session } = firstSolve(text);
    expect(session.name).toBe('Evening 2×2');
    expect(session.puzzle).toBe('222');
  });

  it.each([
    { scrType: '333oh', puzzle: '333' },
    { scrType: '444wca', puzzle: '444' },
    { scrType: 'pyrso', puzzle: 'pyram' },
    { scrType: 'skbso', puzzle: 'skewb' },
    { scrType: 'clkwca', puzzle: 'clock' },
    { scrType: 'mgmp', puzzle: 'minx' },
    { scrType: 'sqrs', puzzle: 'sq1' },
    // Nothing in this app is a 6×6, and pretending otherwise would be worse
    // than saying so.
    { scrType: '666wca', puzzle: null },
    { scrType: 'r3ni', puzzle: null },
  ])('maps the scramble type $scrType to $puzzle', ({ scrType, puzzle }) => {
    const text = json({ session1: [record([0, 5000])] }, { 1: { name: 'S', opt: { scrType } } });
    expect(firstSolve(text).session.puzzle).toBe(puzzle);
  });

  it('takes a +2 as the raw time plus a penalty, not as the slower time', () => {
    const text = json({ session1: [record([2000, 12_340])] });
    // csTimer shows 14.34; the number it stores is the 12.34 that was turned.
    expect(firstSolve(text).solve).toMatchObject({ rawMs: 12_340, penalty: 'plus2' });
  });

  it('keeps the time of a DNF, so the penalty can be taken back', () => {
    const text = json({ session1: [record([-1, 12_340])] });
    expect(firstSolve(text).solve).toMatchObject({ rawMs: 12_340, penalty: 'dnf' });
  });

  it('skips a penalty it cannot express rather than inventing a time', () => {
    const text = json({ session1: [record([500, 12_340]), record([0, 9000])] });
    const { session, skipped } = firstSolve(text);

    expect(session.solves).toHaveLength(1);
    expect(skipped).toEqual([{ session: '1', index: 1, reason: 'unreadablePenalty' }]);
  });

  it('turns csTimer’s backwards phase list into boundaries in method order', () => {
    // Four phases: 2s cross, 6s F2L, 2s OLL, 2s PLL. csTimer writes the last
    // tap first, so the array is [penalty, total, oll end, f2l end, cross end].
    const text = json({ session1: [record([0, 12_000, 10_000, 8000, 2000])] });

    expect(firstSolve(text).solve).toMatchObject({
      rawMs: 12_000,
      phaseCount: 4,
      phaseEndsMs: [2000, 8000, 10_000],
    });
  });

  it('reads a two-phase solve as two phases, not as four', () => {
    const text = json({ session1: [record([0, 12_000, 5000])] });
    expect(firstSolve(text).solve).toMatchObject({ phaseCount: 2, phaseEndsMs: [5000] });
  });

  it('drops phases that do not add up, and keeps the solve', () => {
    // A boundary past the end of the solve: the phases are unusable, the time
    // is not.
    const text = json({ session1: [record([0, 12_000, 14_000, 2000])] });
    expect(firstSolve(text).solve).toMatchObject({
      rawMs: 12_000,
      phaseCount: 1,
      phaseEndsMs: [],
    });
  });

  it.each([
    { label: 'not an array', row: 'nonsense', reason: 'malformed' },
    { label: 'too short', row: [[0, 1000], 'scramble'], reason: 'malformed' },
    { label: 'no times', row: [[], 's', '', 1], reason: 'malformed' },
    { label: 'a text time', row: [[0, '12.34'], 's', '', 1], reason: 'unreadableTime' },
    { label: 'no date', row: [[0, 1000], 's', '', null], reason: 'unreadableDate' },
  ])('skips a row that is $label and imports the rest', ({ row, reason }) => {
    const text = json({ session1: [row, record([0, 9000])] });
    const { session, skipped } = firstSolve(text);

    expect(session.solves).toHaveLength(1);
    expect(skipped).toEqual([{ session: '1', index: 1, reason }]);
  });

  it('keeps a solve whose scramble or comment went missing', () => {
    const text = json({ session1: [[[0, 9000], null, undefined, 1_788_509_385]] });
    expect(firstSolve(text).solve).toMatchObject({ scramble: '', note: null });
  });

  it('reads a comment as a note', () => {
    const text = json({ session1: [record([0, 9000], { comment: '  bad F2L  ' })] });
    expect(firstSolve(text).solve?.note).toBe('bad F2L');
  });

  it('leaves out the sessions that hold nothing', () => {
    const parsed = parseCsTimerJson(REAL_EXPORT);
    expect(parsed.ok && parsed.file.sessions.map((session) => session.name)).toEqual(['1']);
  });

  it('lists the sessions in csTimer’s own order', () => {
    const text = JSON.stringify({
      session1: [record([0, 1000])],
      session2: [record([0, 2000])],
      properties: {
        sessionData: JSON.stringify({
          1: { name: 'second', rank: 2 },
          2: { name: 'first', rank: 1 },
        }),
      },
    });

    const parsed = parseCsTimerJson(text);
    expect(parsed.ok && parsed.file.sessions.map((session) => session.name)).toEqual([
      'first',
      'second',
    ]);
  });

  it('copes with session metadata that is missing or damaged', () => {
    const text = JSON.stringify({
      session3: [record([0, 1000])],
      properties: { sessionData: '{not json' },
    });

    const { session } = firstSolve(text);
    expect(session.name).toBe('3');
    expect(session.puzzle).toBe('333');
  });

  it.each([
    { label: 'not JSON at all', text: 'hello', problem: 'notJson' },
    { label: 'JSON but not csTimer', text: '{"format":"rubix-export"}', problem: 'notCsTimer' },
    { label: 'an export with nothing in it', text: json({}), problem: 'empty' },
  ])('refuses $label', ({ text, problem }) => {
    const parsed = parseCsTimerJson(text);
    expect(parsed.ok).toBe(false);
    expect(!parsed.ok && parsed.problem).toBe(problem);
  });
});

describe('planCsTimerImport', () => {
  function planOf(text: string, known: string[] = []) {
    const parsed = parseCsTimerJson(text);
    if (!parsed.ok) throw new Error(`unreadable file: ${parsed.problem}`);
    return planCsTimerImport(parsed.file, new Set(known), 4);
  }

  it('counts what a real export would bring in, phases included', () => {
    const plan = planOf(REAL_PHASES);

    expect(plan.newSolves).toBe(5);
    // Two solves were timed in four phases; the one timed in five keeps its
    // time and loses its phases, and the preview has to say so.
    expect(plan.withPhases).toBe(2);
    expect(plan.phasesDropped).toBe(1);
    expect(plan.duplicates).toBe(0);
  });

  it('does not count a solve timed as a whole as one that lost its phases', () => {
    const plan = planOf(json({ session1: [record([0, 9000]), record([0, 8000, 4000])] }));

    expect(plan.withPhases).toBe(0);
    expect(plan.phasesDropped).toBe(1);
  });

  it('counts a solve it already has as a duplicate instead of importing it', () => {
    const plan = planOf(REAL_PHASES, [csTimerSolveKey(12_778, 1_788_852_912_000)]);

    expect(plan.newSolves).toBe(4);
    expect(plan.duplicates).toBe(1);
  });

  it('brings a solve in once even when the file lists it twice', () => {
    const twice = record([0, 9000], { at: 1_788_509_385 });
    const plan = planOf(json({ session1: [twice, twice] }));

    expect(plan.newSolves).toBe(1);
    expect(plan.duplicates).toBe(1);
  });
});

/* The CSV export of a single session. */

const CSV_HEAD = 'No.;Time;Comment;Scramble;Date;P.1;P.2;P.3;P.4';

function csv(...lines: string[]): string {
  return [CSV_HEAD, ...lines].join('\r\n');
}

function csvSolves(text: string) {
  const parsed = parseCsTimerCsv(text, 'Evening', '333');
  if (!parsed.ok) throw new Error(`expected a readable file, got ${parsed.problem}`);
  return { solves: parsed.file.sessions[0]?.solves ?? [], skipped: parsed.file.skipped };
}

/** The same wall clock csTimer wrote, read in whatever zone the test runs in. */
function localMs(year: number, month: number, day: number, h: number, m: number, s: number) {
  return new Date(year, month - 1, day, h, m, s).getTime();
}

describe('parseCsTimerCsv', () => {
  it('reads a real CSV export of a session', () => {
    // Times to the millisecond (csTimer's useMilli), a header with a column
    // for every phase the session ever used, and no newline at the end.
    const parsed = parseCsTimerCsv(REAL_CSV, 'Evening', '333');

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.file.skipped).toEqual([]);
    expect(parsed.file.sessions[0]?.solves).toEqual([
      {
        rawMs: 29_248,
        penalty: 'none',
        scramble: "B L' D' F' L B U' R' L2 F2 U2 L2 F R2 B U2 R2 F L2 B2",
        note: null,
        startedAt: localMs(2026, 9, 8, 9, 41, 57),
        // 7.303 + 5.121 + 6.023 = the three interior boundaries; the fourth
        // phase is closed by the solve itself.
        phaseEndsMs: [7303, 12_424, 18_447],
        phaseCount: 4,
      },
    ]);
  });

  it('ignores the phase columns a session never filled', () => {
    // The header of a real export has a column for the longest solve of the
    // session — five here — and a four-phase solve leaves the last one empty.
    const parsed = parseCsTimerCsv(REAL_CSV, 'Evening', '333');
    if (!parsed.ok) throw new Error('unreadable');

    expect(parsed.file.sessions[0]?.solves[0]?.phaseCount).toBe(4);
  });

  it('reads a row into a solve', () => {
    const { solves } = csvSolves(csv('1;2.05;;R U R\' U\';2026-09-07 17:09:45;;;;'));

    expect(solves[0]).toEqual({
      rawMs: 2050,
      penalty: 'none',
      scramble: "R U R' U'",
      note: null,
      startedAt: localMs(2026, 9, 7, 17, 9, 45),
      phaseEndsMs: [],
      phaseCount: 1,
    });
  });

  it('takes the +2 back off the displayed time', () => {
    const { solves } = csvSolves(csv('1;14.34+;;scr;2026-09-07 17:09:45'));
    expect(solves[0]).toMatchObject({ rawMs: 12_340, penalty: 'plus2' });
  });

  it('reads a DNF with the time it hides', () => {
    const { solves } = csvSolves(csv('1;DNF(12.34);;scr;2026-09-07 17:09:45'));
    expect(solves[0]).toMatchObject({ rawMs: 12_340, penalty: 'dnf' });
  });

  it('adds phase lengths up into boundaries', () => {
    const { solves } = csvSolves(csv('1;12.00;;scr;2026-09-07 17:09:45;2.00;6.00;2.00;2.00'));
    expect(solves[0]).toMatchObject({ phaseCount: 4, phaseEndsMs: [2000, 8000, 10_000] });
  });

  it('stops at the first phase column csTimer left empty', () => {
    const { solves } = csvSolves(csv('1;12.00;;scr;2026-09-07 17:09:45;5.00;7.00;;'));
    expect(solves[0]).toMatchObject({ phaseCount: 2, phaseEndsMs: [5000] });
  });

  it('reads a quoted comment with a semicolon and a newline in it', () => {
    const { solves } = csvSolves(
      csv('1;2.05;"one; two\nthree";R U;2026-09-07 17:09:45'),
    );
    expect(solves[0]?.note).toBe('one; two\nthree');
  });

  it('reads minutes and hours', () => {
    const { solves } = csvSolves(
      csv('1;1:23.45;;scr;2026-09-07 17:09:45', '2;1:02:03.45;;scr;2026-09-07 17:09:45'),
    );
    expect(solves.map((solve) => solve.rawMs)).toEqual([83_450, 3_723_450]);
  });

  it('skips the rows it cannot read and keeps the rest', () => {
    const { solves, skipped } = csvSolves(
      csv('1;nonsense;;scr;2026-09-07 17:09:45', '2;2.05;;scr;not a date', '3;2.05;;scr;2026-09-07 17:09:45'),
    );

    expect(solves).toHaveLength(1);
    expect(skipped).toEqual([
      { session: 'Evening', index: 1, reason: 'unreadableTime' },
      { session: 'Evening', index: 2, reason: 'unreadableDate' },
    ]);
  });

  it('refuses a file that is not csTimer’s CSV', () => {
    const parsed = parseCsTimerCsv('a,b,c\n1,2,3', 'Evening', '333');
    expect(!parsed.ok && parsed.problem).toBe('notCsv');
  });
});

describe('parseCsvTime', () => {
  it.each([
    { input: '2.05', rawMs: 2050, penalty: 'none' },
    { input: '2.056', rawMs: 2056, penalty: 'none' },
    { input: '14.34+', rawMs: 12_340, penalty: 'plus2' },
    { input: 'DNF(12.34)', rawMs: 12_340, penalty: 'dnf' },
    { input: 'DNF', rawMs: 0, penalty: 'dnf' },
  ])('reads $input', ({ input, rawMs, penalty }) => {
    expect(parseCsvTime(input)).toEqual({ rawMs, penalty });
  });

  it.each(['', 'nonsense', '1.5+'])('refuses %s', (input) => {
    expect(parseCsvTime(input)).toBeNull();
  });
});
