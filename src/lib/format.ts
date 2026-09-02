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

/** null means DNF everywhere in the app. */
export function formatTime(ms: number | null): string {
  return ms === null ? 'DNF' : formatMs(ms);
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
  return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString();
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

export { MS_PER_MINUTE, MS_PER_SECOND };
