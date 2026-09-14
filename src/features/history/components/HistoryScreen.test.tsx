import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../../db/schema';
import {
  activateSession,
  createSession,
  getOrCreateActiveSession,
} from '../../../db/repositories/session-repository';
import {
  addSolve,
  listSolvesChronological,
  updateSolve,
} from '../../../db/repositories/solve-repository';
import { resetSheetHistory } from '../../../lib/sheet-history';
import { strings } from '../../../lib/strings';
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

/** The solve rows, which the list now interleaves with day headings. */
function rows(): Element[] {
  return [...document.querySelectorAll('.history__row')];
}

describe('HistoryScreen', () => {
  let sessionId: string;

  beforeEach(async () => {
    await Promise.all(db.tables.map((table) => table.clear()));
    sessionId = (await getOrCreateActiveSession('333', 'freestyle')).id;
    // Picking solves holds a back entry in module state, which outlives a render.
    resetSheetHistory();
  });

  it('opens the session picker from the name of the session being read', async () => {
    const user = userEvent.setup();

    render(<HistoryScreen />);
    await user.click(await screen.findByRole('button', { name: 'Default' }));

    expect(await screen.findByRole('dialog', { name: 'Sessions' })).toBeInTheDocument();
  });

  it('moves the selected solves into another session', async () => {
    const other = await createSession('Evening', '333', 'freestyle');
    // createSession activates what it creates; the history reads the active one.
    await activateSession(sessionId);
    const solve = await seedSolve(sessionId, 12_340);
    const user = userEvent.setup();

    render(<HistoryScreen />);
    await user.click(await screen.findByRole('button', { name: 'Select' }));
    await user.click(await screen.findByLabelText('Select solve'));
    await user.click(screen.getByRole('button', { name: 'Move to…' }));
    await user.click(await screen.findByRole('button', { name: /Evening/ }));

    await waitFor(async () => {
      expect(await listSolvesChronological(other.id)).toHaveLength(1);
    });
    // Moved, not copied, and not silently switched to the destination either.
    expect(await listSolvesChronological(sessionId)).toHaveLength(0);
    expect(solve.sessionId).toBe(sessionId);
  });

  it('picks solves by tapping their rows once selecting, and forgets them on done', async () => {
    await seedSolve(sessionId, 12_340);
    await seedSolve(sessionId, 15_670);
    const user = userEvent.setup();

    render(<HistoryScreen />);
    await screen.findByText('12.34');
    expect(screen.queryByLabelText('Select solve')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Select' }));
    expect(screen.getByRole('button', { name: 'Delete' })).toBeDisabled();

    await user.click(screen.getByText('12.34'));
    // A tap picks the row rather than opening it.
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByText('1 selected')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete' })).toBeEnabled();

    await user.click(screen.getByRole('button', { name: 'Done' }));
    expect(screen.queryByLabelText('Select solve')).not.toBeInTheDocument();
    expect(screen.queryByText('1 selected')).not.toBeInTheDocument();

    // Out of the mode, the same tap opens the solve again.
    await user.click(screen.getByText('12.34'));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });

  it('says an empty session is empty, and blames the filter only when there is one', async () => {
    const user = userEvent.setup();

    render(<HistoryScreen />);
    expect(await screen.findByText(strings.history.noSolves)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Filter by DNF' }));
    expect(await screen.findByText(strings.history.empty)).toBeInTheDocument();
  });

  it('counts the session, and what a filter leaves of it', async () => {
    await seedSolve(sessionId, 12_340);
    const dnf = await seedSolve(sessionId, 9990);
    await updateSolve(dnf.id, { penalty: 'dnf' });
    const user = userEvent.setup();

    render(<HistoryScreen />);
    expect(await screen.findByText(/2 solves/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Filter by DNF' }));
    expect(await screen.findByText(/1 of 2/)).toBeInTheDocument();
  });

  it('leaves picking, not the history, on back', async () => {
    await seedSolve(sessionId, 12_340);
    const user = userEvent.setup();

    render(<HistoryScreen />);
    await user.click(await screen.findByRole('button', { name: 'Select' }));
    await user.click(screen.getByText('12.34'));
    expect(screen.getByText('1 selected')).toBeInTheDocument();

    await act(async () => {
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    expect(screen.queryByText('1 selected')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Select solve')).not.toBeInTheDocument();
  });

  it('moves a single solve out of the detail sheet', async () => {
    const other = await createSession('Evening', '333', 'freestyle');
    await activateSession(sessionId);
    await seedSolve(sessionId, 12_340);
    const user = userEvent.setup();

    render(<HistoryScreen />);
    await user.click(await screen.findByText('12.34'));
    await user.click(await screen.findByRole('button', { name: 'Move to…' }));
    await user.click(await screen.findByRole('button', { name: /Evening/ }));

    await waitFor(async () => {
      expect(await listSolvesChronological(other.id)).toHaveLength(1);
    });
    // The detail was showing a solve that is somewhere else now.
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('steps from one solve to the next without going back to the list', async () => {
    await seedSolve(sessionId, 12_340);
    await seedSolve(sessionId, 9990);
    const user = userEvent.setup();

    render(<HistoryScreen />);
    // Newest first, so the fastest one is at the top of the list.
    await user.click(await screen.findByText('9.99'));
    // The sheet reads the solve back from the database, so it arrives a
    // tick after the tap.
    await screen.findByRole('dialog');
    expect(screen.getByText('1 / 2')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Next' }));

    await waitFor(() => {
      expect(screen.getByText('2 / 2')).toBeInTheDocument();
    });
    expect(screen.getByLabelText('Time')).toHaveValue('12.34');
  });

  it('stops at both ends of the list rather than wrapping round', async () => {
    await seedSolve(sessionId, 12_340);
    await seedSolve(sessionId, 9990);
    const user = userEvent.setup();

    render(<HistoryScreen />);
    await user.click(await screen.findByText('9.99'));
    await screen.findByRole('dialog');

    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled();

    await user.click(screen.getByRole('button', { name: 'Next' }));

    await waitFor(() => {
      expect(screen.getByText('2 / 2')).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Previous' })).toBeEnabled();
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

    // Nothing faster exists anywhere, so the session's best is the best there
    // has ever been and is marked as the stronger of the two.
    const marks = await screen.findAllByLabelText('Personal best');
    expect(marks).toHaveLength(1);
    const row = marks[0]?.closest('.history__row');
    expect(row).toHaveClass('is-notable');
    expect(row?.textContent).toContain('9.99');
  });

  it('tells the best of this session apart from the best there has ever been', async () => {
    const elsewhere = await createSession('Evening', '333', 'freestyle');
    await seedSolve(elsewhere.id, 5000);
    await activateSession(sessionId);
    await seedSolve(sessionId, 12_340);
    await seedSolve(sessionId, 9990);

    render(<HistoryScreen />);

    // The faster solve is another session's, so this one only holds the
    // session record and says so.
    const marks = await screen.findAllByLabelText('Best of this session');
    expect(marks).toHaveLength(1);
    expect(marks[0]?.closest('.history__row')?.textContent).toContain('9.99');
    expect(screen.queryByLabelText('Personal best')).not.toBeInTheDocument();
  });

  it('keeps the records marked when a filter is on', async () => {
    await seedSolve(sessionId, 12_340);
    const best = await seedSolve(sessionId, 9990);
    await updateSolve(best.id, { starred: 1 });
    const user = userEvent.setup();

    render(<HistoryScreen />);
    await user.click(await screen.findByRole('button', { name: 'Filter marked' }));

    // A record belongs to the solve, not to whatever the filters let through:
    // the mark must not move because the list got shorter.
    await waitFor(() => {
      expect(rows()).toHaveLength(1);
    });
    expect(await screen.findByLabelText('Personal best')).toBeInTheDocument();
  });

  it('shows only the records when asked for them', async () => {
    await seedSolve(sessionId, 12_340);
    await seedSolve(sessionId, 9990);
    const user = userEvent.setup();

    render(<HistoryScreen />);
    await user.click(await screen.findByRole('button', { name: 'Filter records' }));

    await waitFor(() => {
      expect(rows()).toHaveLength(1);
    });
    expect(screen.getByText(/9.99/)).toBeInTheDocument();
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
    // Shown twice, marked as a +2: in the row and in the drawer header. They
    // are two live queries, so one lands a tick after the other.
    await waitFor(() => {
      expect(screen.getAllByText('14.34+')).toHaveLength(2);
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
  it('heads each day, so a long session is not an undated column', async () => {
    const today = await seedSolve(sessionId, 12_340);
    const earlier = await seedSolve(sessionId, 9990);
    // Two days apart, which is what a session left running over a week looks
    // like from the inside.
    await db.solves.update(earlier.id, { createdAt: today.createdAt - 2 * 86_400_000 });

    render(<HistoryScreen />);

    await waitFor(() => {
      expect(rows()).toHaveLength(2);
    });
    const headings = [...document.querySelectorAll('.history__day')];
    expect(headings).toHaveLength(2);
    // One heading per day, not one per solve.
    expect(headings[0]?.textContent).not.toBe(headings[1]?.textContent);
  });

  it('heads the day once when the solves share it', async () => {
    await seedSolve(sessionId, 12_340);
    await seedSolve(sessionId, 9990);

    render(<HistoryScreen />);

    await waitFor(() => {
      expect(rows()).toHaveLength(2);
    });
    expect(document.querySelectorAll('.history__day')).toHaveLength(1);
  });

  it('narrows the list to one day of practice, and back again', async () => {
    const today = await seedSolve(sessionId, 12_340);
    const earlier = await seedSolve(sessionId, 9990);
    await db.solves.update(earlier.id, { createdAt: today.createdAt - 2 * 86_400_000 });
    const user = userEvent.setup();

    render(<HistoryScreen />);
    await waitFor(() => {
      expect(rows()).toHaveLength(2);
    });

    await user.click(screen.getByRole('button', { name: 'Filter by day' }));
    const picker = await screen.findByRole('dialog', { name: 'Days' });
    // Only the days that were practised on: every one carries a count, which
    // the way back to all of them does not.
    expect(picker.querySelectorAll('.day__count')).toHaveLength(2);

    await user.click(within(picker).getAllByRole('button', { name: /solve/ })[0]!);

    await waitFor(() => {
      expect(rows()).toHaveLength(1);
    });
    // One day on screen, so the heading that names it appears once.
    expect(document.querySelectorAll('.history__day')).toHaveLength(1);

    await user.click(screen.getByRole('button', { name: 'Filter by day' }));
    await user.click(await screen.findByRole('button', { name: 'All days' }));

    await waitFor(() => {
      expect(rows()).toHaveLength(2);
    });
  });

  // One day is not a choice, and a chip offering it would be a dead control.
  it('offers no day picker until there is more than one day', async () => {
    await seedSolve(sessionId, 12_340);
    await seedSolve(sessionId, 9990);

    render(<HistoryScreen />);

    await waitFor(() => {
      expect(rows()).toHaveLength(2);
    });
    expect(screen.queryByRole('button', { name: 'Filter by day' })).not.toBeInTheDocument();
  });

});
