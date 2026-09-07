import { useState } from 'react';
import {
  applyCsTimerPlan,
  readSolveKeys,
  type ImportProgress,
} from '../../../db/repositories/cstimer-repository';
import { DEFAULT_METHOD_ID } from '../../../db/repositories/session-repository';
import {
  parseCsTimerCsv,
  parseCsTimerJson,
  planCsTimerImport,
  type CsTimerParse,
  type CsTimerPlan,
  type CsTimerProblem,
  type SkippedRow,
} from '../../../domain/transfer/cstimer';
import { reportError } from '../../../lib/errors';
import { strings } from '../../../lib/strings';
import { usePhases } from '../../splits';

/** What a CSV cannot say about itself, so this is what it is taken to be. */
const CSV_PUZZLE = '333';

export type CsTimerState =
  | { status: 'idle' }
  | { status: 'reading' }
  | { status: 'preview'; plan: CsTimerPlan; filename: string; isCsv: boolean }
  | { status: 'importing'; progress: ImportProgress }
  | { status: 'failed'; problem: CsTimerProblem };

export interface CsTimerOutcome {
  imported: number;
  skipped: SkippedRow[];
}

export interface CsTimerImportView {
  state: CsTimerState;
  outcome: CsTimerOutcome | null;
  loadFile: (file: File) => Promise<void>;
  confirmImport: () => Promise<void>;
  cancel: () => void;
}

/**
 * The csTimer import: read the file, say what it would do, and only then
 * write. Same shape as the app's own import, for the same reason — the file
 * comes from another program and nobody can be asked to trust it sight
 * unseen.
 */
export function useCsTimerImport(): CsTimerImportView {
  const [state, setState] = useState<CsTimerState>({ status: 'idle' });
  const [outcome, setOutcome] = useState<CsTimerOutcome | null>(null);
  const phases = usePhases(DEFAULT_METHOD_ID);

  const loadFile = async (input: File): Promise<void> => {
    setOutcome(null);
    setState({ status: 'reading' });

    const text = await input.text();
    const name = sessionNameOf(input.name);
    const isCsv = looksLikeCsv(text);
    const parsed: CsTimerParse = isCsv
      ? parseCsTimerCsv(text, name, CSV_PUZZLE)
      : parseCsTimerJson(text);

    if (!parsed.ok) {
      setState({ status: 'failed', problem: parsed.problem });
      return;
    }

    try {
      const plan = planCsTimerImport(parsed.file, await readSolveKeys(), phases.length);
      setState({ status: 'preview', plan, filename: input.name, isCsv });
    } catch (cause) {
      reportError(strings.cstimer.failed, cause);
      setState({ status: 'idle' });
    }
  };

  const confirmImport = async (): Promise<void> => {
    if (state.status !== 'preview') return;
    const { plan } = state;
    setState({ status: 'importing', progress: { written: 0, total: plan.newSolves } });

    try {
      const imported = await applyCsTimerPlan(
        plan,
        phases.map((phase) => phase.key),
        (progress) => setState({ status: 'importing', progress }),
      );
      setState({ status: 'idle' });
      setOutcome({ imported, skipped: plan.skipped });
    } catch (cause) {
      reportError(strings.cstimer.failed, cause);
      setState({ status: 'idle' });
    }
  };

  return {
    state,
    outcome,
    loadFile,
    confirmImport,
    cancel: () => setState({ status: 'idle' }),
  };
}

/**
 * csTimer exports its JSON with a .txt name, so the extension says nothing —
 * the header does. Only the CSV has one.
 */
function looksLikeCsv(text: string): boolean {
  const start = text.charCodeAt(0) === 0xfeff ? text.slice(1, 32) : text.slice(0, 32);
  return start.startsWith('No.;');
}

/** A CSV carries no session name, so the file's own name stands in for it. */
function sessionNameOf(filename: string): string {
  const withoutExtension = filename.replace(/\.[^.]+$/, '').trim();
  return withoutExtension === '' ? strings.cstimer.importedSession : withoutExtension;
}
