export interface LegendEntry {
  label: string;
  colour: string;
  /**
   * The edge the fill is drawn inside, for a series that is an area rather
   * than a mark: a pale band is told from the card behind it by its outline,
   * and at swatch size that outline is most of what there is to see.
   */
  edgeColour?: string;
  /** A dashed swatch, for a series drawn as a reference rather than as data. */
  isReference?: boolean;
  /** A reference drawn as a solid rule rather than dashed. */
  isSolid?: boolean;
  /** A round swatch, for a series drawn as scattered dots. */
  isDot?: boolean;
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
              entry.isReference
                ? entry.isSolid
                  ? 'chart-legend__swatch is-reference is-solid'
                  : 'chart-legend__swatch is-reference'
                : entry.isDot
                  ? 'chart-legend__swatch is-dot'
                  : 'chart-legend__swatch'
            }
            style={
              entry.isReference
                ? { borderColor: entry.colour }
                : { background: entry.colour, borderColor: entry.edgeColour }
            }
          />
          {entry.label}
        </li>
      ))}
    </ul>
  );
}
