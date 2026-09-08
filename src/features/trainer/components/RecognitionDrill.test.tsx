import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../../../db/schema';
import { setSetting } from '../../../db/repositories/settings-repository';
import { seedPacks } from '../../../db/seed/seed';
import { DrillScreen } from './DrillScreen';

// The recognition screen never asks for one, but the drill screen it shares a
// route with builds its module worker on import, which jsdom cannot run.
vi.mock('../../../lib/scramble-client', () => ({
  requestScramble: () => Promise.resolve(''),
}));
vi.mock('cubing/twisty', () => ({}));

/** Every card on offer. */
function cards(): HTMLElement[] {
  return screen.getAllByRole('button').filter((node) => node.classList.contains('case-card'));
}

function firstCard(): HTMLElement {
  const [first] = cards();
  if (first === undefined) throw new Error('no cards on offer');
  return first;
}

/** The cards on offer, by the name written on each. */
function optionNames(): string[] {
  const grid = screen.getByRole('button', { name: /^T( |$)/ }).closest('.case-grid');
  return [...(grid?.querySelectorAll('.case-card__name') ?? [])].map(
    (node) => node.textContent ?? '',
  );
}

describe('RecognitionDrill', () => {
  beforeEach(async () => {
    await Promise.all(db.tables.map((table) => table.clear()));
    await seedPacks();
    await setSetting('trainer.drillMode', 'recognise');
    await setSetting('trainer.drillSetId', 'pll');
    // Two cases, so which one is asked is still a draw but the cards are not.
    await setSetting('trainer.drillCaseIds', ['pll-t', 'pll-y']);
  });

  it('asks which case it is without naming it', async () => {
    render(<DrillScreen />);

    expect(await screen.findByText('Which case is this?')).toBeInTheDocument();
    // Both cases are on offer; neither is announced as the answer.
    await waitFor(() => expect(optionNames().sort()).toEqual(['T', 'Y']));
    expect(screen.queryByText(/^Right/)).not.toBeInTheDocument();
    expect(screen.queryByText(/^No —/)).not.toBeInTheDocument();
  });

  it('times the answer and stores it against the case that was asked', async () => {
    const user = userEvent.setup();
    let clock = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => clock);
    render(<DrillScreen />);
    await screen.findByText('Which case is this?');

    clock += 1400;
    await user.click(firstCard());

    await waitFor(async () => expect(await db.solves.count()).toBe(1));
    const solve = await db.solves.toCollection().first();
    expect(solve?.mode).toBe('recognition');
    expect(solve?.rawMs).toBe(1400);
    expect(['pll-t', 'pll-y']).toContain(solve?.caseId);
    // Nothing was performed, so nothing was inspected either.
    expect(solve?.inspectionMs).toBeNull();
  });

  it('marks a right answer right and a wrong one a DNF', async () => {
    const user = userEvent.setup();
    render(<DrillScreen />);
    await screen.findByText('Which case is this?');

    // Which case came up is a draw, so the card is tapped first and what it
    // turned out to be is read off the screen: the answer's card is the one
    // marked correct once the question is over.
    const tapped = firstCard();
    await user.click(tapped);
    await screen.findByRole('status');

    const wasRight = tapped.classList.contains('is-correct');
    const solve = await db.solves.toCollection().first();
    expect(solve?.penalty).toBe(wasRight ? 'none' : 'dnf');
    expect(screen.getByRole('status').textContent).toMatch(wasRight ? /^Right/ : /^No —/);
    // Either way the case is named, which is the point of the exercise.
    expect(screen.getByRole('status').textContent).toMatch(/(T|Y)/);
  });

  it('ignores a second tap on a question already answered', async () => {
    const user = userEvent.setup();
    render(<DrillScreen />);
    await screen.findByText('Which case is this?');

    for (const card of cards()) await user.click(card);

    await waitFor(async () => expect(await db.solves.count()).toBe(1));
  });

  it('turns the cube round without ending the question', async () => {
    const user = userEvent.setup();
    render(<DrillScreen />);
    await screen.findByText('Which case is this?');

    const before = screen.getByRole('img', { name: 'Which case is this?' }).getAttribute('src');
    await user.click(screen.getByRole('button', { name: 'Turn round' }));

    const after = screen.getByRole('img', { name: 'Which case is this?' }).getAttribute('src');
    expect(after).not.toBe(before);
    expect(screen.getByText('Seen from the back left.')).toBeInTheDocument();
    // Still a question: nothing has been answered and nothing stored.
    expect(await db.solves.count()).toBe(0);
    expect(screen.getByText('Which case is this?')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Turn back' }));
    expect(screen.getByRole('img', { name: 'Which case is this?' }).getAttribute('src')).toBe(
      before,
    );
  });

  it('has nothing to ask when only one case is ticked', async () => {
    await setSetting('trainer.drillCaseIds', ['pll-t']);
    render(<DrillScreen />);

    expect(
      await screen.findByText('Tick at least two cases: with one there is nothing to tell apart.'),
    ).toBeInTheDocument();
  });

  it('has no case to recognise in the cross', async () => {
    await setSetting('trainer.drillSetId', 'cross');
    render(<DrillScreen />);

    expect(
      await screen.findByText('The cross has no case to recognise. Pick another set.'),
    ).toBeInTheDocument();
  });

  it('moves on to a fresh question', async () => {
    const user = userEvent.setup();
    render(<DrillScreen />);
    await screen.findByText('Which case is this?');

    await user.click(firstCard());
    await screen.findByRole('status');

    await user.click(screen.getByRole('button', { name: 'Next case' }));

    expect(await screen.findByText('Which case is this?')).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('keeps the switch back to solving', async () => {
    const user = userEvent.setup();
    render(<DrillScreen />);
    await screen.findByText('Which case is this?');

    await user.click(screen.getByRole('button', { name: 'Solve it' }));

    // The solve drill hands you something to perform instead.
    expect(await screen.findByText('Perform it, then hold to start.')).toBeInTheDocument();
    expect(within(document.body).queryByText('Which case is this?')).not.toBeInTheDocument();
  });
});
