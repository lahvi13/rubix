/**
 * Minimal in-app error channel. Nothing leaves the device — this is not
 * telemetry, it is the only way a failure can become visible in an offline
 * app with no console open.
 */

export interface AppError {
  context: string;
  message: string;
  at: number;
}

type Listener = (error: AppError) => void;

const listeners = new Set<Listener>();
let last: AppError | null = null;

export function reportError(context: string, cause: unknown): void {
  const message = cause instanceof Error ? cause.message : String(cause);
  last = { context, message, at: Date.now() };
  for (const listener of listeners) listener(last);
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

/** Catches the failures nobody remembered to await. */
export function installGlobalErrorHandlers(): void {
  window.addEventListener('unhandledrejection', (event) => {
    reportError('unhandled', event.reason);
  });
  window.addEventListener('error', (event) => {
    reportError('unhandled', event.message);
  });
}
