/**
 * Solves by the day they were done on. Days come in as keys (YYYY-MM-DD, see
 * dayKey in lib/format): which day a timestamp belongs to depends on the
 * reader's timezone, and that is not a question for this layer.
 */

export interface DayEntry {
  dayKey: string;
  /** null is a DNF. */
  finalMs: number | null;
}

export interface DaySummary {
  dayKey: string;
  /** Every solve of the day, DNFs included. */
  count: number;
  /** Mean of the day's finished solves; null when every one was a DNF. */
  meanMs: number | null;
  bestMs: number | null;
}

/**
 * One summary per day that has solves, in the order the days first appear —
 * oldest first for chronological entries.
 *
 * A plain mean rather than a trimmed average: a day of three solves has no
 * ends to trim, and one number that means the same thing on every day is
 * worth more on a chart than a better number that changes meaning with the
 * day's size.
 */
export function summariseDays(entries: readonly DayEntry[]): DaySummary[] {
  const days = new Map<string, { count: number; sum: number; finished: number; bestMs: number | null }>();
  for (const { dayKey, finalMs } of entries) {
    const day = days.get(dayKey) ?? { count: 0, sum: 0, finished: 0, bestMs: null };
    day.count += 1;
    if (finalMs !== null) {
      day.sum += finalMs;
      day.finished += 1;
      if (day.bestMs === null || finalMs < day.bestMs) day.bestMs = finalMs;
    }
    days.set(dayKey, day);
  }
  return [...days].map(([dayKey, day]) => ({
    dayKey,
    count: day.count,
    meanMs: day.finished === 0 ? null : Math.round(day.sum / day.finished),
    bestMs: day.bestMs,
  }));
}

const MS_PER_DAY = 86_400_000;

/**
 * A day key as a whole number of days, so that two keys can be counted apart
 * and laid out on an axis with the gaps between practice left in. Through UTC
 * on purpose: a key is a calendar date, and a calendar date has no clock
 * change in it.
 */
export function dayNumber(dayKey: string): number {
  const [year = 0, month = 1, day = 1] = dayKey.split('-').map(Number);
  return Math.round(Date.UTC(year, month - 1, day) / MS_PER_DAY);
}

/** The key of a day number — dayNumber's way back. */
export function dayKeyOf(number: number): string {
  return new Date(number * MS_PER_DAY).toISOString().slice(0, 10);
}

/** The `count` calendar days ending with `lastKey`, oldest first, practised or not. */
export function calendarDays(lastKey: string, count: number): string[] {
  const last = dayNumber(lastKey);
  return Array.from({ length: count }, (_, index) => dayKeyOf(last - count + 1 + index));
}

/**
 * Days in a row with at least one solve, ending today. A day not yet
 * practised does not break the streak before it: at breakfast, yesterday's
 * run is still alive and only needs today to carry on.
 */
export function practiceStreak(practisedKeys: ReadonlySet<string>, todayKey: string): number {
  let day = dayNumber(todayKey);
  if (!practisedKeys.has(todayKey)) day -= 1;
  let streak = 0;
  while (practisedKeys.has(dayKeyOf(day))) {
    streak += 1;
    day -= 1;
  }
  return streak;
}
