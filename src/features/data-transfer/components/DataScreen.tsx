import { useRef, useState } from 'react';
import { ChevronIcon } from '../../../components/Icons';
import { Notice } from '../../../components/Notice';
import {
  hasChanges,
  totalCounts,
  type ImportCounts,
  type ImportMode,
} from '../../../domain/transfer/merge';
import { totalRecords } from '../../../domain/transfer/backup-reminder';
import type { SkipReason, SkippedRow } from '../../../domain/transfer/cstimer';
import { TRANSFER_TABLES } from '../../../domain/transfer/types';
import type { ImportProblem } from '../../../domain/transfer/validate';
import { useDatabaseHealth } from '../../../hooks/use-database-health';
import { now } from '../../../lib/clock';
import { formatBytes, formatDateTime, formatDay } from '../../../lib/format';
import { strings } from '../../../lib/strings';
import { useBackupStatus, type BackupStatus } from '../hooks/use-backup-status';
import { useConfirmDelay } from '../hooks/use-confirm-delay';
import {
  useCsTimerImport,
  type CsTimerImportView,
  type CsTimerState,
} from '../hooks/use-cstimer-import';
import { useDataTransfer, type TransferNotice } from '../hooks/use-data-transfer';

const IMPORT_MODES: readonly ImportMode[] = ['merge', 'replace'];

/** Long enough that the button cannot be part of the same reflex as the first. */
const DELETE_CONFIRM_SECONDS = 5;

