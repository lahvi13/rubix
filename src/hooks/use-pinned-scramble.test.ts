import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import {
  advancePin,
  pinScramble,
  pinSharedScrambles,
  unpinScramble,
  usePinnedScramble,
} from './use-pinned-scramble';

const FIVE = ['R', 'U', 'F', 'L', 'D'];

describe('usePinnedScramble', () => {
  afterEach(() => unpinScramble());

  it('gives the timer back after one solve of a chosen scramble', () => {
    const { result } = renderHook(() => usePinnedScramble());
    act(() => pinScramble("R U'", 'own'));
    act(() => advancePin(12_000));

    expect(result.current).toBeNull();
  });

  it('works through a shared set in order, keeping each result', () => {
    const { result } = renderHook(() => usePinnedScramble());
    act(() => pinSharedScrambles({ scrambles: FIVE, targetMs: 12_000 }));
    act(() => advancePin(11_000));
    act(() => advancePin(null));

    expect(result.current).toEqual({
      scramble: 'F',
      source: 'shared',
      run: { scrambles: FIVE, targetMs: 12_000, resultsMs: [11_000, null] },
    });
  });

  it('gives the timer back after the last of a shared set', () => {
    const { result } = renderHook(() => usePinnedScramble());
    act(() => pinSharedScrambles({ scrambles: FIVE, targetMs: 12_000 }));
    for (const resultMs of [1, 2, 3, 4, 5]) act(() => advancePin(resultMs));

    expect(result.current).toBeNull();
  });
});
