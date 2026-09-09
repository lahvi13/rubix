import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../../../db/schema';
import {
  activateSession,
  createSession,
  getActiveSession,
  getOrCreateActiveSession,
} from '../../../db/repositories/session-repository';
import { addSolve, updateSolve } from '../../../db/repositories/solve-repository';
import { StatsScreen } from './StatsScreen';

// The charts are dumb by contract and jsdom has no layout for Recharts to
// measure; the numbers on the cards are what this screen is responsible for.
vi.mock('../charts/HistogramChart', () => ({
  HistogramChart: () => <div data-testid="histogram-chart" />,
}));
vi.mock('../charts/TrendChart', () => ({
  TrendChart: () => <div data-testid="trend-chart" />,
}));

async function seedSolve(sessionId: string, rawMs: number) {
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
  });
}

describe('StatsScreen', () => {
  let sessionId: string;

  beforeEach(async () => {
    await Promise.all(db.tables.map((table) => table.clear()));
    sessionId = (await getOrCreateActiveSession('333', 'freestyle')).id;
  });

  it('shows the empty state before the first solve', async () => {
    render(<StatsScreen />);
    expect(await screen.findByText('No solves in this session yet.')).toBeInTheDocument();
  });

  it('shows PB, averages and rates computed from the session', async () => {
    for (const rawMs of [10_000, 11_000, 12_000, 13_000, 14_000]) {
      await seedSolve(sessionId, rawMs);
    }
    const dnf = await seedSolve(sessionId, 9000);
    await updateSolve(dnf.id, { penalty: 'dnf' });

    render(<StatsScreen />);

    // PB single and session best agree here: the clean 10s. The two cards fill
    // from separate live queries, so wait for both.
    await waitFor(() => {
      expect(screen.getAllByText('10.00')).toHaveLength(2);
    });
    // Current ao5 over the last five (11..14 + DNF): DNF trimmed, (12+13+14)/3.
    expect(screen.getByText('ao5')).toBeInTheDocument();
    expect(screen.getByText('13.00')).toBeInTheDocument();
    // Not enough solves for ao12 yet.
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
    // One DNF out of six solves, on the card that carries both rates.
    expect(screen.getByText('17% DNF')).toBeInTheDocument();
    expect(screen.getByText('0% +2')).toBeInTheDocument();

    expect(await screen.findByTestId('histogram-chart')).toBeInTheDocument();
    // Six solves have no ao12, so the rolling chart has nothing to draw and
    // is left out rather than shown as an empty pair of axes.
    expect(screen.queryByTestId('trend-chart')).not.toBeInTheDocument();
  });

  it('draws the rolling ao12 once the window has filled', async () => {
    for (let i = 0; i < 12; i += 1) await seedSolve(sessionId, 10_000 + i * 100);

    render(<StatsScreen />);

    expect(await screen.findByTestId('trend-chart')).toBeInTheDocument();
  });
  it('opens the solve behind a best without moving the reader elsewhere', async () => {
    // The all-time best belongs to another session; the one being read holds
    // only its own best.
    const elsewhere = await createSession('Evening', '333', 'freestyle');
    await seedSolve(elsewhere.id, 5000);
    await activateSession(sessionId);
    await seedSolve(sessionId, 12_000);
    const user = userEvent.setup();

    render(<StatsScreen />);
    await screen.findByText('5.00');

    await user.click(screen.getByRole('button', { name: /PB single/i }));

    const sheet = await screen.findByRole('dialog');
    // It says which session it came from, since it is not this one. The name
    // is a second read, so it lands a tick after the sheet itself.
    await waitFor(() => {
      expect(sheet.textContent).toContain('Evening');
    });
    // And reading it did not move anybody: the active session is untouched.
    expect((await getActiveSession('333', 'freestyle'))?.id).toBe(sessionId);
  });

  it('leaves a best that has no solve behind it unpressable', async () => {
    render(<StatsScreen />);

    await screen.findByText('No solves in this session yet.');
    expect(screen.queryByRole('button', { name: /PB single/i })).not.toBeInTheDocument();
  });

});
