import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { db } from '../db/schema';
import { getSetting } from '../db/repositories/settings-repository';
import { unpinScramble, usePinnedScramble } from '../hooks/use-pinned-scramble';
import { useSharedScrambleLink } from './use-shared-scramble-link';

function openApp() {
  return renderHook(() => {
    useSharedScrambleLink();
    return usePinnedScramble();
  });
}

describe('useSharedScrambleLink', () => {
  afterEach(async () => {
    unpinScramble();
    window.history.replaceState(null, '', '#/');
    await db.settings.clear();
  });

  it('puts the scramble from the link on the timer, with its time to beat', () => {
    window.history.replaceState(null, '', "#/timer?scramble=R_U-_F2&beat=14370");
    const { result } = openApp();

    expect(result.current).toEqual({
      scramble: "R U' F2",
      source: 'shared',
      run: { scrambles: ["R U' F2"], targetMs: 14370, resultsMs: [] },
    });
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

  it('switches the app to the cube the scramble is for', async () => {
    window.history.replaceState(null, '', '#/timer?puzzle=222&scramble=R_U-_F2');
    const { result } = openApp();

    expect(result.current?.scramble).toBe("R U' F2");
    await waitFor(async () => expect(await getSetting('ui.puzzle')).toBe('222'));
  });

  it('switches back to the 3×3 for a link that names no cube', async () => {
    await db.settings.put({ key: 'ui.puzzle', value: '222', deviceLocal: 1, updatedAt: 1 });
    window.history.replaceState(null, '', '#/timer?scramble=R');
    openApp();

    await waitFor(async () => expect(await getSetting('ui.puzzle')).toBe('333'));
  });
});
