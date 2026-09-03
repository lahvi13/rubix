/**
 * Minimal in-app error channel. Nothing leaves the device — this is not
 * telemetry, it is the only way a failure can become visible in an offline
 * app with no console open.
 */

import { strings } from './strings';

export interface AppError {
  context: string;
  message: string;
  at: number;
}

type Listener = (error: AppError) => void;

const listeners = new Set<Listener>();
let last: AppError | null = null;

/**
 * The log outlives the page. A failure that freezes the app is usually found
 * only after a restart, by which time an in-memory error is gone — and the one
 * question worth answering then is what broke before the restart.
 */
const LOG_KEY = 'rubix.errors';
const LOG_SIZE = 8;

export function reportError(context: string, cause: unknown): void {
  const message = describe(cause);
  last = { context, message, at: Date.now() };
  remember(last);
  for (const listener of listeners) listener(last);
}

/**
 * The name is what identifies a database failure — DatabaseClosedError and
 * VersionError need different answers — so it is kept whenever it says
 * something the message does not.
 */
function describe(cause: unknown): string {
  if (!(cause instanceof Error)) return String(cause);
  return cause.name === 'Error' ? cause.message : `${cause.name}: ${cause.message}`;
}

function remember(error: AppError): void {
  try {
    window.localStorage.setItem(
      LOG_KEY,
      JSON.stringify([error, ...recentErrors()].slice(0, LOG_SIZE)),
    );
  } catch {
    // A full or blocked storage must not turn error reporting into an error.
  }
}

export function recentErrors(): AppError[] {
  try {
    const stored: unknown = JSON.parse(window.localStorage.getItem(LOG_KEY) ?? '[]');
    if (!Array.isArray(stored)) return [];
    return stored.filter(isAppError);
  } catch {
    return [];
  }
}

export function forgetErrors(): void {
  try {
    window.localStorage.removeItem(LOG_KEY);
  } catch {
    // Nothing to do; the log is a convenience, not state anything depends on.
  }
}

function isAppError(value: unknown): value is AppError {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.context === 'string' &&
    typeof candidate.message === 'string' &&
    typeof candidate.at === 'number'
  );
}

/**
 * Writes to the log without raising the banner. For failures the app has
 * already dealt with: worth having when someone asks what happened, not worth
 * a red box in front of a user who saw nothing go wrong.
 */
export function logQuietly(context: string, cause: unknown): void {
  remember({ context, message: describe(cause), at: Date.now() });
}

export function onError(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function lastError(): AppError | null {
  return last;
}

export function clearError(): void {
  last = null;
}

/**
 * How long a write may take before it is worth asking whether the database is
 * still there. Generous, because a phone busy loading the 3D cube can hold the
 * main thread for seconds and every promise waits with it.
 */
const WRITE_TIMEOUT_MS = 8000;

/** How long the probe gets to prove the database is alive. */
const PROBE_TIMEOUT_MS = 4000;

export interface WriteWatchdog {
  /** A trivial read. If this answers, the slow write was only slow. */
  probe: () => Promise<unknown>;
  /** What is stuck, in one line, for the log to carry to whoever asks. */
  survey: () => Promise<string>;
  /** Opens the connection if it is gone, without disturbing a working one. */
  reopen: () => Promise<unknown>;
  /** Closes and opens again, which also throws away whatever was stuck. */
  recover: () => Promise<unknown>;
}

let watchdog: WriteWatchdog | null = null;
let isRecovering = false;

/** Installed by the database layer; `lib` must not reach for Dexie itself. */
export function installWriteWatchdog(next: WriteWatchdog): void {
  watchdog = next;
}

async function settlesWithin<T>(work: Promise<T>, ms: number): Promise<boolean> {
  const timeout = Symbol('timeout');
  const outcome = await Promise.race([
    work.then(
      () => 'settled',
      () => 'settled',
    ),
    new Promise((resolve) => setTimeout(() => resolve(timeout), ms)),
  ]);
  return outcome !== timeout;
}

/** A timer this late means the thread is busy, not that the database is gone. */
const JAM_THRESHOLD_MS = 250;

/**
 * How long a zero-delay timer really takes. Rendering fifty cube diagrams, or
 * cubing.js starting up, blocks everything for seconds — and while it does, a
 * database call cannot answer either.
 */
export async function isMainThreadJammed(): Promise<boolean> {
  const start = performance.now();
  await new Promise((resolve) => setTimeout(resolve, 0));
  return performance.now() - start > JAM_THRESHOLD_MS;
}

/**
 * A write nobody awaits, and it is given a second chance rather than a report.
 *
 * The phone takes the connection away whenever it feels like it — often while
 * a tap is being written — and a write caught by that is simply lost. So the
 * work is passed as something that can be run again: if the first attempt
 * fails or hangs, the connection is put back and the write is repeated. Only a
 * second failure is worth telling the user about, because only then did their
 * tap really not happen.
 *
 * A slow write on its own means nothing: a phone loading the 3D cube blocks
 * the main thread for seconds. That is what the probe is for — a plain read
 * that answers proves the database is fine and the alarm stays down.
 */
export function watchWrite(run: () => Promise<unknown>, context: string): void {
  let isDone = false;
  const first = run();
  const timer = setTimeout(() => void checkOn(), WRITE_TIMEOUT_MS);

  /** The write again, on a connection that has been put back first. */
  async function retry(repair: () => Promise<unknown>): Promise<void> {
    if (isDone || isRecovering) return;
    isRecovering = true;
    try {
      await repair();
      await run();
      isDone = true;
    } catch (cause: unknown) {
      isDone = true;
      reportError(context, cause);
    } finally {
      isRecovering = false;
      clearTimeout(timer);
    }
  }

  async function checkOn(): Promise<void> {
    if (isDone) return;
    if (watchdog === null) {
      reportError(context, new Error(strings.errors.notResponding));
      return;
    }

    // Busy is not broken: if a plain read comes back, the write is on its way.
    if (await settlesWithin(watchdog.probe(), PROBE_TIMEOUT_MS)) return;
    if (isDone) return;

    // Nor is a jammed main thread: nothing can answer while it is blocked, the
    // database least of all, and closing the connection would help nobody.
    if (await isMainThreadJammed()) {
      logQuietly(context, new Error(strings.errors.mainThreadBusy));
      return;
    }

    logQuietly(context, new Error(strings.errors.notResponding));
    logQuietly(strings.errors.databaseSurvey, await watchdog.survey());
    await retry(watchdog.recover);
  }

  void first.then(
    () => {
      isDone = true;
      clearTimeout(timer);
    },
    (cause: unknown) => {
      // A connection taken away mid-write: reopen and do it again.
      if (watchdog === null) {
        isDone = true;
        reportError(context, cause);
        return;
      }
      logQuietly(context, cause);
      void retry(watchdog.reopen);
    },
  );
}

/** Catches the failures nobody remembered to await. */
export function installGlobalErrorHandlers(): void {
  window.addEventListener('unhandledrejection', (event) => {
    reportError('unhandled', event.reason);
  });
  window.addEventListener('error', (event) => {
    reportError('unhandled', event.message);
  });
}
