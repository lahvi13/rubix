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
import type { DayPoint } from '../hooks/use-session-stats';
import { timeAxis } from '../../../domain/stats/axis';
import { dayKeyOf } from '../../../domain/stats/daily';
import { formatAxisMs, formatDayKey, formatMs } from '../../../lib/format';
import { strings } from '../../../lib/strings';
import { AXIS_PROPS, CHART_HEIGHT, TOOLTIP_PROPS } from './chart-theme';
import { ChartLegend } from './ChartLegend';
import { ChartTooltip } from './ChartTooltip';

interface DailyTrendChartProps {
  days: DayPoint[];
  goalMs: number | null;
}

/**
 * The trend by the calendar: one point per day practised, the line through
 * the day's mean and a dot at its best solve. The axis counts days, so a
 * fortnight away is a gap on the chart rather than two neighbouring points.
 */
export function DailyTrendChart({ days, goalMs }: DailyTrendChartProps) {
  const [readout, setReadout] = useState<HTMLDivElement | null>(null);
  const values = days
    .flatMap((day) => [day.meanMs, day.bestMs])
    .filter((ms): ms is number => ms !== null)
    .concat(goalMs === null ? [] : [goalMs]);
  const axis = values.length === 0 ? null : timeAxis(Math.min(...values), Math.max(...values));
  const first = days[0]?.day ?? 0;
  const last = days[days.length - 1]?.day ?? first;

  return (
    <>
      <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
        <LineChart data={days} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          <XAxis
            dataKey="day"
            type="number"
            domain={[first, last]}
            allowDecimals={false}
            tickFormatter={(day: number) => formatDayKey(dayKeyOf(day))}
            {...AXIS_PROPS}
          />
          <YAxis
            {...AXIS_PROPS}
            domain={axis?.domainMs ?? ['auto', 'auto']}
            ticks={axis?.ticksMs}
            tickFormatter={(value: number) => formatAxisMs(value, axis?.domainMs[1] ?? value)}
            width={52}
          />
          {readout === null ? null : (
            <Tooltip
              {...TOOLTIP_PROPS}
              portal={readout}
              content={({ active, label }) => {
                // Untouched, the readout reads the latest day.
                const day =
                  active === true
                    ? days.find((candidate) => candidate.day === Number(label))
                    : days[days.length - 1];
                if (day === undefined) return null;
                return (
                  <ChartTooltip
                    title={formatDayKey(day.dayKey, true)}
                    rows={[
                      {
                        label: strings.stats.dailyMean,
                        colour: 'var(--accent)',
                        value: day.meanMs === null ? strings.solve.dnf : formatMs(day.meanMs),
                      },
                      {
                        label: strings.stats.dailyBest,
                        colour: 'var(--muted)',
                        value: day.bestMs === null ? strings.solve.dnf : formatMs(day.bestMs),
                      },
                      { label: strings.stats.solvesLabel, value: String(day.count), isSummary: true },
                    ]}
                  />
                );
              }}
            />
          )}
          {goalMs === null ? null : (
            <ReferenceLine y={goalMs} stroke="var(--text)" strokeDasharray="2 4" strokeWidth={1} />
          )}
          <Line
            dataKey="bestMs"
            stroke="none"
            dot={{ r: 2, fill: 'var(--muted)', strokeWidth: 0 }}
            activeDot={false}
            isAnimationActive={false}
          />
          <Line
            dataKey="meanMs"
            stroke="var(--accent)"
            strokeWidth={2}
            dot={days.length <= 30 ? { r: 2.5, fill: 'var(--accent)', strokeWidth: 0 } : false}
            activeDot={{ r: 4 }}
            // A day of nothing but DNFs has no mean; the days either side of
            // it are still the same line.
            connectNulls
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
      <div ref={setReadout} className="chart-readout" />
      <ChartLegend
        entries={[
          { label: strings.stats.dailyMean, colour: 'var(--accent)' },
          { label: strings.stats.dailyBest, colour: 'var(--muted)', isDot: true },
          ...(goalMs === null
            ? []
            : [{ label: strings.stats.goalSeries, colour: 'var(--text)', isReference: true }]),
        ]}
      />
      <p className="chart-note">{strings.stats.dailyAxes}</p>
    </>
  );
}

