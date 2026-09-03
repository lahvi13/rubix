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
  /** Closes and opens the connection again. */
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

/**
 * A write nobody awaits, watched. Three things go wrong invisibly here: the
 * promise rejects with no handler, it never settles at all, or the whole
 * database stops answering — and any of them looks exactly like a switch that
 * ignores taps.
 *
 * A slow write on its own says nothing, so the alarm is only raised once a
 * plain read has failed to answer too. Then the connection is put back
 * together, because a database that stopped answering never starts again on
 * its own.
 */
export function watchWrite(work: Promise<unknown>, context: string): void {
  let isSettled = false;
  const timer = setTimeout(() => void checkOn(), WRITE_TIMEOUT_MS);

  async function checkOn(): Promise<void> {
    if (isSettled) return;
    if (watchdog === null) {
      reportError(context, new Error(strings.errors.notResponding));
      return;
    }

    if (await settlesWithin(watchdog.probe(), PROBE_TIMEOUT_MS)) return;
    if (isSettled) return;

    reportError(context, new Error(strings.errors.notResponding));
    if (isRecovering) return;
    isRecovering = true;
    try {
      await watchdog.recover();
    } finally {
      isRecovering = false;
    }
  }

  void work
    .catch((cause: unknown) => reportError(context, cause))
    .finally(() => {
      isSettled = true;
      clearTimeout(timer);
    });
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
