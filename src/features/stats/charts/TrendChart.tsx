import { useState } from 'react';
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
import { now } from '../../../lib/clock';
import { formatAxisMs, formatMs, formatShortDate, formatTime } from '../../../lib/format';
import { strings } from '../../../lib/strings';
import { AXIS_PROPS, CHART_HEIGHT, TOOLTIP_PROPS } from './chart-theme';
import { ChartLegend } from './ChartLegend';
import { ChartTooltip } from './ChartTooltip';

interface TrendChartProps {
  /** Already trimmed to where the window has filled — see useSessionStats. */
  points: TrendPoint[];
  /** The best ao12 of the session, drawn as the mark to beat. */
  bestMs: number | null;
  /** Singles past this are drawn off the top rather than let stretch the scale. */
  fenceMs: number;
  /** The reader's goal, drawn as a second line to beat; null when none is set. */
  goalMs: number | null;
}

/**
 * Rolling ao12 over the recent window, with the ao50 under it: the ao12 alone
 * says how today is going, and only next to the slower line does it say
 * whether that is a change of form. Gaps are DNF averages — never faked.
 */
export function TrendChart({ points, bestMs, fenceMs, goalMs }: TrendChartProps) {
  const [readout, setReadout] = useState<HTMLDivElement | null>(null);
  // The averages always fit. A single fits unless it is past the fence: one
  // three-minute solve in a session of ninety-second ones would otherwise
  // flatten the line the chart is for into the bottom third of it.
  const singles = points
    .map((point) => point.singleMs)
    .filter((ms): ms is number => ms !== null && ms <= fenceMs);
  const values = points
    .map((point) => point.aoMs)
    .filter((ms): ms is number => ms !== null)
    .concat(singles)
    .concat(points.map((point) => point.longAoMs).filter((ms): ms is number => ms !== null))
    .concat(bestMs === null ? [] : [bestMs])
    .concat(goalMs === null ? [] : [goalMs]);

  // An empty axis has nothing to round out, and Math.min of nothing is
  // Infinity — which recharts would happily try to draw.
  const axis =
    values.length === 0 ? null : timeAxis(Math.min(...values), Math.max(...values));

  // Under fifty solves there is no line to draw, and a legend entry for one
  // would promise it.
  const hasLong = points.some((point) => point.longAoMs !== null);

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
            allowDataOverflow
            domain={axis?.domainMs ?? ['auto', 'auto']}
            ticks={axis?.ticksMs}
            tickFormatter={(value: number) =>
              formatAxisMs(value, axis?.domainMs[1] ?? value)
            }
            width={52}
          />
          {readout === null ? null : (
            <Tooltip
              {...TOOLTIP_PROPS}
              portal={readout}
              content={({ active, label }) => {
                // Untouched, the readout reads the latest solve.
                const point =
                  active === true
                    ? points.find((candidate) => candidate.index === Number(label))
                    : points.findLast((candidate) => candidate.aoMs !== null);
                const value = point?.aoMs;
                if (point === undefined || value == null) return null;
                return (
                  <ChartTooltip
                    title={`${strings.stats.solveIndex} ${point.index} · ${formatShortDate(point.at, now())}`}
                    rows={[
                      {
                        label: strings.stats.singleSeries,
                        colour: 'var(--muted)',
                        value: formatTime(point.singleMs),
                      },
                      {
                        label: strings.stats.trendSeries,
                        colour: 'var(--accent)',
                        value: formatMs(value),
                      },
                      ...(hasLong
                        ? [
                            {
                              label: strings.stats.longTrendSeries,
                              colour: 'var(--series-long)',
                              value: formatTime(point.longAoMs),
                            },
                          ]
                        : []),
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
          )}
          {goalMs === null ? null : (
            // Solid, where the best ao12 is dashed: the two often sit a second
            // apart, and in the same dash they read as one line.
            <ReferenceLine y={goalMs} stroke="var(--text)" strokeOpacity={0.6} strokeWidth={1.5} />
          )}
          {bestMs === null ? null : (
            <ReferenceLine
              y={bestMs}
              stroke="var(--warn)"
              strokeDasharray="4 4"
              strokeWidth={1}
            />
          )}
          {/* Behind the line, and quiet: the spread is context for the average,
              not a second thing to read. */}
          <Line
            dataKey="singleMs"
            stroke="none"
            dot={{ r: 1.5, fill: 'var(--muted)', fillOpacity: 0.55, strokeWidth: 0 }}
            activeDot={false}
            connectNulls={false}
            isAnimationActive={false}
          />
          {/* Under the ao12 and without dots: it moves slowly enough that the
              line is all there is to read, and where the two cross the ao12
              has to stay on top. */}
          {hasLong ? (
            <Line
              dataKey="longAoMs"
              stroke="var(--series-long)"
              strokeWidth={1.75}
              dot={false}
              activeDot={false}
              connectNulls={false}
              isAnimationActive={false}
            />
          ) : null}
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
      <div ref={setReadout} className="chart-readout" />
      <ChartLegend
        entries={[
          { label: strings.stats.singleSeries, colour: 'var(--muted)', isDot: true },
          { label: strings.stats.trendSeries, colour: 'var(--accent)' },
          ...(hasLong
            ? [{ label: strings.stats.longTrendSeries, colour: 'var(--series-long)' }]
            : []),
          ...(bestMs === null
            ? []
            : [{ label: strings.stats.bestAo12, colour: 'var(--warn)', isReference: true }]),
          ...(goalMs === null
            ? []
            : [
                {
                  label: strings.stats.goalSeries,
                  colour: 'var(--text)',
                  isReference: true,
                  isSolid: true,
                },
              ]),
        ]}
      />
      <p className="chart-note">
        {hasLong ? strings.stats.trendAxesLong : strings.stats.trendAxes}
      </p>
    </>
  );
}