export function DataScreen() {
  const {
    state,
    notice,
    dismissNotice,
    mode,
    setMode,
    exportToFile,
    canShareBackup,
    shareBackup,
    shareOutcome,
    exportSolvesToCsv,
    loadFile,
    confirmImport,
    cancel,
    deleteEverything,
  } = useDataTransfer(__APP_VERSION__);
  const deleteConfirm = useConfirmDelay(DELETE_CONFIRM_SECONDS);
  const backup = useBackupStatus();
  const cstimer = useCsTimerImport();

  return (
    <main className="screen screen--scroll">
      {notice ? (
        <Notice onDismiss={dismissNotice}>
          <NoticeBody notice={notice} />
        </Notice>
      ) : null}

      <section className="data-section">
        <h2 className="data-section__title">{strings.data.exportTitle}</h2>
        <p className="data-section__hint">{strings.data.exportHint}</p>
        <BackupLine status={backup} />
        {/* What the section is for, right under what there is to lose. The
            CSV shares the row; its note under both names it, or it read as a
            caveat about the backup as a whole. */}
        <div className="data-section__row">
          <button type="button" className="is-primary" onClick={() => void exportToFile()}>
            {strings.data.exportAction}
          </button>
          <button type="button" onClick={() => void exportSolvesToCsv()}>
            {strings.data.exportCsvAction}
          </button>
          {canShareBackup ? (
            <button type="button" onClick={() => void shareBackup()}>
              {strings.data.shareBackup}
            </button>
          ) : null}
        </div>
        {canShareBackup ? (
          <p className="data-section__hint data-section__hint--after">
            {shareOutcome === 'failed' ? strings.data.shareFailed : strings.data.shareHint}
          </p>
        ) : null}
        <p className="data-section__hint data-section__hint--after">{strings.data.exportCsvHint}</p>
        <StorageLines status={backup} />
      </section>

      <section className="data-section">
        <h2 className="data-section__title">{strings.data.importTitle}</h2>
        <p className="data-section__hint">{strings.data.importHint}</p>

        {/* Both ways in are a file to pick, so they are one row: the app's
            own backup, and another timer's history. Each keeps its own
            preview, below, because they read different files and say
            different things about them. */}
        <div className="data-section__row">
          <FileButton
            label={strings.data.chooseFile}
            accept="application/json,.json,text/plain,.txt"
            onFile={(file) => void loadFile(file)}
          />
          <FileButton
            label={strings.cstimer.chooseFile}
            accept=".txt,.json,.csv,text/plain,text/csv,application/json"
            onFile={(file) => void cstimer.loadFile(file)}
          />
        </div>
        <p className="data-section__hint data-section__hint--after">{strings.cstimer.hint}</p>

        {state.status === 'failed' ? (
          <p className="data-section__error">{problemMessage(state.problem)}</p>
        ) : null}

        {state.status === 'importing' ? (
          <p className="data-section__hint">{strings.data.importing}</p>
        ) : null}

        {state.status === 'preview' ? (
          <div className="import-preview">
            <p className="data-section__hint">
              {strings.data.fileFrom} {formatDateTime(state.file.exportedAt)} · v
              {state.file.appVersion}
            </p>

            <fieldset className="import-modes">
              <legend>{strings.data.mode}</legend>
              {IMPORT_MODES.map((option) => (
                <label key={option} className="import-modes__option">
                  <input
                    type="radio"
                    name="import-mode"
                    value={option}
                    checked={mode === option}
                    onChange={() => setMode(option)}
                  />
                  <span className="import-modes__label">
                    {option === 'merge' ? strings.data.modeMerge : strings.data.modeReplace}
                  </span>
                  <span className="import-modes__hint">
                    {option === 'merge' ? strings.data.modeMergeHint : strings.data.modeReplaceHint}
                  </span>
                </label>
              ))}
            </fieldset>

            <h3 className="data-section__subtitle">{strings.data.previewTitle}</h3>
            {hasChanges(state.plan.counts) ? (
              <PreviewTable counts={state.plan.counts} />
            ) : (
              <p className="data-section__hint">{strings.data.nothingToDo}</p>
            )}

            <div className="import-preview__actions">
              <button
                type="button"
                className={mode === 'replace' ? 'is-danger' : 'is-primary'}
                onClick={() => void confirmImport()}
              >
                {strings.data.confirmImport}
              </button>
              <button type="button" onClick={cancel}>
                {strings.data.cancel}
              </button>
            </div>
          </div>
        ) : null}

        <CsTimerFlow view={cstimer} />
      </section>

      <Troubleshooting />

      {/* Last: the one thing on the screen with no way back. */}
      <section className="data-section data-section--danger">
        <h2 className="data-section__title">{strings.data.dangerTitle}</h2>
        <p className="data-section__hint">{strings.data.dangerHint}</p>
        {deleteConfirm.isArmed ? (
          <>
            <p className="data-section__warning">{strings.data.deleteArmed}</p>
            <div className="data-section__row">
              <button
                type="button"
                className="is-danger"
                disabled={!deleteConfirm.isReady}
                onClick={() => {
                  deleteConfirm.reset();
                  void deleteEverything();
                }}
              >
                {deleteConfirm.isReady
                  ? strings.data.deleteConfirm
                  : `${strings.data.deleteConfirm} (${deleteConfirm.remaining})`}
              </button>
              <button type="button" onClick={deleteConfirm.reset}>
                {strings.data.cancel}
              </button>
            </div>
          </>
        ) : (
          <button type="button" onClick={deleteConfirm.arm}>
            {strings.data.deleteAll}
          </button>
        )}
      </section>
    </main>
  );
}

/**
 * How much there is to lose, said next to the button that saves it. With no
 * sync, a backup nobody remembers taking is the likeliest way to lose months.
 */
function BackupLine({ status }: { status: BackupStatus }) {
  const { lastExportAt, lastExportBytes, changedSince } = status;
  if (changedSince === undefined) return null;

  return (
    <p className="backup-status">
      {lastExportAt === null
        ? `${strings.data.noBackup}${totalRecords(changedSince) > 0 ? ` ${strings.data.onlyHere(changedSince)}` : ''}`
        : `${strings.data.lastBackup(
            formatDay(lastExportAt, now()),
            lastExportBytes === null ? null : formatBytes(lastExportBytes),
          )} ${strings.data.changedSince(changedSince)}`}
    </p>
  );
}

/**
 * Whether this device is a copy worth trusting at all, after the files: the
 * request for lasting storage is a thing done once, and above the export it
 * stood between the reader and the button the section is for.
 */
