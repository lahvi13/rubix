import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearError,
  forgetErrors,
  installWriteWatchdog,
  logQuietly,
  lastError,
  onError,
  recentErrors,
  reportError,
  watchWrite,
} from './errors';

beforeEach(() => forgetErrors());
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

describe('the log that outlives the page', () => {
  it('keeps failures where a restart cannot lose them', () => {
    reportError('cube skin', new Error('DatabaseClosedError'));
    reportError('database', new Error('VersionError'));

    // What a fresh page load would read back.
    expect(recentErrors().map((error) => error.message)).toEqual([
      'VersionError',
      'DatabaseClosedError',
    ]);
  });

  it('keeps the error name when it says more than the message', () => {
    const closed = new Error('Database has been closed');
    closed.name = 'DatabaseClosedError';

    reportError('database', closed);

    expect(lastError()?.message).toBe('DatabaseClosedError: Database has been closed');
  });

  it('holds the last few, not the whole history', () => {
    for (let i = 0; i < 12; i++) reportError('database', new Error(`failure ${i}`));

    expect(recentErrors()).toHaveLength(8);
    expect(recentErrors()[0]?.message).toBe('failure 11');
  });
});

describe('watched writes', () => {
  it('reports a write that rejects with nobody awaiting it', async () => {
    watchWrite(Promise.reject(new Error('QuotaExceededError')), 'cube skin');
    await vi.waitFor(() => expect(lastError()?.context).toBe('cube skin'));

    expect(lastError()?.message).toBe('QuotaExceededError');
  });

  it('reports a write that never settles — the silent freeze', async () => {
    vi.useFakeTimers();
    try {
      watchWrite(new Promise(() => {}), 'cube skin');
      await vi.advanceTimersByTimeAsync(9000);
    } finally {
      vi.useRealTimers();
    }

    expect(lastError()?.context).toBe('cube skin');
    expect(lastError()?.message).toMatch(/did not answer/);
  });

  it('stays quiet when the write lands', async () => {
    vi.useFakeTimers();
    try {
      watchWrite(Promise.resolve(), 'cube skin');
      await vi.advanceTimersByTimeAsync(10000);
    } finally {
      vi.useRealTimers();
    }

    expect(lastError()).toBeNull();
  });
});

describe('recovering rather than shouting', () => {
  it('says nothing when the write was only slow — the database still answers', async () => {
    installWriteWatchdog({ probe: () => Promise.resolve(null), recover: () => Promise.resolve() });
    vi.useFakeTimers();
    try {
      watchWrite(new Promise(() => {}), 'cube skin');
      await vi.advanceTimersByTimeAsync(20000);
    } finally {
      vi.useRealTimers();
    }

    expect(lastError()).toBeNull();
  });

  it('reports and reconnects when the database stops answering too', async () => {
    const recover = vi.fn(() => Promise.resolve());
    installWriteWatchdog({ probe: () => new Promise(() => {}), recover });
    vi.useFakeTimers();
    try {
      watchWrite(new Promise(() => {}), 'cube skin');
      await vi.advanceTimersByTimeAsync(20000);
    } finally {
      vi.useRealTimers();
    }

    expect(lastError()?.context).toBe('cube skin');
    expect(recover).toHaveBeenCalledTimes(1);
  });

  it('keeps a handled failure in the log without raising the banner', () => {
    logQuietly('database', new Error('the connection was closed'));

    expect(lastError()).toBeNull();
    expect(recentErrors()[0]?.message).toBe('the connection was closed');
  });
});
