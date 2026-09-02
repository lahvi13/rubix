import { lazy, Suspense } from 'react';
import { formatAverage, formatRate } from '../../../lib/format';
import { strings } from '../../../lib/strings';
import { useActiveSession } from '../../sessions';
import { useSessionStats } from '../hooks/use-session-stats';

const PUZZLE = '333';
const MODE = 'freestyle';

// Recharts is by far the biggest dependency after cubing.js; keep it out of
// the timer's chunk and load it only when someone actually opens this screen.
const HistogramChart = lazy(() =>
  import('../charts/HistogramChart').then((module) => ({ default: module.HistogramChart })),
);
const TrendChart = lazy(() =>
  import('../charts/TrendChart').then((module) => ({ default: module.TrendChart })),
);

interface StatCardProps {
  label: string;
  value: string;
  highlight?: boolean;
}

function StatCard({ label, value, highlight = false }: StatCardProps) {
  return (
    <div className={highlight ? 'stat-card stat-card--highlight' : 'stat-card'}>
      <span className="stat-card__label">{label}</span>
      <span className="stat-card__value">{value}</span>
    </div>
  );
}

export function StatsScreen() {
  const session = useActiveSession(PUZZLE, MODE);
  const stats = useSessionStats(session?.id ?? null, PUZZLE);

  if (stats === null) return <main className="screen screen--scroll" />;

  return (
    <main className="screen screen--scroll">
      <div className="stats">
        <p className="history__summary">
          {session?.name} · {stats.solveCount} {strings.stats.solves}
        </p>

        {stats.solveCount === 0 ? (
          <p className="solves__empty">{strings.stats.empty}</p>
        ) : (
          <>
            <div className="stat-cards">
              <StatCard
                label={strings.stats.pbSingle}
                value={formatAverage(stats.globalPbMs)}
                highlight
              />
              <StatCard
                label={strings.stats.sessionBest}
                value={formatAverage(stats.sessionBestMs)}
              />
              <StatCard label={strings.stats.mean} value={formatAverage(stats.meanMs)} />
              <StatCard label={strings.stats.median} value={formatAverage(stats.medianMs)} />
              <StatCard label={strings.stats.stdDev} value={formatAverage(stats.stdDevMs)} />
              <StatCard label={strings.stats.dnfRate} value={formatRate(stats.dnfRate)} />
              <StatCard label={strings.stats.plusTwoRate} value={formatRate(stats.plusTwoRate)} />
            </div>

            <section>
              <h2 className="stats__section-title">{strings.stats.averages}</h2>
              <table className="averages-table">
                <thead>
                  <tr>
                    <th />
                    <th>{strings.stats.current}</th>
                    <th>{strings.stats.best}</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.windows.map((window) => (
                    <tr key={window.n}>
                      <th>ao{window.n}</th>
                      <td>{formatAverage(window.current)}</td>
                      <td>{formatAverage(window.best)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            <section className="chart-card">
              <h2 className="stats__section-title">{strings.stats.distribution}</h2>
              <Suspense fallback={<p className="solves__empty">{strings.stats.loadingCharts}</p>}>
                <HistogramChart bins={stats.histogramBins} />
              </Suspense>
            </section>

            <section className="chart-card">
              <h2 className="stats__section-title">{strings.stats.trend}</h2>
              <Suspense fallback={<p className="solves__empty">{strings.stats.loadingCharts}</p>}>
                <TrendChart points={stats.trend} />
              </Suspense>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
