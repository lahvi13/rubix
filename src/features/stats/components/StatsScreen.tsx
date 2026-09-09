import { lazy, Suspense, useMemo, useState, type ReactNode } from 'react';
import {
  PHASE_TREND_MODES,
  type PhaseTrendMode,
} from '../../../db/repositories/settings-repository';
import { useSetting } from '../../../hooks/use-setting';
import { formatAverage, formatRate } from '../../../lib/format';
import { strings } from '../../../lib/strings';
import { SolveDetailSheet } from '../../history';
import { SessionPicker, useActiveSession } from '../../sessions';
import { PhaseAverages, usePhases } from '../../splits';
import { useSessionStats } from '../hooks/use-session-stats';

const PUZZLE = '333';
const MODE = 'freestyle';
/** Opened at a number rather than at a place in a list, so nothing to step. */
const NO_SOLVES: readonly string[] = [];

// Recharts is by far the biggest dependency after cubing.js; keep it out of
// the timer's chunk and load it only when someone actually opens this screen.
const HistogramChart = lazy(() =>
  import('../charts/HistogramChart').then((module) => ({ default: module.HistogramChart })),
);
const TrendChart = lazy(() =>
  import('../charts/TrendChart').then((module) => ({ default: module.TrendChart })),
);
const PhaseTrendChart = lazy(() =>
  import('../charts/PhaseTrendChart').then((module) => ({ default: module.PhaseTrendChart })),
);

interface StatCardProps {
  label: string;
  value: string;
  highlight?: boolean;
  /** Given, the card opens the solve behind the number. */
  onOpen?: () => void;
  /** A second, smaller line — two rates that belong together in one card. */
  detail?: ReactNode;
}

function StatCard({ label, value, highlight = false, onOpen, detail }: StatCardProps) {
  const className = highlight ? 'stat-card stat-card--highlight' : 'stat-card';
  const body = (
    <>
      <span className="stat-card__label">{label}</span>
      <span className="stat-card__value">{value}</span>
      {detail === undefined ? null : <span className="stat-card__detail">{detail}</span>}
    </>
  );

  // A card that leads somewhere is a button; one that only states a number
  // stays a plain card, so nothing offers a press that does nothing.
  if (onOpen === undefined) return <div className={className}>{body}</div>;
  return (
    <button type="button" className={`${className} stat-card--open`} onClick={onOpen}>
      {body}
    </button>
  );
}

const MODE_LABEL: Record<PhaseTrendMode, string> = {
  stacked: strings.splits.modeStacked,
  separate: strings.splits.modeSeparate,
  share: strings.splits.modeShare,
};

const MODE_NOTE: Record<PhaseTrendMode, string> = {
  stacked: strings.splits.modeStackedNote,
  separate: strings.splits.modeSeparateNote,
  share: strings.splits.modeShareNote,
};

