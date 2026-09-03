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
 * How long a write may take before the app says so. Generous: a slow phone
 * mid-seed is normal, a write that never lands is not.
 */
const WRITE_TIMEOUT_MS = 6000;

/**
 * A write nobody awaits, watched. Two things go wrong invisibly here: the
 * promise rejects with no handler, or it never settles at all — and a database
 * that stopped answering looks exactly like a switch that ignores taps.
 */
export function watchWrite(work: Promise<unknown>, context: string): void {
  let isSettled = false;
  const timer = setTimeout(() => {
    if (!isSettled) reportError(context, new Error(strings.errors.notResponding));
  }, WRITE_TIMEOUT_MS);

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
