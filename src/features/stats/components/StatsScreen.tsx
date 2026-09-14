import { lazy, Suspense, useMemo, useState, type ReactNode } from 'react';
import {
  PHASE_TREND_MODES,
  STATS_SCOPES,
  type PhaseTrendMode,
  type StatsScope,
} from '../../../db/repositories/settings-repository';
import { useSetting } from '../../../hooks/use-setting';
import { formatAverage, formatRate } from '../../../lib/format';
import { strings } from '../../../lib/strings';
import { SolveDetailSheet } from '../../history';
import { SessionPicker, useActiveSession } from '../../sessions';
import { PhaseAverages, usePhases } from '../../splits';
import { useStatsScope } from '../hooks/use-stats-scope';
import type { Average, AverageWindow } from '../../../domain/stats/averages';
import {
  PRACTICE_DAYS,
  RECENT_SOLVES,
  useSessionStats,
  type WindowAt,
} from '../hooks/use-session-stats';
import { AverageSheet } from './AverageSheet';
import { GoalSection } from './GoalSection';
import { RecordsSection } from './RecordsSection';

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
const DailyTrendChart = lazy(() =>
  import('../charts/DailyTrendChart').then((module) => ({ default: module.DailyTrendChart })),
);
const PracticeChart = lazy(() =>
  import('../charts/PracticeChart').then((module) => ({ default: module.PracticeChart })),
);
const PhaseTrendChart = lazy(() =>
  import('../charts/PhaseTrendChart').then((module) => ({ default: module.PhaseTrendChart })),
);

/** The two tiers a time is marked with everywhere else: the session's best, and the PB. */
type StatTier = 'best' | 'record';

interface StatCardProps {
  label: string;
  value: string;
  /** Marked the way the history marks the solve the number belongs to. */
  tier?: StatTier;
  /** Across two columns — the PB, when there is no session best beside it. */
  isWide?: boolean;
  /** Given, the card opens the solve behind the number. */
  onOpen?: () => void;
  /** A second, smaller line — two rates that belong together in one card. */
  detail?: ReactNode;
}

