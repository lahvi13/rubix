import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../../db/schema';
import { getSetting, setSetting } from '../../../db/repositories/settings-repository';
import { seedPacks } from '../../../db/seed/seed';
import { useDrillSet } from './use-drill-set';

describe('useDrillSet', () => {
  beforeEach(async () => {
    await Promise.all(db.tables.map((table) => table.clear()));
    await seedPacks();
  });

  it("offers the cube's own sets and keeps the one chosen", async () => {
    await setSetting('trainer.drillSetId', 'oll');
    const { result } = renderHook(() => useDrillSet());

    await waitFor(() => expect(result.current.sets).toBeDefined());
    expect(result.current.setId).toBe('oll');
    expect(result.current.sets?.every((set) => set.puzzle === '333')).toBe(true);
  });

  it("drills the 2×2's first set when the one chosen is the 3×3's, and forgets nothing", async () => {
    await setSetting('trainer.drillSetId', 'pll');
    await setSetting('ui.puzzle', '222');
    const { result } = renderHook(() => useDrillSet());

    await waitFor(() => expect(result.current.setId).toBe('pocket-oll'));
    expect(result.current.sets?.map((set) => set.id)).toEqual(['pocket-oll', 'pocket-pbl']);
    expect(await getSetting('trainer.drillSetId')).toBe('pll');
  });

  it("goes back to the 3×3's own default from a 2×2 set", async () => {
    await setSetting('trainer.drillSetId', 'pocket-pbl');
    const { result } = renderHook(() => useDrillSet());

    await waitFor(() => expect(result.current.sets).toBeDefined());
    expect(result.current.setId).toBe('pll');
  });
});
