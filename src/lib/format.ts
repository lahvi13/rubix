import type { Penalty } from '../db/types';
import { strings } from './strings';

const MS_PER_SECOND = 1000;
const MS_PER_MINUTE = 60 * MS_PER_SECOND;

/**
 * Times are truncated, not rounded, to hundredths — a 12.999 solve is shown as
 * 12.99, the same as every other cubing timer. Rounding up would let the
 * display claim a time that was never reached.
 */
export function formatMs(ms: number): string {
  const centiseconds = Math.floor(ms / 10);
  const totalSeconds = Math.floor(centiseconds / 100);
  const hundredths = centiseconds % 100;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  const fraction = String(hundredths).padStart(2, '0');
  if (minutes === 0) return `${seconds}.${fraction}`;
  return `${minutes}:${String(seconds).padStart(2, '0')}.${fraction}`;
}

/**
 * A time as a tick on an axis. Hundredths are noise at axis density, and the
 * shape is decided once per axis by its largest value rather than per tick —
 * an axis that reads "40.00, 50.00, 1:00.00" makes the reader work out twice
 * which of those is bigger.
 *
 * Over a minute the whole axis is `m:ss`; under it, seconds with one decimal
 * only when the steps need one.
 */
export function formatAxisMs(ms: number, axisMaxMs: number): string {
  if (axisMaxMs >= MS_PER_MINUTE) {
    const totalSeconds = Math.round(ms / MS_PER_SECOND);
    const minutes = Math.floor(totalSeconds / 60);
    return `${minutes}:${String(totalSeconds % 60).padStart(2, '0')}`;
  }
  const seconds = ms / MS_PER_SECOND;
  return Number.isInteger(seconds) ? String(seconds) : seconds.toFixed(1);
}

const DATE_FORMATS = {
  clock: { hour: '2-digit', minute: '2-digit' },
  date: {},
  dayMonth: { day: 'numeric', month: 'numeric' },
  dayMonthYear: { day: 'numeric', month: 'numeric', year: 'numeric' },
} satisfies Record<string, Intl.DateTimeFormatOptions>;

const formatters = new Map<keyof typeof DATE_FORMATS, Intl.DateTimeFormat>();

/**
 * Each formatter is made once and kept. Making one is the slow part of
 * toLocaleDateString, and the lists ask for a date on every row of every
 * render: after a solve, with thousands in the database, that was a fifth of
 * a second of a phone's main thread spent building the same formatter.
 */
function formatter(name: keyof typeof DATE_FORMATS): Intl.DateTimeFormat {
  const known = formatters.get(name);
  if (known !== undefined) return known;
  const made = new Intl.DateTimeFormat([], DATE_FORMATS[name]);
  formatters.set(name, made);
  return made;
}

/** A day key as a short date for an axis or a readout: "14. 9." in Czech, "9/14" in English. */
export function formatDayKey(key: string, withYear = false): string {
  const [year = 0, month = 1, day = 1] = key.split('-').map(Number);
  return formatter(withYear ? 'dayMonthYear' : 'dayMonth').format(new Date(year, month - 1, day));
}

/**
 * A goal the way it is said out loud — "sub 1:30", "sub 45" — with the
 * hundredths only when the goal really has some.
 */
export function formatGoal(ms: number): string {
  return ms % MS_PER_SECOND === 0 ? formatAxisMs(ms, ms) : formatMs(ms);
}

/**
 * The same time, split where the eye splits it: the seconds are what is read
 * at a glance and the hundredths are what is noted afterwards.
 */
export function formatMsParts(ms: number): { seconds: string; hundredths: string } {
  const [seconds = '0', hundredths = '00'] = formatMs(ms).split('.');
  return { seconds, hundredths };
}

/** null means DNF everywhere in the app. */
export function formatTime(ms: number | null): string {
  return ms === null ? 'DNF' : formatMs(ms);
}

/**
 * A solve's result as a list writes it: the time with its +2 already in, and
 * a mark saying so — the csTimer way. Without the mark a +2 is a clean solve
 * two seconds slower, which is exactly what it is not.
 */
export function formatResult(resultMs: number | null, penalty: Penalty): string {
  if (resultMs === null) return formatTime(null);
  return penalty === 'plus2' ? `${formatMs(resultMs)}+` : formatMs(resultMs);
}

/**
 * Averages have one more state than plain times: null means the window never
 * filled, which is an em dash, not a DNF.
 */
