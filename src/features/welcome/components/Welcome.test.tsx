import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../../db/schema';
import { getSetting, setSetting } from '../../../db/repositories/settings-repository';
import { getOrCreateActiveSession } from '../../../db/repositories/session-repository';
import { addSolve } from '../../../db/repositories/solve-repository';
import { seedPacks } from '../../../db/seed/seed';
import { Welcome } from './Welcome';

async function addOneSolve(): Promise<void> {
  const session = await getOrCreateActiveSession('333', 'freestyle');
  await addSolve({
    sessionId: session.id,
    puzzle: '333',
    mode: 'freestyle',
    scramble: "R U R' U'",
    rawMs: 12_340,
    penalty: 'none',
    penaltySource: 'auto',
    inspectionMs: null,
    startedAt: Date.now(),
  });
}

describe('Welcome', () => {
  beforeEach(async () => {
    await Promise.all(db.tables.map((table) => table.clear()));
    await seedPacks();
    window.location.hash = '#/timer';
  });

  it('sets a Roux beginner up with the Roux guide and lands in it', async () => {
    const user = userEvent.setup();
    render(<Welcome />);

    await user.click(await screen.findByRole('button', { name: /Not yet/ }));
    await user.click(screen.getByRole('button', { name: /Roux/ }));

    await waitFor(async () => {
      expect(await getSetting('ui.welcome')).toBe('asked');
    });
    expect(await getSetting('ui.showLearn')).toBe(true);
    expect(await getSetting('ui.learnMethod')).toBe('roux');
    expect((await getOrCreateActiveSession('333', 'freestyle')).methodId).toBe('roux');
    expect(window.location.hash).toBe('#/learn');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('sets a CFOP solver up in the trainer, with the guide off the bar', async () => {
    const user = userEvent.setup();
    render(<Welcome />);

    await user.click(await screen.findByRole('button', { name: /^Yes/ }));
    // Only a solver may not know what their method is called.
    expect(screen.getByRole('button', { name: /Not sure/ })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /^CFOP/ }));

    await waitFor(async () => {
      expect(await getSetting('ui.welcome')).toBe('asked');
    });
    expect(await getSetting('ui.showLearn')).toBe(false);
    expect(await getSetting('trainer.setId')).toBe('oll');
    expect(await getSetting('trainer.twoLookDefault')).toBe(true);
    expect(window.location.hash).toBe('#/trainer');
  });

  it('goes back from the second question to the first', async () => {
    const user = userEvent.setup();
    render(<Welcome />);

    await user.click(await screen.findByRole('button', { name: /Not yet/ }));
    expect(screen.queryByRole('button', { name: /Not sure/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByText('Can you solve the cube?')).toBeInTheDocument();
  });

  it('is skipped for good, and nothing else changes', async () => {
    const user = userEvent.setup();
    render(<Welcome />);

    await user.click(await screen.findByRole('button', { name: 'Skip' }));
    await waitFor(async () => {
      expect(await getSetting('ui.welcome')).toBe('asked');
    });
    expect(await getSetting('ui.showLearn')).toBe(true);
    expect(window.location.hash).toBe('#/timer');
  });

  it('is not asked on a device that already has solves', async () => {
    await addOneSolve();
    render(<Welcome />);
    // Long enough for the count to answer, which is what it waits for.
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('is asked again when Settings says so, solves or not', async () => {
    await addOneSolve();
    await setSetting('ui.welcome', 'again');
    render(<Welcome />);
    expect(await screen.findByRole('dialog', { name: 'Welcome to Rubix' })).toBeInTheDocument();
  });
});
