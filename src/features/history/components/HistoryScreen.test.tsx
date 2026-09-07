import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../../db/schema';
import { getOrCreateActiveSession } from '../../../db/repositories/session-repository';
import { addSolve, updateSolve } from '../../../db/repositories/solve-repository';
import { HistoryScreen } from './HistoryScreen';

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

describe('HistoryScreen', () => {
  let sessionId: string;

  beforeEach(async () => {
    await Promise.all(db.tables.map((table) => table.clear()));
    sessionId = (await getOrCreateActiveSession('333', 'freestyle')).id;
  });

  it('lists the session solves newest first', async () => {
    await seedSolve(sessionId, 12_340);
    await seedSolve(sessionId, 9990);

    render(<HistoryScreen />);

    const times = await screen.findAllByText(/^\d+\.\d{2}/);
    // The fastest of them wears the mark that says so; the order is the point here.
    expect(times.map((node) => node.textContent?.replace('★', ''))).toEqual(['9.99', '12.34']);
  });

  it('marks the row holding a best, and lights it', async () => {
    await seedSolve(sessionId, 12_340);
    await seedSolve(sessionId, 9990);

    render(<HistoryScreen />);

    const marks = await screen.findAllByLabelText('Holds a best of this view');
    expect(marks).toHaveLength(1);
    const row = marks[0]?.closest('.history__row');
    expect(row).toHaveClass('is-notable');
    expect(row?.textContent).toContain('9.99');
  });

  it('applies a penalty from the detail drawer and shows the new result', async () => {
    const solve = await seedSolve(sessionId, 12_340);
    const user = userEvent.setup();

    render(<HistoryScreen />);
    await user.click(await screen.findByText('12.34'));
    await user.click(await screen.findByRole('button', { name: 'Penalty +2' }));

    await waitFor(async () => {
      expect((await db.solves.get(solve.id))?.penalty).toBe('plus2');
    });
    // Shown twice: in the row and in the drawer header. They are two live
    // queries, so one lands a tick after the other.
    await waitFor(() => {
      expect(screen.getAllByText('14.34')).toHaveLength(2);
    });
  });

  it('filters out solves that do not match', async () => {
    await seedSolve(sessionId, 12_340);
    const dnf = await seedSolve(sessionId, 9990);
    await updateSolve(dnf.id, { penalty: 'dnf' });

    const user = userEvent.setup();
    render(<HistoryScreen />);

    await user.click(await screen.findByRole('button', { name: 'Filter by DNF' }));

    await waitFor(() => {
      expect(screen.queryByText('12.34')).not.toBeInTheDocument();
    });
    expect(screen.getAllByText('DNF').length).toBeGreaterThan(0);
  });
});
