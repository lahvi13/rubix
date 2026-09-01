import { render, screen, waitFor } from '@testing-library/react';
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
