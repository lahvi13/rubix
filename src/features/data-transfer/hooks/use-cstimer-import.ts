import { useState } from 'react';
import {
  applyCsTimerPlan,
  readSolveKeys,
  type CsTimerImported,
  type ImportProgress,
} from '../../../db/repositories/cstimer-repository';
import { getMethodPhases } from '../../../db/repositories/method-repository';
import { DEFAULT_METHOD_ID, activateSession } from '../../../db/repositories/session-repository';
import {
  parseCsTimerCsv,
  parseCsTimerJson,
  planCsTimerImport,
  type CsTimerParse,
  type CsTimerPlan,
  type CsTimerProblem,
  type SkippedRow,
} from '../../../domain/transfer/cstimer';
import { logQuietly, reportError } from '../../../lib/errors';
import { strings } from '../../../lib/strings';

/** What a CSV cannot say about itself, so this is what it is taken to be. */
const CSV_PUZZLE = '333';

export type CsTimerState =
  | { status: 'idle' }
  | { status: 'reading' }
  | {
      status: 'preview';
      plan: CsTimerPlan;
      filename: string;
      isCsv: boolean;
      /**
       * The phases the plan was made with, carried to the write. Read once,
       * because a preview counted against a method that had not loaded yet
       * would promise a different import than the one that happens.
       */
      phaseKeys: string[];
    }
  | { status: 'importing'; progress: ImportProgress }
  | { status: 'failed'; problem: CsTimerProblem };

export interface CsTimerOutcome {
  imported: number;
  skipped: SkippedRow[];
  /**
   * The imported sessions the timer can be switched to. Only 3×3: the timer
   * times nothing else, and an import never switches by itself — somebody
   * part-way through a session must not find their next solve elsewhere.
   */
  sessions: CsTimerImported['sessions'];
  /** The one switched to from here, once it has been. */
  switchedTo: string | null;
}

export interface CsTimerImportView {
  state: CsTimerState;
  outcome: CsTimerOutcome | null;
  loadFile: (file: File) => Promise<void>;
  confirmImport: () => Promise<void>;
  switchTo: (sessionId: string) => Promise<void>;
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

  const loadFile = async (input: File): Promise<void> => {
    setOutcome(null);
    setState({ status: 'reading' });

    // A file can stop being readable between being picked and being read —
    // moved, or a permission withdrawn. Without this the screen would sit on
    // 'reading' for ever and the only sign would be an unhandled rejection.
    let text: string;
    try {
      text = await input.text();
    } catch (cause) {
      logQuietly(strings.cstimer.failed, cause);
      setState({ status: 'failed', problem: 'unreadable' });
      return;
    }
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
      const phaseKeys = (await getMethodPhases(DEFAULT_METHOD_ID)).map((phase) => phase.key);
      const plan = planCsTimerImport(parsed.file, await readSolveKeys(), phaseKeys.length);
      setState({ status: 'preview', plan, filename: input.name, isCsv, phaseKeys });
    } catch (cause) {
      reportError(strings.cstimer.failed, cause);
      setState({ status: 'idle' });
    }
  };

  const confirmImport = async (): Promise<void> => {
    if (state.status !== 'preview') return;
    const { plan, phaseKeys } = state;
    setState({ status: 'importing', progress: { written: 0, total: plan.newSolves } });

    try {
      const imported = await applyCsTimerPlan(
        plan,
        phaseKeys,
        (progress) => setState({ status: 'importing', progress }),
      );
      setState({ status: 'idle' });
      setOutcome({
        imported: imported.written,
        skipped: plan.skipped,
        sessions: imported.sessions.filter((session) => session.puzzle === '333'),
        switchedTo: null,
      });
    } catch (cause) {
      reportError(strings.cstimer.failed, cause);
      setState({ status: 'idle' });
    }
  };

  const switchTo = async (sessionId: string): Promise<void> => {
    try {
      await activateSession(sessionId);
      setOutcome((current) => (current === null ? null : { ...current, switchedTo: sessionId }));
    } catch (cause) {
      reportError(strings.cstimer.failed, cause);
    }
  };

  return {
    state,
    outcome,
    loadFile,
    confirmImport,
    switchTo,
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
