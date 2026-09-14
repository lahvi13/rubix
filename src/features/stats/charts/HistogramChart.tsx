import { useState } from 'react';
import {
  Bar,
  BarChart,
  DefaultZIndexes,
  ResponsiveContainer,
  Tooltip,
  usePlotArea,
  XAxis,
  YAxis,
  ZIndexLayer,
} from 'recharts';
import { histogramPosition, type HistogramBin } from '../../../domain/stats/distribution';
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
  const [readout, setReadout] = useState<HTMLDivElement | null>(null);
  const axisMax = bins[bins.length - 1]?.startMs ?? 0;
  // Where the ao12 actually falls, which is not the same question as which bar
  // holds it: the bin it lands in may hold no solves at all, and a coloured
  // bar that does not exist marks nothing.
  const marker = currentAoMs === null ? null : histogramPosition(bins, currentAoMs);
  const data: Row[] = bins.map((bin) => ({
    startMs: bin.startMs,
    label: binLabel(bin, axisMax),
    range: binRange(bin),
    count: bin.count,
    // Said by the tooltip alone. The bar used to be painted in the accent as
    // well, which put two marks on one fact and left the exact one — the
    // marker — to be read against a bar in its own colour.
    isCurrent: currentAoMs !== null && currentAoMs >= bin.startMs && currentAoMs < bin.endMs,
  }));

  return (
    <>
      <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
          <XAxis dataKey="label" {...AXIS_PROPS} interval="preserveStartEnd" />
          <YAxis allowDecimals={false} {...AXIS_PROPS} />
          {readout === null ? null : (
            <Tooltip
              {...BAR_TOOLTIP_PROPS}
              portal={readout}
              content={({ active, payload }) => {
                // Untouched, the readout reads the bar the current ao12 is in.
                const row =
                  active === true ? payload?.[0]?.payload : data.find((entry) => entry.isCurrent);
                if (!isRow(row)) {
                  return <p className="chart-readout__hint">{strings.stats.touchBar}</p>;
                }
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
          )}
          <Bar dataKey="count" fill="var(--muted)" radius={[3, 3, 0, 0]} isAnimationActive={false} />
          {marker === null ? null : <AverageMarker position={marker} />}
        </BarChart>
      </ResponsiveContainer>
      <div ref={setReadout} className="chart-readout" />
      <ChartLegend
        entries={[
          { label: strings.stats.histogramSeries, colour: 'var(--muted)' },
          // Named with its own time: the axis is ticked in bins, so the line
          // says where but never how much, and there is no room to write it
          // on the line without it running off the edge of a phone.
          ...(currentAoMs === null
            ? []
            : [
                {
                  label: `${strings.stats.trendSeries} · ${formatMs(currentAoMs)}`,
                  colour: 'var(--accent)',
                  isReference: true,
                },
              ]),
        ]}
      />
      <p className="chart-note">{strings.stats.distributionAxes}</p>
    </>
  );
}

/**
 * The current average, drawn where it actually falls rather than on the band
 * it belongs to. A ReferenceLine cannot do this: the bars sit on an axis of
 * categories, which can only be pointed at a whole band at a time, and half a
 * band is the width of five seconds. So the line is drawn straight into the
 * plot, which recharts hands over the measurements of.
 */
function AverageMarker({ position }: { position: number }) {
  const area = usePlotArea();
  if (area === undefined) return null;
  const x = area.x + area.width * position;
  const ends = { x1: x, x2: x, y1: area.y, y2: area.y + area.height };
  // SVG has no z-index, so recharts stacks by layer instead, and anything
  // drawn without asking for one lands under the bars. This is a reference
  // line in all but name, so it goes where recharts puts those.
  return (
    <ZIndexLayer zIndex={DefaultZIndexes.line}>
      {/* Cased in the card's own colour, dash for dash. The line crosses the
          bars, and the accent and the grey they are drawn in are nearly the
          same brightness — hue alone would leave it to be found rather than
          seen. */}
      <line {...ends} stroke="var(--surface)" strokeWidth={4} strokeDasharray="4 4" />
      <line {...ends} stroke="var(--accent)" strokeWidth={2} strokeDasharray="4 4" />
    </ZIndexLayer>
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
