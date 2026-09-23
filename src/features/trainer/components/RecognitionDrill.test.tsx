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
  requestCaseScramble: () => Promise.resolve('D2 R2'),
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
    // The question is asked before its cards are ready, and the clock only
    // starts with them; advancing it in that gap leaves nothing to measure.
    await waitFor(() => expect(cards().length).toBeGreaterThan(0));

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
    // The status shows the moment the answer is judged, but the row is
    // written after it; reading straight away catches an empty table.
    await waitFor(async () => expect(await db.solves.count()).toBe(1));
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

  it('keeps the algorithm back until the question is over, then writes it for this angle', async () => {
    const user = userEvent.setup();
    render(<DrillScreen />);
    await screen.findByText('Which case is this?');

    // Nothing to read off the screen while it is still a question.
    expect(document.querySelector('.recognition__solution')).toBeNull();

    await user.click(firstCard());
    await screen.findByRole('status');

    const solution = document.querySelector('.recognition__solution');
    expect(solution).not.toBeNull();

    // The algorithm shown is the one the answered case is drilled with.
    await waitFor(async () => expect(await db.solves.count()).toBe(1));
    const solve = await db.solves.toCollection().first();
    const active = await db.algorithms
      .where('caseId')
      .equals(solve?.caseId ?? '')
      .filter((row) => row.isActive === 1)
      .first();
    // The moves only: AlgText writes the name of each trigger over it, and
    // those words sit in the same element's text.
    const written = [...(solution?.querySelectorAll('.alg .alg__move') ?? [])]
      .map((node) => node.textContent)
      .join(' ');
    expect(written).toBe(active?.moves);

    // The turn in front, when there is one, is a U turn and stands apart from
    // the algorithm rather than inside it.
    const auf = solution?.querySelector('.recognition__auf')?.textContent ?? '';
    expect(["", 'U', 'U2', "U'"]).toContain(auf);
  });

  it('draws the brackets the algorithm was written with, as the trainer does', async () => {
    // Blocks no trigger claims, so only the brackets can draw them.
    await db.algorithms
      .where('caseId')
      .equals('pll-t')
      .modify({ moves: "R U R' U' (R' F R2 U') R' U' R U R' F'" });
    await db.algorithms
      .where('caseId')
      .equals('pll-y')
      .modify({ moves: "(F R U' R') U' R U R' F' R U R' U' R' F R F'" });
    const user = userEvent.setup();
    render(<DrillScreen />);
    await screen.findByText('Which case is this?');

    await user.click(firstCard());
    await screen.findByRole('status');

    const blocks = [...document.querySelectorAll('.recognition__solution .alg__part--group')];
    expect(blocks).toHaveLength(1);
    expect(["R' F R2 U'", "F R U' R'"]).toContain(blocks[0]?.textContent);
  });

  it('turns the cube round without ending the question', async () => {
    const user = userEvent.setup();
    render(<DrillScreen />);
    await screen.findByText('Which case is this?');

    const before = screen.getByRole('img', { name: 'Which case is this?' }).getAttribute('src');
    await user.click(screen.getByRole('button', { name: 'Turn round' }));

    const after = screen.getByRole('img', { name: 'Which case is this?' }).getAttribute('src');
    expect(after).not.toBe(before);
    // The one line says the cube has moved, which the picture cannot.
    expect(screen.getByText('Seen from the back left.')).toBeInTheDocument();
    expect(screen.queryByText('Which case is this?')).not.toBeInTheDocument();
    // Still a question: nothing has been answered and nothing stored.
    expect(await db.solves.count()).toBe(0);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Turn back' }));
    expect(screen.getByText('Which case is this?')).toBeInTheDocument();
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

  it('does not offer the cross as something to name', async () => {
    const user = userEvent.setup();
    await setSetting('trainer.drillSetId', 'cross');
    render(<DrillScreen />);

    // Naming it was a dead end, so the switch goes rather than the answer
    // being an apology: the cross opens on the drill it actually has.
    expect(await screen.findByRole('timer')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /^Change what is drilled/ }));
    expect(screen.queryByRole('button', { name: 'Name it' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Solve it' })).not.toBeInTheDocument();
  });

  it('leaves the stored half alone while the cross is on screen', async () => {
    await setSetting('trainer.drillSetId', 'cross');
    render(<DrillScreen />);
    await screen.findByRole('timer');

    // The cross is solved rather than named because it has no other half, not
    // because a preference was changed — so leaving it goes back to naming.
    expect(await db.settings.get('trainer.drillMode')).toMatchObject({ value: 'recognise' });
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

  it('keeps the set, the pool and the way back behind one line', async () => {
    const user = userEvent.setup();
    render(<DrillScreen />);
    await screen.findByText('Which case is this?');

    // Folded away by default: the cube and the cards have to share one screen.
    expect(screen.queryByRole('button', { name: 'Solve it' })).not.toBeInTheDocument();
    // The set has its own row above the line, so the line says what is being
    // done with it rather than repeating the name.
    expect(screen.getByRole('button', { name: 'PLL' })).toHaveClass('is-active');
    const summary = screen.getByRole('button', { name: /Name it/ });
    expect(summary).toHaveTextContent('Full · Name it · 2 / 21');

    await user.click(summary);
    await user.click(screen.getByRole('button', { name: 'Solve it' }));

    // The solve drill hands you something to perform instead.
    expect(await screen.findByText('Perform it, then hold to start.')).toBeInTheDocument();
    expect(within(document.body).queryByText('Which case is this?')).not.toBeInTheDocument();
  });
});