export function formatAverage(value: number | 'dnf' | null): string {
  if (value === null) return '—';
  if (value === 'dnf') return 'DNF';
  return formatMs(value);
}

/** Rates are fractions 0..1; null (no solves) renders as an em dash. */
export function formatRate(rate: number | null): string {
  return rate === null ? '—' : `${Math.round(rate * 100)}%`;
}

/** Inspection counts down and is shown in whole seconds. */
export function formatInspection(elapsedMs: number, limitMs: number): string {
  const remaining = Math.ceil((limitMs - elapsedMs) / MS_PER_SECOND);
  return remaining > 0 ? String(remaining) : '+2';
}

export function formatClock(timestamp: number): string {
  return formatter('clock').format(timestamp);
}

export function formatDate(timestamp: number): string {
  return formatter('date').format(timestamp);
}

/**
 * When a solve happened, in as much detail as it needs: today's are told apart
 * by the clock alone, and anything older needs the day — otherwise a list of
 * times says nothing about whether it was this session or last week.
 */
export function formatWhen(timestamp: number, at: number): string {
  const when = new Date(timestamp);
  const now = new Date(at);

  if (isSameDay(when, now)) return formatClock(timestamp);

  // A year is only worth the room once the list reaches back into another one.
  const day = formatter(
    when.getFullYear() === now.getFullYear() ? 'dayMonth' : 'dayMonthYear',
  ).format(when);
  return `${day} ${formatClock(timestamp)}`;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/**
 * A day as a heading names it. The two a reader looks for most are said in
 * words, since "14. 9. 2026" has to be worked out against the calendar before
 * it means this morning.
 */
export function formatDay(timestamp: number, at: number): string {
  const when = new Date(timestamp);
  const now = new Date(at);
  // The day before by the calendar, not 24 hours back: a clock change makes
  // one day in the year 23 hours long and another 25.
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);

  if (isSameDay(when, now)) return strings.history.today;
  if (isSameDay(when, yesterday)) return strings.history.yesterday;
  return formatDate(timestamp);
}

export function formatDateTime(timestamp: number): string {
  return `${formatDate(timestamp)} ${formatClock(timestamp)}`;
}

/**
 * Local calendar day as YYYY-MM-DD. Used in export file names, where a locale
 * date would put slashes into a file name and sort backups randomly.
 */
export function formatIsoDate(timestamp: number): string {
  const date = new Date(timestamp);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/**
 * Local date and time as `YYYY-MM-DD HH:MM:SS`, for a spreadsheet rather than
 * a reader: it sorts as text, every locale reads it the same way, and it is
 * the one format Excel and Sheets both parse without being asked.
 */
export function formatIsoDateTime(timestamp: number): string {
  const date = new Date(timestamp);
  const clock = [date.getHours(), date.getMinutes(), date.getSeconds()]
    .map((part) => String(part).padStart(2, '0'))
    .join(':');
  return `${formatIsoDate(timestamp)} ${clock}`;
}

const BYTES_PER_KB = 1024;
const BYTES_PER_MB = 1024 * BYTES_PER_KB;
const BYTES_PER_GB = 1024 * BYTES_PER_MB;

/**
 * A size as a reader weighs it: one decimal while it is small enough for the
 * decimal to matter, none after. Never "0 KB" — something is stored.
 */
export function formatBytes(bytes: number): string {
  // Decided on the rounded figure, or a size just short of a megabyte reads "1024 KB".
  const kb = Math.max(1, Math.round(bytes / BYTES_PER_KB));
  if (kb < 1024) return `${kb} KB`;
  const mb = bytes / BYTES_PER_MB;
  if (Math.round(mb) < 1024) return `${roughly(mb)} MB`;
  return `${roughly(bytes / BYTES_PER_GB)} GB`;
}

function roughly(value: number): string {
  return value < 10 ? value.toFixed(1) : String(Math.round(value));
}

export { MS_PER_MINUTE, MS_PER_SECOND };
/**
 * The day a timestamp falls on, in the reader's own timezone, as something
 * two timestamps can be compared by. Not a formatted date: this is the key a
 * list groups by, and it has to sort and match exactly.
 *
 * Local rather than UTC, because a solve at eleven at night belongs to the
 * evening it happened in and not to the next morning.
 */
export function dayKey(ms: number): string {
  const at = new Date(ms);
  const month = String(at.getMonth() + 1).padStart(2, '0');
  const day = String(at.getDate()).padStart(2, '0');
  return `${at.getFullYear()}-${month}-${day}`;
}
