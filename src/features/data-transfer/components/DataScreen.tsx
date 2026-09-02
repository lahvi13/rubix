import { Notice } from '../../../components/Notice';
import {
  hasChanges,
  totalCounts,
  type ImportCounts,
  type ImportMode,
} from '../../../domain/transfer/merge';
import { TRANSFER_TABLES } from '../../../domain/transfer/types';
import type { ImportProblem } from '../../../domain/transfer/validate';
import { formatDateTime } from '../../../lib/format';
import { strings } from '../../../lib/strings';
import { useConfirmDelay } from '../hooks/use-confirm-delay';
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
    loadFile,
    confirmImport,
    cancel,
    deleteEverything,
  } = useDataTransfer(__APP_VERSION__);
  const deleteConfirm = useConfirmDelay(DELETE_CONFIRM_SECONDS);

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
        <button type="button" className="is-primary" onClick={() => void exportToFile()}>
          {strings.data.exportAction}
        </button>
      </section>

      <section className="data-section">
        <h2 className="data-section__title">{strings.data.importTitle}</h2>
        <p className="data-section__hint">{strings.data.importHint}</p>

        <input
          type="file"
          accept="application/json,.json"
          aria-label={strings.data.chooseFile}
          onChange={(event) => {
            const file = event.target.files?.[0];
            // Cleared so picking the same file again still fires a change.
            event.target.value = '';
            if (file) void loadFile(file);
          }}
        />

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
      </section>

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

function NoticeBody({ notice }: { notice: TransferNotice }) {
  if (notice.kind === 'exported') {
    return (
      <span>
        {strings.data.exported} <code>{notice.filename}</code>
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
