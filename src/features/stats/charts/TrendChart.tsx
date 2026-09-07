import {
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { TrendPoint } from '../hooks/use-session-stats';
import { timeAxis } from '../../../domain/stats/axis';
import { formatAxisMs, formatMs } from '../../../lib/format';
import { strings } from '../../../lib/strings';
import { AXIS_PROPS, CHART_HEIGHT, TOOLTIP_PROPS } from './chart-theme';
import { ChartLegend } from './ChartLegend';
import { ChartTooltip } from './ChartTooltip';

interface TrendChartProps {
  /** Already trimmed to where the window has filled — see useSessionStats. */
  points: TrendPoint[];
  /** The best ao12 of the session, drawn as the mark to beat. */
  bestMs: number | null;
}

/** Rolling ao12 over the recent window. Gaps are DNF averages — never faked. */
export function TrendChart({ points, bestMs }: TrendChartProps) {
  const values = points
    .map((point) => point.aoMs)
    .filter((ms): ms is number => ms !== null)
    .concat(bestMs === null ? [] : [bestMs]);

  // An empty axis has nothing to round out, and Math.min of nothing is
  // Infinity — which recharts would happily try to draw.
  const axis =
    values.length === 0 ? null : timeAxis(Math.min(...values), Math.max(...values));

  const first = points[0]?.index ?? 1;
  const last = points[points.length - 1]?.index ?? first;

  return (
    <>
      <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
        <LineChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <XAxis
            dataKey="index"
            type="number"
            // The ao12 does not exist before the twelfth solve, and half an
            // axis of empty chart says nothing about the half that has data.
            domain={[first, last]}
            allowDecimals={false}
            {...AXIS_PROPS}
          />
          <YAxis
            {...AXIS_PROPS}
            domain={axis?.domainMs ?? ['auto', 'auto']}
            ticks={axis?.ticksMs}
            tickFormatter={(value: number) =>
              formatAxisMs(value, axis?.domainMs[1] ?? value)
            }
            width={52}
          />
          <Tooltip
            {...TOOLTIP_PROPS}
            content={({ active, label, payload }) => {
              const value = payload?.[0]?.value;
              if (active !== true || typeof value !== 'number') return null;
              return (
                <ChartTooltip
                  title={`${strings.stats.solveIndex} ${String(label)}`}
                  rows={[
                    {
                      label: strings.stats.trendSeries,
                      colour: 'var(--accent)',
                      value: formatMs(value),
                    },
                    // The distance to the record is the question the reference
                    // line raises; the tooltip is where it gets a number.
                    ...(bestMs === null
                      ? []
                      : [
                          {
                            label: strings.stats.bestAo12,
                            value:
                              value <= bestMs
                                ? formatMs(bestMs)
                                : `+${formatMs(value - bestMs)}`,
                            isSummary: true,
                          },
                        ]),
                  ]}
                />
              );
            }}
          />
          {bestMs === null ? null : (
            <ReferenceLine
              y={bestMs}
              stroke="var(--warn)"
              strokeDasharray="4 4"
              strokeWidth={1}
            />
          )}
          <Line
            dataKey="aoMs"
            stroke="var(--accent)"
            strokeWidth={2}
            // Twenty solves fit their dots; a hundred would be a smear, and
            // the line is then the shape being read anyway.
            dot={points.length <= 30 ? { r: 2.5, fill: 'var(--accent)', strokeWidth: 0 } : false}
            activeDot={{ r: 4 }}
            connectNulls={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
      <ChartLegend
        entries={[
          { label: strings.stats.trendSeries, colour: 'var(--accent)' },
          ...(bestMs === null
            ? []
            : [{ label: strings.stats.bestAo12, colour: 'var(--warn)', isReference: true }]),
        ]}
      />
      <p className="chart-note">{strings.stats.trendAxes}</p>
    </>
  );
}
