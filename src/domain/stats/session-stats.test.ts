import { describe, expect, it } from 'vitest';
import { SPLITS_SCHEMA_VERSION, type Penalty, type Solve } from '../../db/types';
import {
  GOAL_RECENT_SOLVES,
  PRACTICE_DAYS,
  RECENT_SOLVES,
  sessionStats,
  type SessionStatsInput,
} from './session-stats';

const DAY_MS = 24 * 60 * 60 * 1000;
/** Noon on the day the tests call today. */
const TODAY_NOON = Date.UTC(2031, 2, 14, 12);
const TODAY = '2031-03-14';

/** The reader lives on UTC here, so a day key does not depend on where the tests run. */
const dayKeyOf = (ms: number): string => new Date(ms).toISOString().slice(0, 10);

interface Made {
  penalty?: Penalty;
  sessionId?: string;
  tagIds?: string[];
  /** Whole days before today. */
  daysAgo?: number;
}

let made = 0;

/** A solve as the stats read it; `made` keeps ids and times of day apart. */
function solve(rawMs: number, extra: Made = {}): Solve {
  made += 1;
  const createdAt = TODAY_NOON - (extra.daysAgo ?? 0) * DAY_MS + made;
  return {
    id: `solve-${made}`,
    sessionId: extra.sessionId ?? 'main',
    puzzle: '333',
    mode: 'freestyle',
    caseId: null,
    scramble: `scramble ${made}`,
    scrambleSource: 'generated',
    rawMs,
    penalty: extra.penalty ?? 'none',
    penaltySource: 'manual',
    inspectionMs: null,
    startedAt: createdAt - rawMs,
    splits: [],
    splitsSchemaVersion: SPLITS_SCHEMA_VERSION,
    tagIds: extra.tagIds ?? [],
    note: null,
    starred: 0,
    editedAt: null,
    createdAt,
    updatedAt: createdAt,
  };
}

/** `count` clean solves, each a second slower than the one before, from `fromMs`. */
function run(count: number, fromMs = 10_000, extra: Made = {}): Solve[] {
  return Array.from({ length: count }, (_, index) => solve(fromMs + index * 1000, extra));
}

function stats(solves: Solve[], overrides: Partial<SessionStatsInput> = {}) {
  return sessionStats({
    solves,
    kind: 'session',
    methodId: 'cfop',
    methodBySession: new Map([
      ['main', 'cfop'],
      ['evening', 'cfop'],
      ['blocks', 'roux'],
    ]),
    tagId: null,
    chartWindow: 100,
    goalMs: 0,
    phaseKeys: [],
    globalPb: null,
    todayKey: TODAY,
    dayKeyOf,
    ...overrides,
  });
}

