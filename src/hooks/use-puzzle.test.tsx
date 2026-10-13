import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { db } from '../db/schema';
import { getSetting, setSetting } from '../db/repositories/settings-repository';
import { pinScramble, unpinScramble, usePinnedScramble } from './use-pinned-scramble';
import { switchPuzzle, usePuzzle } from './use-puzzle';

describe('usePuzzle', () => {
  beforeEach(async () => {
    await Promise.all(db.tables.map((table) => table.clear()));
  });

  afterEach(() => {
    unpinScramble();
  });

  it('is on the 3×3 until told otherwise', () => {
    const { result } = renderHook(() => usePuzzle());

    expect(result.current[0]).toBe('333');
  });

  it('reads a cube this version does not know as the 3×3', async () => {
    await setSetting('ui.puzzle', '777');
    const { result } = renderHook(() => usePuzzle());

    // Stays there once the setting is in, rather than only before it.
    await waitFor(async () => expect(await getSetting('ui.puzzle')).toBe('777'));
    expect(result.current[0]).toBe('333');
  });

  it('switches, and takes a scramble chosen for the other cube off the timer', async () => {
    const { result } = renderHook(() => ({ puzzle: usePuzzle(), pinned: usePinnedScramble() }));
    act(() => pinScramble("R U R' U'", 'own'));
    expect(result.current.pinned).not.toBeNull();

    act(() => result.current.puzzle[1]('222'));

    await waitFor(() => expect(result.current.puzzle[0]).toBe('222'));
    expect(result.current.pinned).toBeNull();
  });

  it('leaves the scramble alone when the cube picked is the one already on', () => {
    const { result } = renderHook(() => ({ puzzle: usePuzzle(), pinned: usePinnedScramble() }));
    act(() => pinScramble("R U R' U'", 'own'));

    act(() => result.current.puzzle[1]('333'));

    expect(result.current.pinned).not.toBeNull();
  });

  it('can be switched from outside a component', async () => {
    const { result } = renderHook(() => usePuzzle());

    act(() => switchPuzzle('222'));

    await waitFor(() => expect(result.current[0]).toBe('222'));
  });

  it('keeps the choice on this device, out of a backup', async () => {
    const { result } = renderHook(() => usePuzzle());
    act(() => result.current[1]('222'));

    await waitFor(async () => {
      expect(await db.settings.get('ui.puzzle')).toMatchObject({ value: '222', deviceLocal: 1 });
    });
  });
});
