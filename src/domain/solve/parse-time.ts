/**
 * Parses a hand-typed time back into milliseconds, for correcting a mistimed
 * solve. Accepts what a cuber would actually type: "12.34", "12", "1:23.45",
 * and a comma instead of a dot. A space or a dash also stands for the colon:
 * the number pad a phone opens for this field has both and no colon.
 *
 * Returns null for anything it cannot read, so the caller can refuse the edit
 * instead of silently storing a wrong time.
 */

const WITH_MINUTES = /^(\d+):([0-5]?\d)(?:[.,](\d{1,3}))?$/;
/** '1 30' and '1-30' as '1:30' — only between digits, so '-5' is still refused. */
const MINUTE_SEPARATOR = /^(\d+)(?:\s+|\s*-\s*)(?=\d)/;
const SECONDS_ONLY = /^(\d+)(?:[.,](\d{1,3}))?$/;

export function parseTimeInput(input: string): number | null {
  const value = input.trim().replace(MINUTE_SEPARATOR, '$1:');
  if (value === '') return null;

  const withMinutes = WITH_MINUTES.exec(value);
  if (withMinutes) {
    const [, minutes, seconds, fraction] = withMinutes;
    return toMs(Number(minutes) * 60 + Number(seconds), fraction);
  }

  const secondsOnly = SECONDS_ONLY.exec(value);
  if (secondsOnly) {
    const [, seconds, fraction] = secondsOnly;
    return toMs(Number(seconds), fraction);
  }

  return null;
}

function toMs(seconds: number, fraction: string | undefined): number | null {
  // '.5' means half a second, not five milliseconds.
  const millis = fraction === undefined ? 0 : Number(fraction.padEnd(3, '0'));
  const total = seconds * 1000 + millis;
  return total > 0 ? total : null;
}