function StorageLines({ status }: { status: BackupStatus }) {
  const { isPersisted, keepStorage } = status;
  const [isRefused, setRefused] = useState(false);
  if (isPersisted === undefined || isPersisted === null) return null;

  return (
    <div className="backup-storage">
      <p className="backup-status">
        {isPersisted ? strings.data.storageKept : strings.data.storageMayClear}
      </p>
      {isPersisted ? null : (
        <>
          <button
            type="button"
            onClick={() => void keepStorage().then((isGranted) => setRefused(!isGranted))}
          >
            {strings.data.keepStorage}
          </button>
          {isRefused ? <p className="backup-status__refused">{strings.data.keepStorageRefused}</p> : null}
        </>
      )}
    </div>
  );
}

/**
 * The app's own button in front of the browser's file input, which draws
 * "Choose File · No file chosen" in whatever style the browser likes. The
 * input stays in the page, labelled, because it is what does the picking.
 */
function FileButton({
  label,
  accept,
  onFile,
}: {
  label: string;
  accept: string;
  onFile: (file: File) => void;
}) {
  const input = useRef<HTMLInputElement>(null);

  return (
    <>
      <button type="button" onClick={() => input.current?.click()}>
        {label}
      </button>
      <input
        ref={input}
        type="file"
        hidden
        accept={accept}
        aria-label={label}
        onChange={(event) => {
          const file = event.target.files?.[0];
          // Cleared so picking the same file again still fires a change.
          event.target.value = '';
          if (file) onFile(file);
        }}
      />
    </>
  );
}

/**
 * Bringing a history over from csTimer: its own flow beside the app's restore.
 * It reads a foreign file, it can only ever add, and what it cannot take —
 * a 6×6 session, a row csTimer wrote in a way this app cannot read — has to be
 * said out loud rather than silently dropped.
 */
function CsTimerFlow({ view }: { view: CsTimerImportView }) {
  const { state, outcome, confirmImport, switchTo, cancel } = view;

  return (
    <>

      {state.status === 'reading' ? (
        <p className="data-section__hint">{strings.cstimer.reading}</p>
      ) : null}

      {state.status === 'failed' ? (
        <p className="data-section__error">{strings.cstimer.problems[state.problem]}</p>
      ) : null}

      {state.status === 'importing' ? (
        <p className="data-section__hint">
          {strings.cstimer.importing(state.progress.written, state.progress.total)}
        </p>
      ) : null}

      {state.status === 'preview' ? <CsTimerPreview state={state} /> : null}

      {state.status === 'preview' ? (
        <div className="import-preview__actions">
          <button
            type="button"
            className="is-primary"
            disabled={state.plan.newSolves === 0}
            onClick={() => void confirmImport()}
          >
            {strings.cstimer.confirm}
          </button>
          <button type="button" onClick={cancel}>
            {strings.data.cancel}
          </button>
        </div>
      ) : null}

      {outcome ? (
        <>
          <p className="data-section__hint">
            {strings.cstimer.imported(outcome.imported)}{' '}
            {outcome.imported > 0 ? strings.cstimer.whereToFind : ''}
          </p>
          {/* The new sessions are not the active one, so the timer and the
              history still show the old: an empty one, right after somebody
              brought a whole history over. One tap fixes that. */}
          {outcome.sessions.length === 0 ? null : outcome.switchedTo === null ? (
            <div className="data-section__row">
              {outcome.sessions.map((session) => (
                <button key={session.id} type="button" onClick={() => void switchTo(session.id)}>
                  {strings.cstimer.switchTo(session.name)}
                </button>
              ))}
            </div>
          ) : (
            <p className="data-section__hint">
              {strings.cstimer.switchedTo(
                outcome.sessions.find((session) => session.id === outcome.switchedTo)?.name ?? '',
              )}
            </p>
          )}
          <SkippedRows rows={outcome.skipped} />
        </>
      ) : null}
    </>
  );
}

