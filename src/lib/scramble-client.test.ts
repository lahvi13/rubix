import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { requestCaseScramble, requestScramble, resetScrambleClient } from './scramble-client';

const SCRAMBLE = "R U R' U' F2 D2";

let generatorImpl: () => Promise<{ toString(): string }>;

vi.mock('cubing/scramble', () => ({
  randomScrambleForEvent: () => generatorImpl(),
}));

vi.mock('cubing/search', () => ({
  setSearchDebug: () => {},
  // The fake pattern is the alg it was built from, and its "solution" says so.
  experimentalSolve3x3x3IgnoringCenters: (pattern: { alg: string; puzzle: string }) =>
    Promise.resolve({
      invert: () => ({ toString: () => `inverse of solving ${pattern.alg} on the ${pattern.puzzle}` }),
    }),
  experimentalSolve2x2x2: (pattern: { alg: string; puzzle: string }) =>
    Promise.resolve({
      invert: () => ({ toString: () => `inverse of solving ${pattern.alg} on the 2×2 solver's ${pattern.puzzle}` }),
    }),
}));

const kpuzzleOf = (puzzle: string) => () =>
  Promise.resolve({ defaultPattern: () => ({ applyAlg: (alg: string) => ({ alg, puzzle }) }) });

vi.mock('cubing/puzzles', () => ({
  cube3x3x3: { kpuzzle: kpuzzleOf('3×3') },
  cube2x2x2: { kpuzzle: kpuzzleOf('2×2') },
}));

describe('scramble client', () => {
  beforeEach(() => {
    resetScrambleClient();
    generatorImpl = () => Promise.resolve({ toString: () => SCRAMBLE });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('resolves a scramble', async () => {
    await expect(requestScramble('333')).resolves.toBe(SCRAMBLE);
  });

  it('runs requests one at a time — a prefetch never stacks a second solver run', async () => {
    let running = 0;
    let peak = 0;
    generatorImpl = async () => {
      running += 1;
      peak = Math.max(peak, running);
      await new Promise((resolve) => setTimeout(resolve, 0));
      running -= 1;
      return { toString: () => SCRAMBLE };
    };

    await Promise.all([requestScramble('333'), requestScramble('333')]);
    expect(peak).toBe(1);
  });

  it('fails visibly instead of hanging when generation never finishes', async () => {
    generatorImpl = () => new Promise(() => {});
    vi.useFakeTimers();

    const scramble = requestScramble('333');
    // Something must consume the rejection before the timers fire, otherwise
    // the test run dies on an unhandled rejection instead of the assertion.
    const outcome = expect(scramble).rejects.toThrow(/did not finish/);
    await vi.advanceTimersByTimeAsync(20_000);

    await outcome;
  });

  it('scrambles to a case by inverting the solution to the state it leaves', async () => {
    await expect(requestCaseScramble("R U R' U'")).resolves.toBe(
      "inverse of solving R U R' U' on the 3×3",
    );
  });

  it("scrambles a 2×2 case with the 2×2's own solver, on a 2×2", async () => {
    await expect(requestCaseScramble("R U R' U'", '222')).resolves.toBe(
      "inverse of solving R U R' U' on the 2×2 solver's 2×2",
    );
  });

  it('recovers after a failed attempt', async () => {
    generatorImpl = () => Promise.reject(new Error('worker exploded'));
    await expect(requestScramble('333')).rejects.toThrow('worker exploded');

    generatorImpl = () => Promise.resolve({ toString: () => SCRAMBLE });
    await expect(requestScramble('333')).resolves.toBe(SCRAMBLE);
  });
});
