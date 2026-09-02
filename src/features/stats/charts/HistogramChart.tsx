import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { HistogramBin } from '../../../domain/stats/distribution';
import { formatMs } from '../../../lib/format';
import { strings } from '../../../lib/strings';

interface HistogramChartProps {
  bins: HistogramBin[];
}

/**
 * Dumb by contract (SPEC 2): charts receive finished data from the domain so
 * this whole module could be swapped for uPlot without touching any logic.
 */
export function HistogramChart({ bins }: HistogramChartProps) {
  const data = bins.map((bin) => ({
    label: formatMs(bin.startMs),
    count: bin.count,
  }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
        <XAxis
          dataKey="label"
          tickLine={false}
          stroke="var(--border)"
          tick={{ fill: 'var(--muted)', fontSize: 11 }}
        />
        <YAxis
          allowDecimals={false}
          tickLine={false}
          stroke="var(--border)"
          tick={{ fill: 'var(--muted)', fontSize: 11 }}
        />
        <Tooltip
          cursor={{ fill: 'rgb(255 255 255 / 6%)' }}
          contentStyle={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '0.5rem',
            color: 'var(--text)',
          }}
          formatter={(value) => [String(value), strings.stats.histogramSeries]}
        />
        <Bar dataKey="count" fill="var(--accent)" radius={[3, 3, 0, 0]} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  );
}