function CsTimerPreview({ state }: { state: Extract<CsTimerState, { status: 'preview' }> }) {
  const { plan } = state;

  return (
    <div className="import-preview">
      <p className="data-section__hint">
        {strings.cstimer.found(plan.newSolves, plan.sessions.length)} ·{' '}
        {strings.cstimer.withPhases(plan.withPhases)}
        {plan.phasesDropped > 0
          ? ` · ${strings.cstimer.phasesDropped(plan.phasesDropped)}`
          : ''}
        {plan.duplicates > 0 ? ` · ${strings.cstimer.duplicates(plan.duplicates)}` : ''}
        {plan.skipped.length > 0 ? ` · ${strings.cstimer.skippedRows(plan.skipped.length)}` : ''}
      </p>

      {state.isCsv ? (
        <p className="data-section__hint">
          {strings.cstimer.csvNote(plan.sessions[0]?.name ?? state.filename)}
        </p>
      ) : null}

      {plan.newSolves === 0 ? (
        <p className="data-section__hint">{strings.cstimer.nothingNew}</p>
      ) : (
        <table className="preview-table">
          <thead>
            <tr>
              <th scope="col">{strings.cstimer.session}</th>
              <th scope="col">{strings.cstimer.puzzle}</th>
              <th scope="col">{strings.cstimer.newSolves}</th>
            </tr>
          </thead>
          <tbody>
            {plan.sessions.map((session) => (
              <tr key={`${session.name}-${session.puzzle}`}>
                <th scope="row">{session.name}</th>
                <td>{strings.cstimer.puzzles[session.puzzle]}</td>
                <td>{session.solves.length}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {plan.unsupported.length > 0 ? (
        <>
          <h3 className="data-section__subtitle">{strings.cstimer.unsupportedTitle}</h3>
          <ul className="data-section__list">
            {plan.unsupported.map((session) => (
              <li key={session.name}>
                {strings.cstimer.unsupported(
                  session.name,
                  session.scrambleType,
                  session.solves,
                )}
              </li>
            ))}
          </ul>
        </>
      ) : null}

      <SkippedRows rows={plan.skipped} />
    </div>
  );
}

/** Grouped by what was wrong with them — a list of two thousand would say less. */
function SkippedRows({ rows }: { rows: readonly SkippedRow[] }) {
  if (rows.length === 0) return null;

  const byReason = new Map<SkipReason, SkippedRow[]>();
  for (const row of rows) {
    const group = byReason.get(row.reason) ?? [];
    group.push(row);
    byReason.set(row.reason, group);
  }

  return (
    <>
      <h3 className="data-section__subtitle">{strings.cstimer.skippedTitle}</h3>
      <ul className="data-section__list">
        {[...byReason].map(([reason, group]) => (
          <li key={reason}>
            {strings.cstimer.reasons[reason]} — {group.length}
            {': '}
            {group
              .slice(0, SHOWN_SKIPPED)
              .map((row) => `${row.session} #${row.index}`)
              .join(', ')}
            {group.length > SHOWN_SKIPPED ? '…' : ''}
          </li>
        ))}
      </ul>
    </>
  );
}

/** Enough to find them in csTimer; the count says how many more there are. */
const SHOWN_SKIPPED = 5;

/**
 * The way out of a database that stopped answering, and the record of what
 * went wrong. An installed app has no console and no address bar, so without
 * this the only cure a user can find is opening the site in a browser.
 */
function Troubleshooting() {
  const { isOpen, errors, reconnect, survey, clearErrors } = useDatabaseHealth();
  const [outcome, setOutcome] = useState<string | null>(null);
  const hasFailures = errors.length > 0;
  const [isExpanded, setExpanded] = useState(hasFailures);

  // Folded while there is nothing to see, and unfolded by a failure that turns
  // up while the screen is open. A connection that is merely closed does not
  // unfold it: the phone closes it all the time and the next read reopens it,
  // and one that really cannot come back logs a failure of its own. Adjusted
  // during render, or the section would paint folded first.
  const [hadFailures, setHadFailures] = useState(hasFailures);
  if (hasFailures !== hadFailures) {
    setHadFailures(hasFailures);
    if (hasFailures) setExpanded(true);
  }

  return (
    <section className="data-section">
      <h2 className="data-section__title">{strings.diagnostics.title}</h2>
      <button
        type="button"
        className="diagnostics__toggle"
        aria-expanded={isExpanded}
        onClick={() => setExpanded((expanded) => !expanded)}
      >
        <span>
          <span className={isOpen ? undefined : 'diagnostics__bad'}>
            {isOpen ? strings.diagnostics.databaseOpen : strings.diagnostics.databaseClosed}
          </span>
          {' · '}
          <span className={hasFailures ? 'diagnostics__bad' : undefined}>
            {strings.diagnostics.failures(errors.length)}
          </span>
        </span>
        <ChevronIcon up={isExpanded} />
      </button>

      {isExpanded ? (
        <div className="diagnostics__tools">
          <p className="data-section__hint">{strings.diagnostics.hint}</p>

          <div className="data-section__row">
            <button
              type="button"
              onClick={() => {
                void reconnect().then((ok) =>
                  setOutcome(ok ? strings.diagnostics.reconnected : strings.diagnostics.stillBroken),
                );
              }}
            >
              {strings.diagnostics.reconnect}
            </button>
            <button type="button" onClick={() => window.location.reload()}>
              {strings.diagnostics.reload}
            </button>
            <button type="button" onClick={() => void survey().then(setOutcome)}>
              {strings.diagnostics.survey}
            </button>
          </div>
          {outcome === null ? null : (
            <p className="data-section__hint diagnostics__outcome">{outcome}</p>
          )}

          <h3 className="data-section__subtitle">{strings.diagnostics.recent}</h3>
          {hasFailures ? (
            <>
              <ul className="diagnostics__log">
                {errors.map((error) => (
                  <li key={`${error.at}-${error.message}`}>
                    <span className="diagnostics__when">{formatDateTime(error.at)}</span>
                    {error.context}: {error.message}
                  </li>
                ))}
              </ul>
              <button type="button" onClick={clearErrors}>
                {strings.diagnostics.clear}
              </button>
            </>
          ) : (
            <p className="data-section__hint">{strings.diagnostics.none}</p>
          )}
        </div>
      ) : null}
    </section>
  );
}

function NoticeBody({ notice }: { notice: TransferNotice }) {
  if (notice.kind === 'exported' || notice.kind === 'exportedCsv') {
    return (
      <span>
        {notice.kind === 'exported' ? strings.data.exported : strings.data.exportedCsv}{' '}
        <code>{notice.filename}</code>
      </span>
    );
  }
  if (notice.kind === 'deleted') return <span>{strings.data.deletedAll}</span>;

  return (
    <>
      <span>{strings.data.imported}</span>
      <CountsSummary counts={notice.counts} />
    </>
  );
}

/** Only the tables an import would touch; the rest would be a wall of zeroes. */
function PreviewTable({ counts }: { counts: ImportCounts }) {
  const rows = TRANSFER_TABLES.filter((table) => {
    const row = counts[table];
    return row.added + row.updated + row.deleted > 0;
  });

  return (
    <table className="preview-table">
      <thead>
        <tr>
          <th scope="col">{strings.data.table}</th>
          <th scope="col">{strings.data.added}</th>
          <th scope="col">{strings.data.updated}</th>
          <th scope="col">{strings.data.deleted}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((table) => (
          <tr key={table}>
            <th scope="row">{strings.data.tables[table]}</th>
            <td>{counts[table].added}</td>
            <td>{counts[table].updated}</td>
            <td>{counts[table].deleted}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function CountsSummary({ counts }: { counts: ImportCounts }) {
  const total = totalCounts(counts);

  return (
    <dl className="import-totals">
      <div className="import-totals__item">
        <dt>{strings.data.added}</dt>
        <dd>{total.added}</dd>
      </div>
      <div className="import-totals__item">
        <dt>{strings.data.updated}</dt>
        <dd>{total.updated}</dd>
      </div>
      <div className="import-totals__item">
        <dt>{strings.data.deleted}</dt>
        <dd>{total.deleted}</dd>
      </div>
    </dl>
  );
}

function problemMessage(problem: ImportProblem): string {
  if (problem.code === 'invalidRow') {
    const table = strings.data.tables[problem.table];
    return `${strings.data.problems.invalidRow} (${table} #${problem.index + 1})`;
  }
  return strings.data.problems[problem.code];
}
