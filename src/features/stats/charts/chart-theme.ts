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

/** The card is the tooltip's home; it must not paint outside it. */
export const TOOLTIP_WRAPPER_STYLE: CSSProperties = {
  pointerEvents: 'none',
  zIndex: 1,
};

/**
 * Recharts flips the tooltip horizontally on its own once it would leave the
 * plot area, but vertically it only clamps to that area — a tooltip taller
 * than the chart escapes upwards, off the card and under the app's sticky
 * header. Pinning y (checked per axis in recharts' getTooltipTranslateXY, so
 * x is still free to flip) keeps it inside and stops it jumping about under
 * the finger.
 */
export const TOOLTIP_POSITION = { y: 0 } as const;

export const TOOLTIP_PROPS = {
  offset: 12,
  allowEscapeViewBox: { x: false, y: false },
  wrapperStyle: TOOLTIP_WRAPPER_STYLE,
  position: TOOLTIP_POSITION,
  isAnimationActive: false,
  cursor: { stroke: 'var(--border)', strokeWidth: 1 },
} as const;

/** The same, for a bar chart, where the cursor is a band and not a line. */
export const BAR_TOOLTIP_PROPS = {
  ...TOOLTIP_PROPS,
  cursor: { fill: 'var(--tint)' },
} as const;

export const CHART_HEIGHT = 220;