function StatCard({ label, value, tier, isWide = false, onOpen, detail }: StatCardProps) {
  const className = isWide ? 'stat-card stat-card--wide' : 'stat-card';
  const body = (
    <>
      <span className="stat-card__label">{label}</span>
      <span className={tier === undefined ? 'stat-card__value' : `stat-card__value is-${tier}`}>
        {value}
        {tier === undefined ? null : (
          <span
            className={tier === 'record' ? 'history__best is-record' : 'history__best'}
            aria-hidden="true"
          >
            {strings.history.star}
          </span>
        )}
      </span>
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

interface AverageCellProps {
  value: Average;
  /** Absent where there is no window behind the number to show. */
  onOpen?: () => void;
}

/** A number in the averages table, which opens the solves it was made of. */
function AverageCell({ value, onOpen }: AverageCellProps) {
  if (onOpen === undefined) return <td>{formatAverage(value)}</td>;
  return (
    <td>
      <button type="button" className="averages-table__open" onClick={onOpen}>
        {formatAverage(value)}
      </button>
    </td>
  );
}

const SCOPE_LABEL: Record<StatsScope, string> = {
  all: strings.stats.allSessions,
  recent: strings.stats.recent(RECENT_SOLVES),
  session: strings.stats.thisSession,
};

/** The second card's name: the best single of whatever is being read. */
const BEST_LABEL: Record<StatsScope, string> = {
  all: strings.stats.bestSingle,
  recent: strings.stats.recentBest(RECENT_SOLVES),
  session: strings.stats.sessionBest,
};

function sessionBestTier(bestMs: number | null, pbMs: number | null): StatTier | undefined {
  if (bestMs === null) return undefined;
  return bestMs === pbMs ? 'record' : 'best';
}

export function StatsScreen() {
  const session = useActiveSession(PUZZLE, MODE);
  // Every session is timed with the same method today, so the active one's
  // phases name the columns for all of them.
  const phases = usePhases(session?.methodId ?? null);
  const phaseKeys = useMemo(() => phases.map((phase) => phase.key), [phases]);
  const [scope, setScope] = useStatsScope();
  const stats = useSessionStats(
    scope === undefined
      ? null
      : scope === 'session'
        ? { kind: 'session', sessionId: session?.id ?? null }
        : { kind: scope },
    PUZZLE,
    phaseKeys,
  );
  const isAllSessions = scope !== 'session';
  const [trendMode, setTrendMode] = useSetting('stats.phaseTrendMode');
  const [isSmoothed, setSmoothed] = useSetting('stats.phaseTrendSmoothed');
  const [, setGoalMs] = useSetting('stats.goalMs');
  const [isByDay, setByDay] = useSetting('stats.trendByDay');
  const [isPickerOpen, setPickerOpen] = useState(false);
  const [openSolveId, setOpenSolveId] = useState<string | null>(null);
  const [openWindow, setOpenWindow] = useState<{ n: AverageWindow; at: WindowAt } | null>(
    null,
  );

  if (stats === null || scope === undefined) return <main className="screen screen--scroll" />;
  // Across sessions the best of what is read is usually the PB itself, and a
  // second card with the same number on it is not a second fact. It shows
  // when they differ — a PB set in a session since archived, or before the
  // latest hundred.
  const hasBestCard = scope === 'session' || stats.sessionBestMs !== stats.globalPbMs;
  const windowView =
    openWindow === null ? null : stats.averageWindow(openWindow.n, openWindow.at);

  return (
    <main className="screen screen--scroll">
      <div className="stats">
        <div>
          <div className="chart-modes" role="group" aria-label={strings.stats.scope}>
            {STATS_SCOPES.map((candidate) => (
              <button
                key={candidate}
                type="button"
                className={candidate === scope ? 'is-active' : undefined}
                aria-pressed={candidate === scope}
                onClick={() => setScope(candidate)}
              >
                {SCOPE_LABEL[candidate]}
              </button>
            ))}
          </div>
          <p className="history__summary">
            {/* Only a session can be switched; over all of them the name would
                lead into a picker that changes nothing on this screen. */}
            {isAllSessions ? null : (
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
            )}
            <span>
              {isAllSessions ? null : '· '}
              {stats.availableCount > stats.solveCount
                ? strings.stats.solvesOf(stats.solveCount, stats.availableCount)
                : `${stats.solveCount} ${strings.stats.solves}`}
            </span>
          </p>
        </div>

        {stats.solveCount === 0 ? (
          <p className="solves__empty">
            {isAllSessions ? strings.stats.emptyAll : strings.stats.empty}
          </p>
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
                tier={stats.globalPbMs === null ? undefined : 'record'}
                isWide={!hasBestCard}
                onOpen={
                  stats.globalPbSolveId === null
                    ? undefined
                    : () => setOpenSolveId(stats.globalPbSolveId)
                }
              />
              {hasBestCard ? (
                <StatCard
                  label={BEST_LABEL[scope]}
                  value={formatAverage(stats.sessionBestMs)}
                  // One colour, of the strongest thing it is — the history's rule.
                  tier={sessionBestTier(stats.sessionBestMs, stats.globalPbMs)}
                  onOpen={
                    stats.sessionBestSolveId === null
                      ? undefined
                      : () => setOpenSolveId(stats.sessionBestSolveId)
                  }
                />
              ) : null}
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

            <GoalSection goal={stats.goal} solveCount={stats.solveCount} onChange={setGoalMs} />

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
                      <th scope="row">ao{window.n}</th>
                      {(['current', 'best'] as const).map((which) => (
                        <AverageCell
                          key={which}
                          value={window[which]}
                          onOpen={
                            stats.averageWindow(window.n, which) === null
                              ? undefined
                              : () => setOpenWindow({ n: window.n, at: which })
                          }
                        />
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            <RecordsSection
              recordsFor={stats.recordsFor}
              globalPbMs={stats.globalPbMs}
              onOpenSolve={setOpenSolveId}
              onOpenWindow={(n, endIndex) => setOpenWindow({ n, at: { endIndex } })}
            />

            {stats.trend.length > 0 || stats.days.length > 1 ? (
              <section className="chart-card">
                <h2 className="stats__section-title">{strings.stats.trend}</h2>
                <div className="chart-modes" role="group" aria-label={strings.stats.trend}>
                  <button
                    type="button"
                    className={isByDay ? undefined : 'is-active'}
                    aria-pressed={!isByDay}
                    onClick={() => setByDay(false)}
                  >
                    {strings.stats.bySolve}
                  </button>
                  <button
                    type="button"
                    className={isByDay ? 'is-active' : undefined}
                    aria-pressed={isByDay}
                    onClick={() => setByDay(true)}
                  >
                    {strings.stats.byDay}
                  </button>
                </div>
                <Suspense fallback={<p className="solves__empty">{strings.stats.loadingCharts}</p>}>
                  {isByDay ? (
                    <DailyTrendChart days={stats.days} goalMs={stats.goal?.goalMs ?? null} />
                  ) : stats.trend.length > 0 ? (
                    <TrendChart
                      points={stats.trend}
                      bestMs={stats.bestAo12Ms}
                      fenceMs={stats.trendFenceMs}
                      goalMs={stats.goal?.goalMs ?? null}
                    />
                  ) : (
                    // Without a filled window there is no line and no axis
                    // worth drawing.
                    <p className="detail__hint">{strings.stats.trendNeedsSolves}</p>
                  )}
                </Suspense>
              </section>
            ) : null}

            <section className="chart-card">
              <h2 className="stats__section-title">{strings.stats.practice}</h2>
              <dl className="practice__figures">
                <div>
                  <dt>{strings.stats.streak}</dt>
                  <dd>{strings.stats.dayCount(stats.practice.streak)}</dd>
                </div>
                <div>
                  <dt>{strings.stats.daysPractised}</dt>
                  <dd>{strings.stats.daysOf(stats.practice.activeDays, PRACTICE_DAYS)}</dd>
                </div>
                <div>
                  <dt>{strings.stats.solvesLabel}</dt>
                  <dd>{stats.practice.solveCount}</dd>
                </div>
              </dl>
              <Suspense fallback={<p className="solves__empty">{strings.stats.loadingCharts}</p>}>
                <PracticeChart days={stats.practice.days} />
              </Suspense>
              <p className="chart-note">{strings.stats.practiceNote(PRACTICE_DAYS)}</p>
            </section>

            <section className="chart-card">
              <h2 className="stats__section-title">{strings.stats.distribution}</h2>
              <Suspense fallback={<p className="solves__empty">{strings.stats.loadingCharts}</p>}>
                <HistogramChart bins={stats.histogramBins} currentAoMs={stats.currentAo12Ms} />
              </Suspense>
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

          </>
        )}
      </div>

      {openSolveId === null ? null : (
        <SolveDetailSheet
          solveId={openSolveId}
          phases={phases}
          // Opened from an average, the sheet steps through that average's
          // solves; opened from a best, there is only the one.
          solveIds={windowView?.solves.map((solve) => solve.id) ?? NO_SOLVES}
          onOpen={setOpenSolveId}
          onClose={() => setOpenSolveId(null)}
        />
      )}

      {/* One panel at a time: the solve takes the list's place, and closing it
          comes back to the list rather than all the way out. */}
      {windowView === null || openSolveId !== null ? null : (
        <AverageSheet
          view={windowView}
          onOpenSolve={setOpenSolveId}
          onClose={() => setOpenWindow(null)}
        />
      )}

      {isPickerOpen ? (
        <SessionPicker onClose={() => setPickerOpen(false)} />
      ) : null}
    </main>
  );
}
