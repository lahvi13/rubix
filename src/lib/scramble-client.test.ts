import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { requestScramble, resetScrambleClient } from './scramble-client';

const MAIN_THREAD_SCRAMBLE = "R U R' U' F2 D2";

let mainThreadImpl: () => Promise<{ toString(): string }>;

vi.mock('cubing/scramble', () => ({
  randomScrambleForEvent: () => mainThreadImpl(),
}));

/** A worker that loads but never answers, which is the failure we hit in production. */
class SilentWorker {
  addEventListener(): void {}
  postMessage(): void {}
  terminate(): void {}
}

describe('scramble client', () => {
  beforeEach(() => {
    resetScrambleClient();
    mainThreadImpl = () => Promise.resolve({ toString: () => MAIN_THREAD_SCRAMBLE });
  });
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

  it('fails visibly when even the main thread fallback hangs', async () => {
    vi.stubGlobal('Worker', SilentWorker);
    mainThreadImpl = () => new Promise(() => {});
    vi.useFakeTimers();

    const scramble = requestScramble('333');
    // Something must consume the rejection before the timers fire, otherwise
    // the test run dies on an unhandled rejection instead of the assertion.
    const outcome = expect(scramble).rejects.toThrow(/did not finish/);
    await vi.advanceTimersByTimeAsync(8000 + 20_000);

    await outcome;
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
