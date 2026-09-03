import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { MethodPhase } from '../../../db/types';
import type { PhaseTrendPoint } from '../../../domain/stats/phases';
import { formatMs } from '../../../lib/format';
import { phaseColour } from '../../../lib/phase-colours';

interface PhaseTrendChartProps {
  points: PhaseTrendPoint[];
  phases: readonly MethodPhase[];
}

/**
 * Prefixed so a phase whose key happens to be 'index' cannot collide with the
 * axis; Recharts addresses series by plain object key.
 */
const seriesKey = (key: string) => `phase:${key}`;

/**
 * Rolling mean of every phase, stacked. Stacked because the height is then the
 * whole solve: a cross that got faster shows both as its own thinner band and
 * as a lower ceiling, which is the question being asked.
 */
export function PhaseTrendChart({ points, phases }: PhaseTrendChartProps) {
  const data = points.map((point) => {
    const row: Record<string, number> = { index: point.index };
    phases.forEach((phase, order) => {
      row[seriesKey(phase.key)] = point.phases[order] ?? 0;
    });
    return row;
  });

  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <XAxis
          dataKey="index"
          tickLine={false}
          stroke="var(--border)"
          tick={{ fill: 'var(--muted)', fontSize: 11 }}
        />
        <YAxis
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
          formatter={(value, name) => [
            typeof value === 'number' ? formatMs(value) : String(value),
            phases.find((phase) => seriesKey(phase.key) === name)?.label ?? String(name),
          ]}
        />
        {/* Drawn last phase first, so the legend order in the tooltip reads
            the way the solve does. */}
        {phases.map((phase, order) => (
          <Area
            key={phase.key}
            dataKey={seriesKey(phase.key)}
            stackId="solve"
            stroke={phaseColour(order, phases.length)}
            fill={phaseColour(order, phases.length)}
            fillOpacity={0.55}
            strokeWidth={1}
            isAnimationActive={false}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}
