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
