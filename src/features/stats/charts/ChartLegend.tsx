export interface LegendEntry {
  label: string;
  colour: string;
  /** A dashed swatch, for a series drawn as a reference rather than as data. */
  isReference?: boolean;
}

interface ChartLegendProps {
  entries: readonly LegendEntry[];
}

/**
 * Which colour is which, next to the chart rather than inside it. Recharts'
 * own legend eats a row of the plot and wraps badly at 412px, and the whole
 * point is that a chart should be readable without the table above it.
 */
export function ChartLegend({ entries }: ChartLegendProps) {
  return (
    <ul className="chart-legend">
      {entries.map((entry) => (
        <li key={entry.label} className="chart-legend__item">
          {/* A reference is a rule, not a block, so its colour goes to the
              border the stylesheet draws rather than to a fill. */}
          <span
            className={
              entry.isReference ? 'chart-legend__swatch is-reference' : 'chart-legend__swatch'
            }
            style={
              entry.isReference ? { borderColor: entry.colour } : { background: entry.colour }
            }
          />
          {entry.label}
        </li>
      ))}
    </ul>
  );
}
