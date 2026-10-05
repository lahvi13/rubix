import type { ReactNode } from 'react';

export interface TooltipRow {
  label: string;
  value: string;
  /** A swatch in the series' colour; omitted for a chart with one series. */
  colour?: string;
  /** Drawn apart from the rows above it — a total, or the solve it belongs to. */
  isSummary?: boolean;
}

interface ChartTooltipProps {
  title: string;
  rows: readonly TooltipRow[];
  /** A line under the rows, for a note the rows cannot carry. */
  note?: ReactNode;
  /**
   * Coloured rows by their swatch alone, in one line, for a chart whose legend
   * names the colours right under it: the names were said twice. They stay
   * for a screen reader.
   */
  isKeyed?: boolean;
}

/**
 * The readout for every chart on this screen. Recharts' default box is styled
 * through half a dozen props per chart and cannot hold a swatch, so the charts
 * pass `content={<ChartTooltip …/>}` and build the rows themselves; keeping it
 * narrow is also what stops it running off the side of a phone.
 */
export function ChartTooltip({ title, rows, note, isKeyed = false }: ChartTooltipProps) {
  return (
    <div className={isKeyed ? 'chart-tooltip is-keyed' : 'chart-tooltip'}>
      <p className="chart-tooltip__title">{title}</p>
      <dl className="chart-tooltip__rows">
        {rows.map((row) => (
          <div
            key={row.label}
            className={row.isSummary ? 'chart-tooltip__row is-summary' : 'chart-tooltip__row'}
          >
            <dt>
              {row.colour === undefined ? null : (
                <span className="chart-tooltip__swatch" style={{ background: row.colour }} />
              )}
              {isKeyed && row.colour !== undefined ? (
                <span className="visually-hidden">{row.label}</span>
              ) : (
                row.label
              )}
            </dt>
            <dd>{row.value}</dd>
          </div>
        ))}
      </dl>
      {note === undefined ? null : <p className="chart-tooltip__note">{note}</p>}
    </div>
  );
}
