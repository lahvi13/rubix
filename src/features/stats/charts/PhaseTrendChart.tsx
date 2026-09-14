import { useState } from 'react';
import { Area, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { PhaseTrendMode } from '../../../db/repositories/settings-repository';
import type { MethodPhase } from '../../../db/types';
import { timeAxis } from '../../../domain/stats/axis';
import type { PhaseTrendPoint } from '../../../domain/stats/phases';
import { formatAxisMs, formatMs } from '../../../lib/format';
import { phaseColour, phaseFillColour } from '../../../lib/phase-colours';
import { strings } from '../../../lib/strings';
import { AXIS_PROPS, CHART_HEIGHT, TOOLTIP_PROPS } from './chart-theme';
import { ChartLegend } from './ChartLegend';
import { ChartTooltip } from './ChartTooltip';

interface PhaseTrendChartProps {
  points: PhaseTrendPoint[];
  phases: readonly MethodPhase[];
  mode: PhaseTrendMode;
  /** Draw the rolling mean rather than the times as they were recorded. */
  isSmoothed: boolean;
}

/**
 * Prefixed so a phase whose key happens to be 'index' cannot collide with the
 * axis; Recharts addresses series by plain object key.
 */
const seriesKey = (key: string) => `phase:${key}`;
/** The raw series drawn behind the mean, in 'separate' mode only. */
const rawKey = (key: string) => `raw:${key}`;

interface Row {
  index: number;
  [series: string]: number | null;
}

/**
 * How long each phase takes as the session goes on, in whichever of three
 * readings was asked for:
 *
 * - stacked — the height is the whole solve, so a phase shows both as its own
 *   band and as a lower ceiling
 * - separate — every phase from zero, which is the only way to watch F2L come
 *   down while the total stands still
 * - share — the same bands as percentages, for when the total is not moving
 *   but the balance is
 */
export function PhaseTrendChart({ points, phases, mode, isSmoothed }: PhaseTrendChartProps) {
  const [readout, setReadout] = useState<HTMLDivElement | null>(null);
  // With smoothing on, the first few solves have no mean; they are dropped
  // rather than drawn as a gap, so the line starts where it has something to
  // say and the axis still counts solves.
  const drawn = isSmoothed ? points.filter((point) => point.mean !== null) : points;
  const valuesOf = (point: PhaseTrendPoint) =>
    isSmoothed ? (point.mean ?? point.phases) : point.phases;

  const data: Row[] = drawn.map((point) => {
    const values = valuesOf(point);
    const row: Row = { index: point.index };
    phases.forEach((phase, order) => {
      row[seriesKey(phase.key)] = share(values, order, mode);
      // The underlay is the point of the toggle in this mode: the smoothed
      // line is only believable next to what it was smoothed from.
      if (mode === 'separate' && isSmoothed) row[rawKey(phase.key)] = point.phases[order] ?? 0;
    });
    return row;
  });

  const axis = valueAxis(drawn.map(valuesOf), mode);
  // The swatch is a miniature of the mark it names. A band is drawn as its
  // fill inside its ink, so the swatch is too — a twelve-pixel square of the
  // light theme's gold would otherwise be invisible on the card it sits on.
  const legend = phases.map((phase, order) =>
    mode === 'separate'
      ? { label: phase.label, colour: phaseColour(order, phases.length) }
      : {
          label: phase.label,
          colour: phaseFillColour(order, phases.length),
          edgeColour: phaseColour(order, phases.length),
        },
  );

  return (
    <>
      <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
        <ComposedChart
          // Recharts remembers the touched point by its place in the data, not
          // by its solve. Smoothing drops the first four solves, so the same
          // place became a solve four further on: the readout moved while the
          // cursor stayed put. A new reading starts untouched instead.
          key={`${mode}:${isSmoothed}`}
          data={data}
          margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
        >
          {/* Counted, not listed: as categories the ticks ran 5 6 7 8 9 10 12
              14, and uneven steps read as uneven solves. */}
          <XAxis
            dataKey="index"
            type="number"
            domain={['dataMin', 'dataMax']}
            allowDecimals={false}
            {...AXIS_PROPS}
          />
          <YAxis
            {...AXIS_PROPS}
            // The axis is built from what is being read — the means, when
            // smoothed. The raw underlay can reach past it, and without this
            // recharts quietly grew the plot for it and left the ticks stopping
            // two thirds of the way up.
            allowDataOverflow
            domain={axis.domain}
            ticks={axis.ticks}
            tickFormatter={axis.format}
            width={44}
          />
          {readout === null ? null : (
            <Tooltip
              {...TOOLTIP_PROPS}
              portal={readout}
              content={({ active, label }) => {
                // Untouched, the readout reads the latest solve drawn.
                const index = active === true ? Number(label) : drawn[drawn.length - 1]?.index;
                const rows =
                  index === undefined ? [] : tooltipRows(points, phases, index, isSmoothed, mode);
                if (index === undefined || rows.length === 0) return null;
                return (
                  <ChartTooltip
                    title={`${strings.stats.solveIndex} ${index}`}
                    rows={rows}
                    note={isSmoothed ? strings.splits.smoothingTooltip : undefined}
                  />
                );
              }}
            />
          )}

          {mode === 'separate' && isSmoothed
            ? phases.map((phase, order) => (
                <Line
                  key={rawKey(phase.key)}
                  dataKey={rawKey(phase.key)}
                  stroke={phaseColour(order, phases.length)}
                  strokeWidth={1}
                  strokeOpacity={0.28}
                  dot={false}
                  isAnimationActive={false}
                />
              ))
            : null}

          {phases.map((phase, order) =>
            mode === 'separate' ? (
              <Line
                key={phase.key}
                dataKey={seriesKey(phase.key)}
                stroke={phaseColour(order, phases.length)}
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            ) : (
              <Area
                key={phase.key}
                dataKey={seriesKey(phase.key)}
                stackId="solve"
                // The band is the face of the cube and its edge is the ink
                // of the same phase, which is what keeps two light bands apart
                // where a shared border would otherwise be the only seam.
                stroke={phaseColour(order, phases.length)}
                fill={phaseFillColour(order, phases.length)}
                // Full strength: at 55% the bands went olive against the dark
                // background while the table beside them stayed bright, and
                // the two stopped reading as the same phase.
                fillOpacity={1}
                strokeWidth={1}
                isAnimationActive={false}
              />
            ),
          )}
        </ComposedChart>
      </ResponsiveContainer>
      <div ref={setReadout} className="chart-readout" />
      <ChartLegend entries={legend} />
    </>
  );
}

/** In share mode a phase is a percentage of its own solve, not milliseconds. */
function share(values: readonly number[], order: number, mode: PhaseTrendMode): number {
  const value = values[order] ?? 0;
  if (mode !== 'share') return value;
  const total = values.reduce((sum, ms) => sum + ms, 0);
  return total === 0 ? 0 : (value * 100) / total;
}

interface ValueAxis {
  domain: [number, number];
  ticks: number[];
  format: (value: number) => string;
}

/**
 * Share mode is a fixed 0..100; the two time modes get round steps, from the
 * tallest thing they draw — the whole solve when stacked, the longest single
 * phase when separate.
 */
function valueAxis(values: readonly number[][], mode: PhaseTrendMode): ValueAxis {
  if (mode === 'share') {
    return {
      domain: [0, 100],
      ticks: [0, 25, 50, 75, 100],
      format: (value) => `${value}%`,
    };
  }

  const tallest = values.reduce((max, row) => {
    const candidate =
      mode === 'stacked' ? row.reduce((sum, ms) => sum + ms, 0) : Math.max(...row, 0);
    return Math.max(max, candidate);
  }, 0);
  const { domainMs, ticksMs } = timeAxis(0, tallest);
  return {
    domain: domainMs,
    ticks: ticksMs,
    format: (value) => formatAxisMs(value, domainMs[1]),
  };
}

function tooltipRows(
  points: readonly PhaseTrendPoint[],
  phases: readonly MethodPhase[],
  index: number,
  isSmoothed: boolean,
  mode: PhaseTrendMode,
) {
  const point = points.find((candidate) => candidate.index === index);
  if (point === undefined) return [];

  const values = isSmoothed ? (point.mean ?? point.phases) : point.phases;
  const total = values.reduce((sum, ms) => sum + ms, 0);

  const rows = phases.map((phase, order) => ({
    label: phase.label,
    colour: phaseColour(order, phases.length),
    value:
      mode === 'share'
        ? `${Math.round(share(values, order, 'share'))}%`
        : formatMs(values[order] ?? 0),
  }));

  // Share mode already sums to 100, which is not news.
  if (mode === 'share') return rows;
  return [...rows, { label: strings.splits.total, value: formatMs(total), isSummary: true }];
}
