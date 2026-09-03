import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../../../db/schema';
import { TimerScreen } from './TimerScreen';

// The real client spins up a module worker, which jsdom cannot run, and
// cubing/twisty is a custom element that needs a real browser.
vi.mock('../../../lib/scramble-client', () => ({
  requestScramble: () => Promise.resolve("R U R' U' F2"),
}));
vi.mock('cubing/twisty', () => ({}));

/** The phase toggle needs a method to take its phases from. */
async function seedCfop(): Promise<void> {
  await db.methods.put({
    id: 'cfop',
    name: 'CFOP',
    puzzle: '333',
    phases: [
      { key: 'cross', label: 'Cross', order: 0 },
      { key: 'f2l', label: 'F2L', order: 1 },
      { key: 'oll', label: 'OLL', order: 2 },
      { key: 'pll', label: 'PLL', order: 3 },
    ],
    createdAt: 0,
    updatedAt: 0,
  });
}

describe('TimerScreen', () => {
  beforeEach(async () => {
    await Promise.all(db.tables.map((table) => table.clear()));
  });

  it('shows a scramble, a zeroed timer and an empty session', async () => {
    render(<TimerScreen />);

    expect(await screen.findByText("R U R' U' F2")).toBeInTheDocument();
    expect(screen.getByText('0.00')).toBeInTheDocument();
    expect(screen.getByText(/no solves yet/i)).toBeInTheDocument();
  });

  it('still reacts to the space bar when a button holds focus', async () => {
    const user = userEvent.setup();
    render(<TimerScreen />);
    await screen.findByText("R U R' U' F2");

    // Tapping the nav or any control leaves focus on a button; the timer must
    // not go deaf because of it.
    screen.getByTitle('Switch session').focus();
    await user.keyboard('[Space>]');
    await user.keyboard('[/Space]');

    // Inspection is on by default, so a tap starts the countdown at 15.
    expect(await screen.findByText('15')).toBeInTheDocument();
  });

  it('stores a solve after a full attempt', async () => {
    const user = userEvent.setup();
    let clock = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => clock);

    render(<TimerScreen />);
    await screen.findByText("R U R' U' F2");

    // Tap to start inspection.
    await user.keyboard('[Space>]');
    clock += 50;
    await user.keyboard('[/Space]');

    // Hold past the threshold, then release to start the solve.
    clock += 8000;
    await user.keyboard('[Space>]');
    clock += 400;
    await user.keyboard('[/Space]');

    // Solve for 12.34s, then press to stop.
    clock += 12_340;
    await user.keyboard('[Space>]');

    await waitFor(async () => {
      expect(await db.solves.count()).toBe(1);
    });
    const solve = await db.solves.toCollection().first();
    expect(solve?.rawMs).toBe(12_340);
  });

  it('stops a running solve on any key, not just space', async () => {
    const user = userEvent.setup();
    let clock = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => clock);

    render(<TimerScreen />);
    await screen.findByText("R U R' U' F2");

    await user.keyboard('[Space>]');
    clock += 50;
    await user.keyboard('[/Space]');
    clock += 3000;
    await user.keyboard('[Space>]');
    clock += 400;
    await user.keyboard('[/Space]');

    clock += 9990;
    await user.keyboard('[KeyK>]');
    await user.keyboard('[/KeyK]');

    await waitFor(async () => {
      expect(await db.solves.count()).toBe(1);
    });
    expect((await db.solves.toCollection().first())?.rawMs).toBe(9990);
  });

  it('shows the result and reveals the next scramble only after confirmation', async () => {
    const user = userEvent.setup();
    let clock = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => clock);

    render(<TimerScreen />);
    await screen.findByText("R U R' U' F2");

    await user.keyboard('[Space>]');
    clock += 50;
    await user.keyboard('[/Space]');
    clock += 3000;
    await user.keyboard('[Space>]');
    clock += 400;
    await user.keyboard('[/Space]');
    clock += 12_340;
    await user.keyboard('[Space>]');
    await user.keyboard('[/Space]');

    const next = await screen.findByRole('button', { name: 'Next scramble' });
    expect(screen.getByText("R U R' U' F2").closest('.scramble')).toHaveClass(
      'scramble--hidden',
    );

    await user.click(next);
    expect(screen.getByText("R U R' U' F2").closest('.scramble')).not.toHaveClass(
      'scramble--hidden',
    );
    expect(screen.queryByRole('button', { name: 'Next scramble' })).not.toBeInTheDocument();
  });

  it('times a solve phase by phase, and the last tap stops the clock', async () => {
    await seedCfop();
    const user = userEvent.setup();
    let clock = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => clock);

    render(<TimerScreen />);
    await screen.findByText("R U R' U' F2");
    const phaseToggle = await screen.findByRole('checkbox', { name: 'Phases' });
    // The toggle stays disabled until the method's phases have been read.
    await waitFor(() => expect(phaseToggle).toBeEnabled());
    await user.click(phaseToggle);

    // Tap to inspect, hold to start.
    await user.keyboard('[Space>]');
    clock += 50;
    await user.keyboard('[/Space]');
    clock += 3000;
    await user.keyboard('[Space>]');
    clock += 400;
    await user.keyboard('[/Space]');

    expect(await screen.findByText('Cross')).toBeInTheDocument();

    // Cross, F2L and OLL end on a tap; the fourth tap ends PLL and the solve.
    for (const phaseMs of [2000, 8000, 4000, 6000]) {
      clock += phaseMs;
      await user.keyboard('[Space>]');
      await user.keyboard('[/Space]');
    }

    await waitFor(async () => {
      expect(await db.solves.count()).toBe(1);
    });
    const solve = await db.solves.toCollection().first();
    expect(solve?.rawMs).toBe(20_000);
    expect(solve?.splits).toEqual([
      { phase: 'cross', atMs: 2000, source: 'manual' },
      { phase: 'f2l', atMs: 10_000, source: 'manual' },
      { phase: 'oll', atMs: 14_000, source: 'manual' },
    ]);
  });

  it('finishes a phase solve early when the tap is held', async () => {
    await seedCfop();
    const user = userEvent.setup();
    let clock = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => clock);

    render(<TimerScreen />);
    await screen.findByText("R U R' U' F2");
    const phaseToggle = await screen.findByRole('checkbox', { name: 'Phases' });
    // The toggle stays disabled until the method's phases have been read.
    await waitFor(() => expect(phaseToggle).toBeEnabled());
    await user.click(phaseToggle);

    await user.keyboard('[Space>]');
    clock += 50;
    await user.keyboard('[/Space]');
    clock += 3000;
    await user.keyboard('[Space>]');
    clock += 400;
    await user.keyboard('[/Space]');

    clock += 2000;
    await user.keyboard('[Space>]');
    await user.keyboard('[/Space]');

    // The cube was done during F2L: hold instead of tapping through OLL and PLL.
    clock += 7000;
    await user.keyboard('[Space>]');
    clock += 400;
    await user.keyboard('[/Space]');

    await waitFor(async () => {
      expect(await db.solves.count()).toBe(1);
    });
    const solve = await db.solves.toCollection().first();
    // The time comes from the press, so holding it costs nothing.
    expect(solve?.rawMs).toBe(9000);
    expect(solve?.splits).toEqual([{ phase: 'cross', atMs: 2000, source: 'manual' }]);
  });

  it('creates the default session on first render', async () => {
    render(<TimerScreen />);

    await waitFor(async () => {
      expect(await db.sessions.count()).toBe(1);
    });
    const session = await db.sessions.toCollection().first();
    expect(session?.puzzle).toBe('333');
    expect(session?.isActive).toBe(1);
  });
});
