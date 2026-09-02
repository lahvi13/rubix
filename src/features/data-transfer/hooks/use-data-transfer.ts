import { useState } from 'react';
import { upgradeImportFormat } from '../../../db/migrations/import/upgrade';
import {
  applyImportPlan,
  buildExportFile,
  clearAllData,
  readSnapshot,
} from '../../../db/repositories/transfer-repository';
import {
  planImport,
  type ImportCounts,
  type ImportMode,
  type ImportPlan,
} from '../../../domain/transfer/merge';
import type { ExportData, ExportFile } from '../../../domain/transfer/types';
import { parseExportFile, type ImportProblem } from '../../../domain/transfer/validate';
import { downloadText } from '../../../lib/download';
import { reportError } from '../../../lib/errors';
import { formatIsoDate } from '../../../lib/format';
import { strings } from '../../../lib/strings';

export type TransferState =
  | { status: 'idle' }
  | { status: 'preview'; file: ExportFile; snapshot: ExportData; plan: ImportPlan }
  | { status: 'importing' }
  | { status: 'failed'; problem: ImportProblem };

/** What just happened, so the screen can say so. */
export type TransferNotice =
  | { kind: 'exported'; filename: string }
  | { kind: 'imported'; counts: ImportCounts }
  | { kind: 'deleted' };

export interface DataTransferView {
  state: TransferState;
  notice: TransferNotice | null;
  dismissNotice: () => void;
  mode: ImportMode;
  setMode: (mode: ImportMode) => void;
  exportToFile: () => Promise<void>;
  loadFile: (file: File) => Promise<void>;
  confirmImport: () => Promise<void>;
  cancel: () => void;
  deleteEverything: () => Promise<void>;
}

/**
 * Drives the data screen: a chosen file becomes a preview, and only a
 * confirmed preview touches the database. Reading and planning are separate
 * steps so the user always sees the consequences before anything is written.
 */
export function useDataTransfer(appVersion: string): DataTransferView {
  const [state, setState] = useState<TransferState>({ status: 'idle' });
  const [notice, setNotice] = useState<TransferNotice | null>(null);
  const [mode, setMode] = useState<ImportMode>('merge');

  const exportToFile = async (): Promise<void> => {
    setNotice(null);
    try {
      const file = await buildExportFile(appVersion);
      const filename = `rubix-${formatIsoDate(file.exportedAt)}.json`;
      // Compact: this is a backup, not a document, and an indented file is
      // roughly twice the size for the same content.
      downloadText(filename, JSON.stringify(file));
      setNotice({ kind: 'exported', filename });
    } catch (cause) {
      reportError(strings.data.exportFailed, cause);
    }
  };

  const loadFile = async (input: File): Promise<void> => {
    setNotice(null);

    let raw: unknown;
    try {
      raw = JSON.parse(await input.text());
    } catch {
      setState({ status: 'failed', problem: { code: 'notJson' } });
      return;
    }

    const parsed = parseExportFile(upgradeImportFormat(raw));
    if (!parsed.ok) {
      setState({ status: 'failed', problem: parsed.problem });
      return;
    }

    const snapshot = await readSnapshot();
    setState({
      status: 'preview',
      file: parsed.file,
      snapshot,
      plan: planImport(mode, snapshot, parsed.file.data),
    });
  };

  const changeMode = (next: ImportMode): void => {
    setMode(next);
    setState((current) =>
      current.status === 'preview'
        ? { ...current, plan: planImport(next, current.snapshot, current.file.data) }
        : current,
    );
  };

  const confirmImport = async (): Promise<void> => {
    if (state.status !== 'preview') return;
    const { file } = state;
    setState({ status: 'importing' });

    try {
      // Re-planned against the database as it is now: the preview was built
      // when the file was chosen, and solves may have been added since.
      const plan = planImport(mode, await readSnapshot(), file.data);
      await applyImportPlan(plan);
      setState({ status: 'idle' });
      setNotice({ kind: 'imported', counts: plan.counts });
    } catch (cause) {
      reportError(strings.data.importFailed, cause);
      setState({ status: 'idle' });
    }
  };

  const deleteEverything = async (): Promise<void> => {
    setNotice(null);
    try {
      await clearAllData();
      setState({ status: 'idle' });
      setNotice({ kind: 'deleted' });
    } catch (cause) {
      reportError(strings.data.deleteFailed, cause);
    }
  };

  return {
    state,
    notice,
    dismissNotice: () => setNotice(null),
    mode,
    setMode: changeMode,
    exportToFile,
    loadFile,
    confirmImport,
    cancel: () => setState({ status: 'idle' }),
    deleteEverything,
  };
}
