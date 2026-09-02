import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { TrendPoint } from '../hooks/use-session-stats';
import { formatMs } from '../../../lib/format';
import { strings } from '../../../lib/strings';

interface TrendChartProps {
  points: TrendPoint[];
}

/** Rolling ao12 over the recent window. Gaps are DNF averages — never faked. */
export function TrendChart({ points }: TrendChartProps) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <XAxis
          dataKey="index"
          tickLine={false}
          stroke="var(--border)"
          tick={{ fill: 'var(--muted)', fontSize: 11 }}
        />
        <YAxis
          domain={['auto', 'auto']}
          tickFormatter={(value) => (typeof value === 'number' ? formatMs(value) : String(value))}
          tickLine={false}
          stroke="var(--border)"
          tick={{ fill: 'var(--muted)', fontSize: 11 }}
          width={52}
        />
        <Tooltip
          contentStyle={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '0.5rem',
            color: 'var(--text)',
          }}
          formatter={(value) => [
            typeof value === 'number' ? formatMs(value) : String(value),
            strings.stats.trendSeries,
          ]}
        />
        <Line
          dataKey="aoMs"
          stroke="var(--accent)"
          strokeWidth={2}
          dot={false}
          connectNulls={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
