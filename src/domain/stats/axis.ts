/**
 * Tick positions for a time axis.
 *
 * Recharts' own 'auto' domain divides the data range into equal parts, which
 * lands on numbers nobody reads in time: 1:01.50, 1:03.00, 1:04.50. A time
 * axis has to step by amounts a cuber counts in — a second, five, half a
 * minute — so the step is chosen from a fixed ladder and the ends are rounded
 * out to it.
 */

/** Steps a time axis is allowed to use, in milliseconds. */
const TIME_STEPS_MS = [
  100, 250, 500, 1000, 2000, 5000, 10_000, 15_000, 30_000, 60_000, 120_000, 300_000, 600_000,
] as const;

/**
 * How many gaps an axis this tall can carry. Five rather than four so that a
 * range just over a step — a 2:00.4 solve on a minute grid — does not have to
 * jump to the next step and leave a third of the chart empty above the data.
 */
const DEFAULT_TICK_COUNT = 5;

export interface TimeAxis {
  /** Rounded out to whole steps, so the first and last tick are the ends. */
  domainMs: [number, number];
  ticksMs: number[];
}

/**
 * The axis a range of times deserves. `targetCount` is a ceiling on the number
 * of gaps, counted after both ends have been rounded out — asking the raw
 * range instead is what let an axis fit "under four gaps" and then draw five.
 *
 * A flat range (every value the same) still has to draw something, so it is
 * widened by one step around the value.
 */
export function timeAxis(minMs: number, maxMs: number, targetCount = DEFAULT_TICK_COUNT): TimeAxis {
  const step = timeStep(minMs, maxMs, targetCount);
  let first = Math.floor(minMs / step) * step;
  let last = Math.ceil(maxMs / step) * step;
  if (first === last) {
    first -= step;
    last += step;
  }

  const ticksMs: number[] = [];
  for (let tick = first; tick <= last; tick += step) ticksMs.push(tick);
  return { domainMs: [first, last], ticksMs };
}

/** The finest step from the ladder whose rounded-out ends fit `targetCount` gaps. */
export function timeStep(
  minMs: number,
  maxMs: number,
  targetCount = DEFAULT_TICK_COUNT,
): number {
  const coarsest = TIME_STEPS_MS[TIME_STEPS_MS.length - 1] ?? 60_000;
  for (const step of TIME_STEPS_MS) {
    if (Math.ceil(maxMs / step) - Math.floor(minMs / step) <= targetCount) return step;
  }
  return coarsest;
}
