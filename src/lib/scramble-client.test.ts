import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { requestScramble, resetScrambleClient } from './scramble-client';

const MAIN_THREAD_SCRAMBLE = "R U R' U' F2 D2";

vi.mock('cubing/scramble', () => ({
  randomScrambleForEvent: () => Promise.resolve({ toString: () => MAIN_THREAD_SCRAMBLE }),
}));

/** A worker that loads but never answers, which is the failure we hit in production. */
class SilentWorker {
  addEventListener(): void {}
  postMessage(): void {}
  terminate(): void {}
}

describe('scramble client', () => {
  beforeEach(() => resetScrambleClient());
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('falls back to the main thread when the worker cannot be constructed', async () => {
    vi.stubGlobal(
      'Worker',
      class {
        constructor() {
          throw new Error('module workers unsupported');
        }
      },
    );

    await expect(requestScramble('333')).resolves.toBe(MAIN_THREAD_SCRAMBLE);
  });

  it('falls back when the worker never answers, instead of hanging forever', async () => {
    vi.stubGlobal('Worker', SilentWorker);
    vi.useFakeTimers();

    const scramble = requestScramble('333');
    await vi.advanceTimersByTimeAsync(8000);

    await expect(scramble).resolves.toBe(MAIN_THREAD_SCRAMBLE);
  });

  it('stops using the worker once it has failed', async () => {
    const construct = vi.fn(() => {
      throw new Error('nope');
    });
    vi.stubGlobal('Worker', construct);

    await requestScramble('333');
    await requestScramble('333');

    // Constructed once for the first attempt, never again.
    expect(construct).toHaveBeenCalledTimes(1);
  });
});