export function StatsScreen() {
  const session = useActiveSession(PUZZLE, MODE);
  const phases = usePhases(session?.methodId ?? null);
  const phaseKeys = useMemo(() => phases.map((phase) => phase.key), [phases]);
  const stats = useSessionStats(session?.id ?? null, PUZZLE, phaseKeys);
  const [trendMode, setTrendMode] = useSetting('stats.phaseTrendMode');
  const [isSmoothed, setSmoothed] = useSetting('stats.phaseTrendSmoothed');
  const [isPickerOpen, setPickerOpen] = useState(false);
  const [openSolveId, setOpenSolveId] = useState<string | null>(null);

  if (stats === null) return <main className="screen screen--scroll" />;

  return (
    <main className="screen screen--scroll">
      <div className="stats">
        <p className="history__summary">
          <span className="summary__session">
            {strings.sessions.label}
            <button
              type="button"
              className="session-switch"
              title={strings.sessions.switchSession}
              onClick={() => setPickerOpen(true)}
            >
              {session?.name}
            </button>
          </span>
          · {stats.solveCount} {strings.stats.solves}
        </p>

        {stats.solveCount === 0 ? (
          <p className="solves__empty">{strings.stats.empty}</p>
        ) : (
          <>
            <div className="stat-cards">
              {/* Both open the solve behind them, and neither switches session:
                  the all-time best is often another session's, and being moved
                  out of the one being read to see it would be a worse answer
                  than the number on its own. */}
              <StatCard
                label={strings.stats.pbSingle}
                value={formatAverage(stats.globalPbMs)}
                highlight
                onOpen={
                  stats.globalPbSolveId === null
                    ? undefined
                    : () => setOpenSolveId(stats.globalPbSolveId)
                }
              />
              <StatCard
                label={strings.stats.sessionBest}
                value={formatAverage(stats.sessionBestMs)}
                onOpen={
                  stats.sessionBestSolveId === null
                    ? undefined
                    : () => setOpenSolveId(stats.sessionBestSolveId)
                }
              />
              <StatCard label={strings.stats.mean} value={formatAverage(stats.meanMs)} />
              <StatCard label={strings.stats.median} value={formatAverage(stats.medianMs)} />
              <StatCard label={strings.stats.stdDev} value={formatAverage(stats.stdDevMs)} />
              {/* Two rates, one card: on a phone the grid is two columns wide,
                  and a seventh card sat alone on a row of its own. */}
              <StatCard
                label={strings.stats.penalties}
                value={`${formatRate(stats.dnfRate)} ${strings.stats.dnfShort}`}
                detail={`${formatRate(stats.plusTwoRate)} ${strings.stats.plusTwoShort}`}
              />
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

            <PhaseAverages
              rows={stats.phaseRows}
              phases={phases}
              measuredCount={stats.measuredCount}
              solveCount={stats.solveCount}
            />

            {stats.phaseTrend.length > 0 ? (
              <section className="chart-card">
                <h2 className="stats__section-title">{strings.splits.phaseTrend}</h2>
                <div className="chart-modes">
                  {PHASE_TREND_MODES.map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      className={mode === trendMode ? 'is-active' : undefined}
                      onClick={() => setTrendMode(mode)}
                    >
                      {MODE_LABEL[mode]}
                    </button>
                  ))}
                  <button
                    type="button"
                    className={isSmoothed ? 'is-active' : undefined}
                    onClick={() => setSmoothed(!isSmoothed)}
                  >
                    {strings.splits.smoothing}
                  </button>
                </div>
                <Suspense fallback={<p className="solves__empty">{strings.stats.loadingCharts}</p>}>
                  <PhaseTrendChart
                    points={stats.phaseTrend}
                    phases={phases}
                    mode={trendMode}
                    isSmoothed={isSmoothed}
                  />
                </Suspense>
                <p className="chart-note">
                  {MODE_NOTE[trendMode]}{' '}
                  {isSmoothed ? strings.splits.smoothingOn : strings.splits.smoothingOff}{' '}
                  {strings.splits.trendAxes(stats.phaseTrend.length)}
                </p>
              </section>
            ) : null}

            <section className="chart-card">
              <h2 className="stats__section-title">{strings.stats.distribution}</h2>
              <Suspense fallback={<p className="solves__empty">{strings.stats.loadingCharts}</p>}>
                <HistogramChart bins={stats.histogramBins} currentAoMs={stats.currentAo12Ms} />
              </Suspense>
            </section>

            {/* Without a filled window there is no line and no axis worth
                drawing; the averages table above already says so. */}
            {stats.trend.length > 0 ? (
              <section className="chart-card">
                <h2 className="stats__section-title">{strings.stats.trend}</h2>
                <Suspense fallback={<p className="solves__empty">{strings.stats.loadingCharts}</p>}>
                  <TrendChart points={stats.trend} bestMs={stats.bestAo12Ms} />
                </Suspense>
              </section>
            ) : null}
          </>
        )}
      </div>

      {openSolveId === null ? null : (
        <SolveDetailSheet
          solveId={openSolveId}
          phases={phases}
          solveIds={NO_SOLVES}
          onOpen={setOpenSolveId}
          onClose={() => setOpenSolveId(null)}
        />
      )}

      {isPickerOpen ? (
        <SessionPicker onClose={() => setPickerOpen(false)} />
      ) : null}
    </main>
  );
}
