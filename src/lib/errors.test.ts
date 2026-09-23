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
  const alive = () => Promise.resolve(null);
  const dead = () => new Promise<never>(() => {});

  it('repeats a write the lost connection swallowed, and says nothing', async () => {
    const run = vi
      .fn()
      .mockRejectedValueOnce(new Error('DatabaseClosedError'))
      .mockResolvedValueOnce(undefined);
    const reopen = vi.fn(() => Promise.resolve());
    installWriteWatchdog({ probe: alive, survey: () => Promise.resolve('survey'), reopen, recover: () => Promise.resolve() });

    watchWrite(run, 'cube skin');
    await vi.waitFor(() => expect(run).toHaveBeenCalledTimes(2));

    expect(reopen).toHaveBeenCalledTimes(1);
    expect(lastError()).toBeNull();
    // The swallowed attempt is still on the record for anyone looking.
    expect(recentErrors()[0]?.message).toContain('DatabaseClosedError');
  });

  it('reports when the second attempt fails too — then the tap really was lost', async () => {
    const run = vi.fn(() => Promise.reject(new Error('QuotaExceededError')));
    installWriteWatchdog({
      probe: alive,
    survey: () => Promise.resolve("survey"),
      reopen: () => Promise.resolve(),
      recover: () => Promise.resolve(),
    });

    watchWrite(run, 'cube skin');
    await vi.waitFor(() => expect(lastError()?.context).toBe('cube skin'));

    expect(run).toHaveBeenCalledTimes(2);
    expect(lastError()?.message).toBe('QuotaExceededError');
  });

  it('offers a refused write back, and giving it back writes it again', async () => {
    const run = vi
      .fn()
      .mockRejectedValueOnce(new Error('QuotaExceededError'))
      .mockRejectedValueOnce(new Error('QuotaExceededError'))
      .mockResolvedValueOnce(undefined);
    installWriteWatchdog({
      probe: alive,
      survey: () => Promise.resolve('survey'),
      reopen: () => Promise.resolve(),
      recover: () => Promise.resolve(),
    });

    watchWrite(run, 'solve');
    await vi.waitFor(() => expect(lastError()?.retry).toBeTypeOf('function'));
    // What the log keeps is a record, not something to call.
    expect(recentErrors()[0]).not.toHaveProperty('retry');

    lastError()?.retry?.();
    await vi.waitFor(() => expect(run).toHaveBeenCalledTimes(3));
  });

  it('says nothing when the write is only slow — the database still answers', async () => {
    installWriteWatchdog({
      probe: alive,
    survey: () => Promise.resolve("survey"),
      reopen: () => Promise.resolve(),
      recover: () => Promise.resolve(),
    });
    vi.useFakeTimers();
    try {
      watchWrite(dead, 'cube skin');
      await vi.advanceTimersByTimeAsync(20000);
    } finally {
      vi.useRealTimers();
    }

    expect(lastError()).toBeNull();
  });

  it('puts the connection back and writes again when nothing answers', async () => {
    const recover = vi.fn(() => Promise.resolve());
    const run = vi.fn().mockImplementationOnce(dead).mockResolvedValueOnce(undefined);
    installWriteWatchdog({ probe: dead, survey: () => Promise.resolve('survey'), reopen: () => Promise.resolve(), recover });

    vi.useFakeTimers();
    try {
      watchWrite(run, 'cube skin');
      await vi.advanceTimersByTimeAsync(20000);
    } finally {
      vi.useRealTimers();
    }

    expect(recover).toHaveBeenCalledTimes(1);
    expect(run).toHaveBeenCalledTimes(2);
    // Quietly: the write did land in the end, with the survey of what was
    // stuck written down next to it.
    expect(lastError()).toBeNull();
    expect(recentErrors().map((error) => error.message)).toEqual([
      'survey',
      expect.stringMatching(/did not answer/) as unknown as string,
    ]);
  });

  it('keeps a handled failure in the log without raising the banner', () => {
    logQuietly('database', new Error('the connection was closed'));

    expect(lastError()).toBeNull();
    expect(recentErrors()[0]?.message).toBe('the connection was closed');
  });

  it('drops the routine closes an earlier version filled the log with', () => {
    logQuietly('Database unavailable', new Error('the connection was closed — reconnecting'));
    logQuietly('Save solve', new Error('QuotaExceededError'));

    expect(recentErrors().map((error) => error.message)).toEqual(['QuotaExceededError']);
  });
});
