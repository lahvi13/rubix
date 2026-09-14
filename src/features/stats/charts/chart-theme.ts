import type { CSSProperties } from 'react';

/**
 * The bits every chart on this screen shares. Recharts takes styling as props
 * rather than classes, so without one place for them the three charts drift —
 * which is how the axes ended up formatting times two different ways.
 */

export const AXIS_TICK = { fill: 'var(--muted)', fontSize: 11 } as const;

export const AXIS_PROPS = {
  tickLine: false,
  stroke: 'var(--border)',
  tick: AXIS_TICK,
} as const;

/**
 * The readout is not a box floating over the plot. On a phone the finger is
 * already over the chart, and a box beside it — four phases, a total and a
 * note tall — covered the very point being read and the axis saying which
 * solve it was. Every chart hands recharts a portal instead
 * and the readout sits in a row of its own under the plot.
 *
 * Kept visible when nothing is touched, because the charts then show their
 * latest point there: a row that appeared only under a finger would push the
 * legend about each time.
 */
export const TOOLTIP_PROPS = {
  isAnimationActive: false,
  wrapperStyle: { visibility: 'visible' } satisfies CSSProperties,
  // Stronger than the axis: with the readout moved off the plot, this line is
  // what says where on the chart the numbers below belong.
  cursor: { stroke: 'var(--muted)', strokeWidth: 1 },
} as const;

/** The same, for a bar chart, where the cursor is a band and not a line. */
export const BAR_TOOLTIP_PROPS = {
  ...TOOLTIP_PROPS,
  cursor: { fill: 'var(--tint)' },
} as const;

export const CHART_HEIGHT = 220;