describe('sessionStats', () => {
  describe('with nothing to read', () => {
    const empty = stats([]);

    it('has no numbers, and says so rather than saying zero', () => {
      expect(empty.solveCount).toBe(0);
      expect(empty.availableCount).toBe(0);
      expect(empty.sessionBestMs).toBeNull();
      expect(empty.sessionBestSolveId).toBeNull();
      expect(empty.meanMs).toBeNull();
      expect(empty.medianMs).toBeNull();
      expect(empty.stdDevMs).toBeNull();
      expect(empty.dnfRate).toBeNull();
      expect(empty.windows.map((window) => [window.n, window.current, window.best])).toEqual([
        [5, null, null],
        [12, null, null],
        [50, null, null],
        [100, null, null],
      ]);
    });

    it('draws no trend and no days, and a calendar of thirty empty ones', () => {
      expect(empty.trend).toEqual([]);
      expect(empty.days).toEqual([]);
      expect(empty.practice.days).toHaveLength(PRACTICE_DAYS);
      expect(empty.practice.days.at(-1)?.dayKey).toBe(TODAY);
      expect(empty.practice).toMatchObject({ streak: 0, activeDays: 0, solveCount: 0 });
    });

    it('has no record to list and no window to open', () => {
      expect(empty.recordsFor('single')).toEqual([]);
      expect(empty.recordsFor(5)).toEqual([]);
      expect(empty.averageWindow(5, 'current')).toBeNull();
      expect(empty.averageWindow(5, 'best')).toBeNull();
    });
  });

  describe('the numbers over the solves read', () => {
    it('reads finals, not raw times: a +2 counts with its two seconds, a DNF has no time', () => {
      const read = stats([solve(10_000), solve(11_000, { penalty: 'plus2' }), solve(5000, { penalty: 'dnf' })]);

      expect(read.solveCount).toBe(3);
      expect(read.sessionBestMs).toBe(10_000);
      expect(read.meanMs).toBe(11_500);
      expect(read.dnfRate).toBeCloseTo(1 / 3);
      expect(read.plusTwoRate).toBeCloseTo(1 / 3);
    });

    it('has no best and no mean when every solve is a DNF', () => {
      const read = stats(run(6, 10_000, { penalty: 'dnf' }));

      expect(read.sessionBestMs).toBeNull();
      expect(read.sessionBestSolveId).toBeNull();
      expect(read.meanMs).toBeNull();
      expect(read.dnfRate).toBe(1);
      expect(read.windows[0]).toMatchObject({ n: 5, current: 'dnf', best: 'dnf' });
      // Nothing with a time, so nothing on a time axis.
      expect(read.currentAo12Ms).toBeNull();
      expect(read.recordsFor('single')).toEqual([]);
    });

    it('gives a tied best to the solve that set it, not to the one that matched it', () => {
      const first = solve(9000);
      const read = stats([solve(12_000), first, solve(9000)]);

      expect(read.sessionBestMs).toBe(9000);
      expect(read.sessionBestSolveId).toBe(first.id);
    });

    it.each([
      [4, null, null],
      [5, 12_000, 12_000],
      // Six rising solves: the latest five average a second more than the first five.
      [6, 13_000, 12_000],
    ])('with %i solves, ao5 is %s now and %s at best', (count, current, best) => {
      const read = stats(run(count));
      expect(read.windows[0]).toEqual({ n: 5, current, best });
    });
  });

  describe('whose solves', () => {
    const cfop = run(3, 20_000, { sessionId: 'main' });
    const evening = run(2, 30_000, { sessionId: 'evening' });
    const roux = run(4, 60_000, { sessionId: 'blocks' });
    const everything = [...cfop, ...evening, ...roux];

    it('reads only the method being timed in across sessions', () => {
      const read = stats(everything, { kind: 'all', methodId: 'cfop' });
      expect(read.solveCount).toBe(5);
      expect(read.sessionBestMs).toBe(20_000);

      const other = stats(everything, { kind: 'all', methodId: 'roux' });
      expect(other.solveCount).toBe(4);
      expect(other.sessionBestMs).toBe(60_000);
    });

    it('reads what it is given for one session: that is one method already', () => {
      expect(stats(everything, { kind: 'session', methodId: 'cfop' }).solveCount).toBe(9);
    });

    it('reads everything when there is no session to name a method', () => {
      expect(stats(everything, { kind: 'all', methodId: null }).solveCount).toBe(9);
    });

    it('leaves out a solve whose session is not known, rather than guessing its method', () => {
      const stray = solve(1000, { sessionId: 'gone' });
      expect(stats([...cfop, stray], { kind: 'all', methodId: 'cfop' }).solveCount).toBe(3);
    });
  });

  describe('the latest hundred', () => {
    const many = run(RECENT_SOLVES + 40, 10_000);

    it('reads the last hundred and says how many there were to read', () => {
      const read = stats(many, { kind: 'recent' });

      expect(read.solveCount).toBe(RECENT_SOLVES);
      expect(read.availableCount).toBe(RECENT_SOLVES + 40);
      // The fastest solve of all is the first, and it is not among them.
      expect(read.sessionBestMs).toBe(10_000 + 40 * 1000);
    });

    it('takes the tag first and the hundred after: the last hundred tagged, not the tagged of the last hundred', () => {
      const tagged = run(RECENT_SOLVES + 10, 10_000, { tagIds: ['oh'] });
      const read = stats([...tagged, ...run(RECENT_SOLVES, 90_000)], { kind: 'recent', tagId: 'oh' });

      expect(read.solveCount).toBe(RECENT_SOLVES);
      expect(read.availableCount).toBe(RECENT_SOLVES + 10);
      expect(read.sessionBestMs).toBe(10_000 + 10 * 1000);
    });

    it('still counts practice over every solve there was: the calendar is not a hundred solves long', () => {
      const old = run(120, 10_000, { daysAgo: 3 });
      const fresh = run(RECENT_SOLVES, 10_000);
      const read = stats([...old, ...fresh], { kind: 'recent' });

      expect(read.solveCount).toBe(RECENT_SOLVES);
      expect(read.practice.solveCount).toBe(220);
      expect(read.practice.activeDays).toBe(2);
    });
  });

  describe('the tag', () => {
    it('reads only the solves that carry it', () => {
      const read = stats([solve(10_000, { tagIds: ['oh'] }), solve(5000), solve(12_000, { tagIds: ['oh', 'x'] })], {
        tagId: 'oh',
      });

      expect(read.solveCount).toBe(2);
      expect(read.availableCount).toBe(2);
      expect(read.sessionBestMs).toBe(10_000);
    });

    it('reads nothing for a tag no solve carries', () => {
      expect(stats(run(5), { tagId: 'gone' }).solveCount).toBe(0);
    });
  });

  describe('the trend', () => {
    it('is no trend at all with a single solve', () => {
      expect(stats([solve(10_000)]).trend).toEqual([]);
    });

    it('keeps the solves before the first ao12 as singles under a line still to come', () => {
      const trend = stats(run(13)).trend;

      expect(trend).toHaveLength(13);
      expect(trend.slice(0, 11).every((point) => point.aoMs === null)).toBe(true);
      expect(trend[11]?.aoMs).not.toBeNull();
      expect(trend[0]).toMatchObject({ index: 1, singleMs: 10_000 });
      expect(trend[12]).toMatchObject({ index: 13, singleMs: 22_000 });
    });

    it('draws only the window asked for, numbered by where each solve stands among all of them', () => {
      const trend = stats(run(40), { chartWindow: 25 }).trend;

      expect(trend).toHaveLength(25);
      expect(trend[0]?.index).toBe(16);
      expect(trend.at(-1)?.index).toBe(40);
      // The ao12 at the window's first point reaches back past the window's start.
      expect(trend[0]?.aoMs).not.toBeNull();
    });

    it.each([
      [49, false],
      [50, true],
      [80, true],
    ])('with %i solves, the slow line has reached the last point: %s', (count, reached) => {
      const last = stats(run(count), { chartWindow: 25 }).trend.at(-1);
      expect(last?.longAoMs !== null).toBe(reached);
    });

    it('has the slow line agree with an ao50 worked out over every solve, though it only rolls the window', () => {
      const solves = run(130);
      const windowed = stats(solves, { chartWindow: 25 }).trend;
      const whole = stats(solves, { chartWindow: 1000 }).trend;

      expect(windowed.map((point) => point.longAoMs)).toEqual(whole.slice(-25).map((point) => point.longAoMs));
    });

    it('marks where the session is and its record on the ao12, and neither while the ao12 is a DNF', () => {
      const clean = stats(run(14));
      expect(clean.currentAo12Ms).toBe(clean.trend.at(-1)?.aoMs);
      expect(clean.bestAo12Ms).toBe(clean.trend[11]?.aoMs);

      const broken = stats([...run(10), solve(1000, { penalty: 'dnf' }), solve(1000, { penalty: 'dnf' })]);
      expect(broken.windows[1]).toMatchObject({ n: 12, current: 'dnf' });
      expect(broken.currentAo12Ms).toBeNull();
    });
  });

  describe('today', () => {
    const lastThreeDays = [
      ...run(2, 10_000, { daysAgo: 2 }),
      ...run(3, 10_000, { daysAgo: 1 }),
      ...run(1, 10_000, { daysAgo: 0 }),
    ];

    it('counts the streak back from today', () => {
      const read = stats(lastThreeDays);

      expect(read.practice.streak).toBe(3);
      expect(read.practice.activeDays).toBe(3);
      expect(read.practice.solveCount).toBe(6);
      expect(read.practice.days.slice(-3).map((day) => day.count)).toEqual([2, 3, 1]);
    });

    it('keeps yesterday’s streak alive on a day not yet practised', () => {
      const read = stats(lastThreeDays, { todayKey: '2031-03-15' });

      expect(read.practice.streak).toBe(3);
      expect(read.practice.days.at(-1)).toMatchObject({ dayKey: '2031-03-15', count: 0 });
    });

    it('loses the streak once a whole day has gone by without a solve', () => {
      expect(stats(lastThreeDays, { todayKey: '2031-03-16' }).practice.streak).toBe(0);
    });

    it('lets a solve fall out of the thirty days as today moves on', () => {
      const read = stats(lastThreeDays, { todayKey: '2031-04-12' });
      // The thirty days now begin on the 14th of March: the two days before are gone.
      expect(read.practice.days[0]?.dayKey).toBe('2031-03-14');
      expect(read.practice.solveCount).toBe(1);
    });

    it('files a solve under the day its reader says it was', () => {
      const lateEvening = stats([solve(10_000)], { dayKeyOf: () => '2031-03-13' });
      expect(lateEvening.days.map((day) => day.dayKey)).toEqual(['2031-03-13']);
      expect(lateEvening.practice.days.at(-2)).toMatchObject({ dayKey: '2031-03-13', count: 1 });
    });

    it('sums each day up: how many, their mean and their best', () => {
      const read = stats([
        solve(10_000, { daysAgo: 1 }),
        solve(14_000, { daysAgo: 1 }),
        solve(3000, { daysAgo: 1, penalty: 'dnf' }),
        solve(20_000),
      ]);

      expect(read.days).toMatchObject([
        { dayKey: '2031-03-13', count: 3, meanMs: 12_000, bestMs: 10_000 },
        { dayKey: TODAY, count: 1, meanMs: 20_000, bestMs: 20_000 },
      ]);
      expect((read.days[1]?.day ?? 0) - (read.days[0]?.day ?? 0)).toBe(1);
    });
  });

  describe('the goal', () => {
    it.each([[0], [-1]])('is no goal at %i', (goalMs) => {
      expect(stats(run(5), { goalMs }).goal).toBeNull();
    });

    it('says how often it was beaten, over everything and over the latest fifty', () => {
      // Sixty slow solves, then fifty of which every second one is fast.
      const slow = run(60, 40_000);
      const lately = Array.from({ length: GOAL_RECENT_SOLVES }, (_, index) => solve(index % 2 === 0 ? 20_000 : 40_000));
      const goal = stats([...slow, ...lately], { goalMs: 30_000 }).goal;

      expect(goal).toMatchObject({ goalMs: 30_000, recentRate: 0.5, recentCount: GOAL_RECENT_SOLVES });
      expect(goal?.allRate).toBeCloseTo(25 / 110);
    });

    it('measures lately over what there is while there are fewer than fifty', () => {
      expect(stats(run(7), { goalMs: 30_000 }).goal).toMatchObject({ recentCount: 7, allRate: 1, recentRate: 1 });
    });
  });

  describe('the records', () => {
    // 20, 18, 19, 15, 16, 15: the record falls at the second and the fourth, and is only matched at the sixth.
    const times = [20_000, 18_000, 19_000, 15_000, 16_000, 15_000].map((ms) => solve(ms));
    const read = stats(times);

    it('lists every time the single fell, newest first, with what it took off', () => {
      expect(read.recordsFor('single')).toEqual([
        { ms: 15_000, improvementMs: 3000, at: times[3]?.createdAt, solveId: times[3]?.id, endIndex: 3 },
        { ms: 18_000, improvementMs: 2000, at: times[1]?.createdAt, solveId: times[1]?.id, endIndex: 1 },
        { ms: 20_000, improvementMs: null, at: times[0]?.createdAt, solveId: times[0]?.id, endIndex: 0 },
      ]);
    });

    it('names an average’s record by the last solve of its window', () => {
      const [first] = read.recordsFor(5).slice(-1);
      expect(first).toMatchObject({ endIndex: 4, solveId: times[4]?.id, improvementMs: null });
    });

    it('works a kind out once and hands the same list back', () => {
      expect(read.recordsFor(5)).toBe(read.recordsFor(5));
      expect(read.recordsFor('single')).toBe(read.recordsFor('single'));
    });
  });

  describe('the window behind an average', () => {
    // Fast at the start, slow at the end: the best five are the first five.
    const solves = [...run(5, 10_000), ...run(5, 30_000)];
    const read = stats(solves);

    it('opens the latest, the best, and the one ending at a given solve', () => {
      expect(read.averageWindow(5, 'current')?.solves.map((entry) => entry.id)).toEqual(
        solves.slice(5).map((entry) => entry.id),
      );
      expect(read.averageWindow(5, 'best')?.solves.map((entry) => entry.id)).toEqual(
        solves.slice(0, 5).map((entry) => entry.id),
      );
      expect(read.averageWindow(5, { endIndex: 6 })?.solves.map((entry) => entry.id)).toEqual(
        solves.slice(2, 7).map((entry) => entry.id),
      );
    });

    it('says which solves the trim cut, and carries what a shared average needs', () => {
      const window = read.averageWindow(5, 'best');

      expect(window).toMatchObject({ n: 5, at: 'best', average: 12_000, trim: 1 });
      expect(window?.solves.map((entry) => entry.isTrimmed)).toEqual([true, false, false, false, true]);
      expect(window?.solves[0]).toMatchObject({ resultMs: 10_000, penalty: 'none', scramble: solves[0]?.scramble });
    });

    it.each([
      ['a window longer than the solves', 12, 'current' as const],
      ['a best that does not exist yet', 12, 'best' as const],
      ['a window that would begin before the first solve', 5, { endIndex: 2 }],
      ['a window that would end after the last', 5, { endIndex: 10 }],
    ])('has nothing to open for %s', (_, n, at) => {
      expect(read.averageWindow(n === 12 ? 12 : 5, at)).toBeNull();
    });

    it('shows a DNF as having no time, and the average as a DNF when two of them are in it', () => {
      const broken = stats([solve(10_000), solve(1000, { penalty: 'dnf' }), solve(12_000), solve(1000, { penalty: 'dnf' }), solve(14_000)]);
      const window = broken.averageWindow(5, 'current');

      expect(window?.average).toBe('dnf');
      expect(window?.solves.map((entry) => entry.resultMs)).toEqual([10_000, null, 12_000, null, 14_000]);
    });
  });

  describe('the best of the method', () => {
    it('is handed in, and may well belong to a solve that is not among those read', () => {
      const elsewhere = solve(7000, { sessionId: 'evening' });
      const read = stats(run(3), { globalPb: elsewhere });

      expect(read.globalPbMs).toBe(7000);
      expect(read.globalPbSolveId).toBe(elsewhere.id);
      expect(read.sessionBestMs).toBe(10_000);
    });

    it('counts its penalty', () => {
      expect(stats([], { globalPb: solve(7000, { penalty: 'plus2' }) }).globalPbMs).toBe(9000);
    });

    it('is nothing while there is none', () => {
      expect(stats(run(3))).toMatchObject({ globalPbMs: null, globalPbSolveId: null });
    });
  });

  describe('the phases', () => {
    const phased = (rawMs: number): Solve => ({
      ...solve(rawMs),
      splits: [
        { phase: 'cross', atMs: Math.round(rawMs * 0.2), source: 'manual' },
        { phase: 'f2l', atMs: Math.round(rawMs * 0.6), source: 'manual' },
        { phase: 'oll', atMs: Math.round(rawMs * 0.8), source: 'manual' },
        { phase: 'pll', atMs: rawMs, source: 'manual' },
      ],
    });
    const keys = ['cross', 'f2l', 'oll', 'pll'];

    it('counts the solves timed by phase, whatever the method names', () => {
      expect(stats([phased(10_000), solve(9000), phased(12_000)]).measuredCount).toBe(2);
    });

    it('has no rows without a method to name the phases', () => {
      expect(stats([phased(10_000)], { phaseKeys: [] }).phaseRows).toEqual([]);
      expect(stats([phased(10_000)], { phaseKeys: keys }).phaseRows.length).toBeGreaterThan(0);
    });

    it('draws the phase trend over the same window as the trend above it', () => {
      const solves = Array.from({ length: 30 }, (_, index) => phased(20_000 + index * 100));
      expect(stats(solves, { phaseKeys: keys, chartWindow: 10 }).phaseTrend).toHaveLength(10);
    });
  });

  it('changes nothing it is given', () => {
    const solves = run(20);
    for (const entry of solves) {
      Object.freeze(entry.tagIds);
      Object.freeze(entry.splits);
      Object.freeze(entry);
    }
    const frozen = Object.freeze(solves);

    const read = sessionStats({
      solves: frozen,
      kind: 'all',
      methodId: 'cfop',
      methodBySession: new Map([['main', 'cfop']]),
      tagId: null,
      chartWindow: 10,
      goalMs: 15_000,
      phaseKeys: ['cross'],
      globalPb: null,
      todayKey: TODAY,
      dayKeyOf,
    });
    read.recordsFor(5);
    read.averageWindow(12, 'best');

    expect(read.solveCount).toBe(20);
  });
});
