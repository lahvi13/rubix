import { Line, LineChart, ResponsiveContainer, XAxis, YAxis } from 'recharts';
import type { RecordEntry } from '../hooks/use-session-stats';
import { timeAxis } from '../../../domain/stats/axis';
import { now } from '../../../lib/clock';
import { formatAxisMs, formatShortDate } from '../../../lib/format';
import { strings } from '../../../lib/strings';
import { AXIS_PROPS } from './chart-theme';

/** Shorter than the trend: it sits on top of a list that is the main read. */
const RECORDS_CHART_HEIGHT = 160;

interface RecordsChartProps {
  /** Newest first, as the list under the chart has them. */
  records: readonly RecordEntry[];
  /** The list's own colour for its top row: gold for the all-time PB, else green. */
  colour: string;
}

interface DotProps {
  cx?: number;
  cy?: number;
  index?: number;
}

/**
 * The records as steps over the calendar: each drop is a record, each flat
 * stretch the time it stood. By date rather than by solve, so a week away
 * shows as a long step — and the drop after it, if there was one.
 */
export function RecordsChart({ records, colour }: RecordsChartProps) {
  const set = [...records].reverse().map((record) => ({ at: record.at, ms: record.ms }));
  const latest = set[set.length - 1];
  if (latest === undefined) return null;
  // The last record still stands, so its step runs on to today; the point
  // that carries it there is not a record and gets no dot.
  const points = [...set, { at: Math.max(now(), latest.at), ms: latest.ms }];
  const values = set.map((point) => point.ms);
  const axis = timeAxis(Math.min(...values), Math.max(...values));
  const first = set[0]?.at ?? latest.at;

  const dot = ({ cx, cy, index }: DotProps) =>
    index === set.length || cx === undefined || cy === undefined ? (
      <g key="today" />
    ) : (
      <circle key={index} cx={cx} cy={cy} r={2.5} fill={colour} />
    );

  return (
    <div role="img" aria-label={strings.stats.recordsChart}>
      <ResponsiveContainer width="100%" height={RECORDS_CHART_HEIGHT}>
        <LineChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <XAxis
            dataKey="at"
            type="number"
            domain={[first, points[points.length - 1]?.at ?? first]}
            tickCount={4}
            tickFormatter={(value: number) => formatShortDate(value, now())}
            {...AXIS_PROPS}
          />
          <YAxis
            {...AXIS_PROPS}
            domain={axis.domainMs}
            ticks={axis.ticksMs}
            tickFormatter={(value: number) => formatAxisMs(value, axis.domainMs[1])}
            width={52}
          />
          <Line
            dataKey="ms"
            type="stepAfter"
            stroke={colour}
            strokeWidth={2}
            dot={dot}
            activeDot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
