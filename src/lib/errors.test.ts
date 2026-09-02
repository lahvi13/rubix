import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearError, lastError, onError, reportError } from './errors';

afterEach(() => clearError());

describe('error channel', () => {
  it('notifies listeners and remembers the last failure', () => {
    const listener = vi.fn();
    const unsubscribe = onError(listener);

    reportError('save solve', new Error('QuotaExceededError'));

    expect(listener).toHaveBeenCalledTimes(1);
    expect(lastError()).toMatchObject({
      context: 'save solve',
      message: 'QuotaExceededError',
    });
    unsubscribe();
  });

  it('reads non-Error rejections too, which is what IndexedDB tends to throw', () => {
    reportError('database', 'AbortError');
    expect(lastError()?.message).toBe('AbortError');
  });

  it('stops notifying after unsubscribe', () => {
    const listener = vi.fn();
    onError(listener)();

    reportError('database', new Error('nope'));

    expect(listener).not.toHaveBeenCalled();
  });
});
