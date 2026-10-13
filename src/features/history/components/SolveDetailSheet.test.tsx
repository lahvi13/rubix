import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../../../db/schema';
import {
  createSession,
  getOrCreateActiveSession,
} from '../../../db/repositories/session-repository';
import { addSolve } from '../../../db/repositories/solve-repository';
import { seedPacks } from '../../../db/seed/seed';
import { SolveDetailSheet } from './SolveDetailSheet';

async function seedPhased(
  sessionId: string,
  rawMs: number,
  phaseKeys: readonly string[],
  ends: readonly number[],
) {
  return addSolve({
    sessionId,
    puzzle: '333',
    mode: 'freestyle',
    scramble: "R U R' U'",
    rawMs,
    penalty: 'none',
    penaltySource: 'auto',
    inspectionMs: null,
    startedAt: Date.now(),
    splits: ends.map((atMs, index) => ({
      phase: phaseKeys[index] ?? '',
      atMs,
      source: 'manual' as const,
    })),
    phaseKeys,
  });
}

describe('SolveDetailSheet', () => {
  beforeEach(async () => {
    await Promise.all(db.tables.map((table) => table.clear()));
    await seedPacks();
  });

  it('shows a solve by the phases of the method it was timed in, not the one being timed in now', async () => {
    const morning = await getOrCreateActiveSession('333', 'freestyle');
    const solve = await seedPhased(morning.id, 9000, ['cross', 'f2l', 'oll', 'pll'], [1000, 5000, 7000]);
    // The session in use is a Roux one by the time the solve is opened.
    await createSession('Blocks', '333', 'freestyle', 'roux');

    render(<SolveDetailSheet solveId={solve.id} solveIds={[]} onOpen={vi.fn()} onClose={vi.fn()} />);

    const sheet = await screen.findByRole('dialog');
    await waitFor(() => {
      expect(sheet.textContent).toContain('Cross');
    });
    expect(sheet.textContent).toContain('PLL');
    expect(sheet.textContent).not.toContain('CMLL');
  });

  describe('the line under the time', () => {
    const meta = (sheet: HTMLElement) => sheet.querySelector('.detail__meta')?.textContent ?? '';

    it('names the session and leaves the method unsaid while there is only one', async () => {
      const morning = await getOrCreateActiveSession('333', 'freestyle');
      const solve = await seedPhased(morning.id, 9000, ['cross', 'f2l', 'oll', 'pll'], [1000, 5000, 7000]);

      render(<SolveDetailSheet solveId={solve.id} solveIds={[]} onOpen={vi.fn()} onClose={vi.fn()} />);

      const sheet = await screen.findByRole('dialog');
      await waitFor(() => expect(meta(sheet)).toContain(`${morning.name} · `));
      expect(meta(sheet)).not.toContain('CFOP');
    });

    it("names the method of the solve's own session once sessions are timed in more than one", async () => {
      const morning = await getOrCreateActiveSession('333', 'freestyle');
      const solve = await seedPhased(morning.id, 9000, ['cross', 'f2l', 'oll', 'pll'], [1000, 5000, 7000]);
      // The session in use is a Roux one; the solve opened is not of it.
      await createSession('Blocks', '333', 'freestyle', 'roux');

      render(<SolveDetailSheet solveId={solve.id} solveIds={[]} onOpen={vi.fn()} onClose={vi.fn()} />);

      const sheet = await screen.findByRole('dialog');
      await waitFor(() => expect(meta(sheet)).toContain(`${morning.name} · CFOP · `));
    });
  });

  it('marks the best of a method, however fast another method has been', async () => {
    const morning = await getOrCreateActiveSession('333', 'freestyle');
    await seedPhased(morning.id, 9000, [], []);
    const blocks = await createSession('Blocks', '333', 'freestyle', 'roux');
    const firstRoux = await seedPhased(blocks.id, 58_000, [], []);

    render(
      <SolveDetailSheet solveId={firstRoux.id} solveIds={[]} onOpen={vi.fn()} onClose={vi.fn()} />,
    );

    const sheet = await screen.findByRole('dialog');
    await waitFor(() => {
      expect(sheet.querySelector('.detail__result.is-record')).not.toBeNull();
    });
  });
});
