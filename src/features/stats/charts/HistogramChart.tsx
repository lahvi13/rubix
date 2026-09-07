import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { HistogramBin } from '../../../domain/stats/distribution';
import { formatAxisMs, formatMs } from '../../../lib/format';
import { strings } from '../../../lib/strings';
import { AXIS_PROPS, BAR_TOOLTIP_PROPS, CHART_HEIGHT } from './chart-theme';
import { ChartLegend } from './ChartLegend';
import { ChartTooltip } from './ChartTooltip';

interface HistogramChartProps {
  bins: HistogramBin[];
  /**
   * The current ao12, so its bar can say where the session sits right now.
   * null (window not filled, or a DNF average) simply marks nothing.
   */
  currentAoMs: number | null;
}

/**
 * Dumb by contract (SPEC 2): charts receive finished data from the domain so
 * this whole module could be swapped for uPlot without touching any logic.
 */
export function HistogramChart({ bins, currentAoMs }: HistogramChartProps) {
  const axisMax = bins[bins.length - 1]?.startMs ?? 0;
  const data: Row[] = bins.map((bin) => ({
    startMs: bin.startMs,
    label: binLabel(bin, axisMax),
    range: binRange(bin),
    count: bin.count,
    // The bar holding the current ao12, which is what turns a histogram into
    // "and here is where I am" rather than a shape.
    isCurrent: currentAoMs !== null && currentAoMs >= bin.startMs && currentAoMs < bin.endMs,
  }));

  return (
    <>
      <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
          <XAxis dataKey="label" {...AXIS_PROPS} interval="preserveStartEnd" />
          <YAxis allowDecimals={false} {...AXIS_PROPS} />
          <Tooltip
            {...BAR_TOOLTIP_PROPS}
            content={({ active, payload }) => {
              const row = active === true ? payload?.[0]?.payload : undefined;
              if (!isRow(row)) return null;
              return (
                <ChartTooltip
                  title={row.range}
                  rows={[
                    {
                      label: strings.stats.histogramSeries,
                      value: String(row.count),
                    },
                  ]}
                  note={row.isCurrent ? strings.stats.containsCurrent : undefined}
                />
              );
            }}
          />
          <Bar dataKey="count" radius={[3, 3, 0, 0]} isAnimationActive={false}>
            {data.map((row) => (
              <Cell key={row.startMs} fill={row.isCurrent ? 'var(--accent)' : 'var(--muted)'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <ChartLegend
        entries={[
          { label: strings.stats.histogramSeries, colour: 'var(--muted)' },
          {
            label: `${strings.stats.trendSeries} · ${strings.stats.current}`,
            colour: 'var(--accent)',
          },
        ]}
      />
      <p className="chart-note">{strings.stats.distributionAxes}</p>
    </>
  );
}

interface Row {
  startMs: number;
  label: string;
  range: string;
  count: number;
  isCurrent: boolean;
}

/** Recharts hands the row back as unknown; this is the way back to our type. */
function isRow(value: unknown): value is Row {
  if (typeof value !== 'object' || value === null) return false;
  const candidate: Record<string, unknown> = { ...value };
  return typeof candidate.range === 'string' && typeof candidate.count === 'number';
}

/** The tick under the bar: where the bin starts, or "and up" for the last one. */
function binLabel(bin: HistogramBin, axisMaxMs: number): string {
  const start = formatAxisMs(bin.startMs, axisMaxMs);
  return bin.isOverflow ? `${start}+` : start;
}

/** The tooltip's title: the whole range the bar covers, not just its edge. */
function binRange(bin: HistogramBin): string {
  return bin.isOverflow
    ? `${formatMs(bin.startMs)} ${strings.stats.andUp}`
    : `${formatMs(bin.startMs)}–${formatMs(bin.endMs)}`;
}
