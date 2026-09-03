import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../../../db/schema';
import { setSetting } from '../../../db/repositories/settings-repository';
import { seedPacks } from '../../../db/seed/seed';
import { DrillScreen } from './DrillScreen';

// The real client spins up a module worker, which jsdom cannot run.
vi.mock('../../../lib/scramble-client', () => ({
  requestScramble: () => Promise.resolve("R U R' U' F2"),
}));
vi.mock('cubing/twisty', () => ({}));

/** Hold past the threshold, release to start, press again to stop. */
async function attempt(user: ReturnType<typeof userEvent.setup>, solveMs: number): Promise<void> {
  let clock = 0;
  vi.spyOn(performance, 'now').mockImplementation(() => clock);

  await user.keyboard('[Space>]');
  clock += 400;
  await user.keyboard('[/Space]');
  clock += solveMs;
  await user.keyboard('[Space>]');
  await user.keyboard('[/Space]');
}

describe('DrillScreen', () => {
  beforeEach(async () => {
    await Promise.all(db.tables.map((table) => table.clear()));
    await seedPacks();
    await setSetting('trainer.drillSetId', 'pll');
    // One case in the pool, so what comes up is not a matter of luck.
    await setSetting('trainer.drillCaseIds', ['pll-t']);
  });

  it('shows the scramble but keeps the case to itself until the attempt is over', async () => {
    const user = userEvent.setup();
    render(<DrillScreen />);

    // The T perm undone. Its R2 F' survives every rotation and AUF the drill
    // can put in front of it, which is what makes it safe to look for.
    expect(await screen.findByText(/R2 F'/)).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'T' })).not.toBeInTheDocument();

    await attempt(user, 3210);

    expect(await screen.findByRole('heading', { name: 'T' })).toBeInTheDocument();
    const solve = await db.solves.toCollection().first();
    expect(solve?.mode).toBe('drill');
    expect(solve?.caseId).toBe('pll-t');
    expect(solve?.rawMs).toBe(3210);
    expect(solve?.penalty).toBe('none');
  });

  it('never inspects, whatever the timer screen is set to', async () => {
    const user = userEvent.setup();
    await setSetting('timer.inspectionEnabled', true);
    render(<DrillScreen />);
    await screen.findByText(/R2 F'/);

    await attempt(user, 5000);

    // With inspection, that first tap would have started a countdown instead
    // of the solve, and the stored attempt would carry an inspection time.
    const solve = await db.solves.toCollection().first();
    expect(solve?.rawMs).toBe(5000);
    expect(solve?.inspectionMs).toBeNull();
  });

  it('counts an attempt you looked up as a DNF', async () => {
    const user = userEvent.setup();
    render(<DrillScreen />);
    await screen.findByText(/R2 F'/);

    await user.click(screen.getByRole('button', { name: 'Show me' }));
    expect(await screen.findByRole('heading', { name: 'T' })).toBeInTheDocument();

    await attempt(user, 9000);

    await waitFor(async () => {
      expect(await db.solves.count()).toBe(1);
    });
    const solve = await db.solves.toCollection().first();
    expect(solve?.penalty).toBe('dnf');
    expect(solve?.rawMs).toBe(9000);
  });

  it('counts the case towards its own statistics, not the timer session', async () => {
    const user = userEvent.setup();
    render(<DrillScreen />);
    await screen.findByText(/R2 F'/);

    await attempt(user, 2000);

    // The answer carries what this case has cost so far.
    expect(await screen.findByText('Attempts')).toBeInTheDocument();
    // The clock still shows the same number, so read the case's own record of
    // it rather than the first 2.00 on the screen.
    const recorded = screen.getAllByRole('definition').map((node) => node.textContent);
    expect(recorded).toContain('2.00');
    const session = await db.sessions.toCollection().first();
    expect(session?.mode).toBe('drill');
  });

  it('drills the cross from a real scramble, with no case to reveal', async () => {
    const user = userEvent.setup();
    await setSetting('trainer.drillSetId', 'cross');
    // The cross inspects unless the switch says otherwise; this test is about
    // the scramble, so it takes the short way to the clock.
    await setSetting('timer.inspectionEnabled', false);
    render(<DrillScreen />);

    expect(await screen.findByText("R U R' U' F2")).toBeInTheDocument();
    // Nothing to pick from and nothing to look up.
    expect(screen.queryByRole('button', { name: /^Cases/ })).not.toBeInTheDocument();

    await attempt(user, 4000);

    const solve = await db.solves.toCollection().first();
    expect(solve?.caseId).toBe('cross');
    expect(solve?.scramble).toBe("R U R' U' F2");
  });

  it('inspects the cross, because planning it is the point', async () => {
    const user = userEvent.setup();
    await setSetting('trainer.drillSetId', 'cross');
    await setSetting('timer.inspectionEnabled', true);
    let clock = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => clock);
    render(<DrillScreen />);
    await screen.findByText("R U R' U' F2");

    // A tap starts the countdown rather than the solve.
    await user.keyboard('[Space>]');
    clock += 50;
    await user.keyboard('[/Space]');
    expect(await screen.findByText('15')).toBeInTheDocument();

    clock += 7000;
    await user.keyboard('[Space>]');
    clock += 400;
    await user.keyboard('[/Space]');
    clock += 12_000;
    await user.keyboard('[Space>]');
    await user.keyboard('[/Space]');

    await waitFor(async () => {
      expect(await db.solves.count()).toBe(1);
    });
    const solve = await db.solves.toCollection().first();
    expect(solve?.rawMs).toBe(12_000);
    expect(solve?.inspectionMs).toBe(7400);
  });

  it('says how much of the set is being drilled', async () => {
    render(<DrillScreen />);

    expect(await screen.findByRole('button', { name: 'Cases 1 / 21' })).toBeInTheDocument();
  });
});
