import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { unpinScramble, usePinnedScramble } from '../hooks/use-pinned-scramble';
import { useSharedScrambleLink } from './use-shared-scramble-link';

function openApp() {
  return renderHook(() => {
    useSharedScrambleLink();
    return usePinnedScramble();
  });
}

describe('useSharedScrambleLink', () => {
  afterEach(() => {
    unpinScramble();
    window.history.replaceState(null, '', '#/');
  });

  it('puts the scramble from the link on the timer, with its time to beat', () => {
    window.history.replaceState(null, '', "#/timer?scramble=R_U-_F2&beat=14370");
    const { result } = openApp();

    expect(result.current).toEqual({ scramble: "R U' F2", source: 'shared', targetMs: 14370 });
  });

  it('takes the link out of the address, so a reload does not bring it back', () => {
    window.history.replaceState(null, '', '#/timer?scramble=R');
    openApp();

    expect(window.location.hash).toBe('#/timer');
  });

  it('leaves an address without a scramble alone', () => {
    window.history.replaceState(null, '', '#/stats');
    const { result } = openApp();

    expect(result.current).toBeNull();
    expect(window.location.hash).toBe('#/stats');
  });
});
