import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { PracticeStats } from '../hooks/use-session-stats';
import { formatDayKey } from '../../../lib/format';
import { strings } from '../../../lib/strings';
import { AXIS_PROPS, BAR_TOOLTIP_PROPS } from './chart-theme';
import { ChartTooltip } from './ChartTooltip';

/** Shorter than the time charts: a count per day is read at a glance, not measured. */
const PRACTICE_CHART_HEIGHT = 140;

interface PracticeChartProps {
  days: PracticeStats['days'];
}

/** Solves per calendar day over the last month, the days off left as gaps. */
export function PracticeChart({ days }: PracticeChartProps) {
  return (
    <ResponsiveContainer width="100%" height={PRACTICE_CHART_HEIGHT}>
      <BarChart data={days} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
        <XAxis
          dataKey="dayKey"
          {...AXIS_PROPS}
          interval="preserveStartEnd"
          minTickGap={24}
          tickFormatter={(key: string) => formatDayKey(key)}
        />
        <YAxis allowDecimals={false} {...AXIS_PROPS} />
        <Tooltip
          {...BAR_TOOLTIP_PROPS}
          content={({ active, label }) => {
            const day = days.find((candidate) => candidate.dayKey === label);
            if (active !== true || day === undefined) return null;
            return (
              <ChartTooltip
                title={formatDayKey(day.dayKey, true)}
                rows={[{ label: strings.stats.solvesLabel, value: String(day.count) }]}
              />
            );
          }}
        />
        <Bar dataKey="count" fill="var(--accent)" radius={[2, 2, 0, 0]} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  );
}
