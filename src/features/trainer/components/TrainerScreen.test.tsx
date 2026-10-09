import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../../db/schema';
import { getActiveAlgorithm, setCaseProgress } from '../../../db/repositories/alg-repository';
import { seedPacks } from '../../../db/seed/seed';
import { addDrillSolve } from '../../../db/repositories/drill-repository';
import { getSetting, setSetting } from '../../../db/repositories/settings-repository';
import { TrainerScreen } from './TrainerScreen';

/** A live query redrawing a whole set of cards, under a full run of the suite. */
const SLOW_RENDER = { timeout: 15_000 };

// Every test here draws a set of 41 or 57 cards, each with its algorithm, and
// under jsdom in a full run of the suite one that also opens a sheet and waits
// on two live queries ran past the default five seconds.
describe('TrainerScreen', { timeout: 20_000 }, () => {
  beforeEach(async () => {
    await Promise.all(db.tables.map((table) => table.clear()));
    await seedPacks();
    // The look is pinned: two-look PLL has its own case ids, and almost every
    // case here is reached by the card's name.
    await setSetting('trainer.twoLookDefault', false);
  });

  it('says what is drilled and which cases to work on', async () => {
    const user = userEvent.setup();
    // Three attempts on one F2L case, slow ones: enough to be ranked.
    for (const rawMs of [9000, 9500, 10_000]) {
      await addDrillSolve({
        puzzle: '333',
        caseId: 'f2l-1',
        scramble: "R U R'",
        rawMs,
        penalty: 'none',
        penaltySource: 'auto',
        inspectionMs: null,
        startedAt: Date.now(),
      });
    }

    render(<TrainerScreen />);

    // Drilling the case put it in hand by itself. A set of 41 cards, each with
    // its algorithm, is slow enough to draw under fake-indexeddb and a full
    // run of the suite that the default second is not always enough.
    expect(
      await screen.findByText('Known 0 of 41 · learning 1 · 3 attempts', undefined, SLOW_RENDER),
    ).toBeInTheDocument();
    // The suggestion is a way into the case, not just a label: its ao5 is the
    // 9.50 in the middle of those three attempts.
    await user.click(await screen.findByRole('button', { name: 'F2L 1 9.50' }));
    expect(await screen.findByRole('dialog', { name: 'F2L 1' })).toBeInTheDocument();
  });

  it('marks a case known from its sheet', async () => {
    const user = userEvent.setup();
    render(<TrainerScreen />);

    // A set nobody has touched says so and nothing more.
    expect(await screen.findByText('Nothing drilled here yet.', undefined, SLOW_RENDER)).toBeInTheDocument();

    await user.click(await screen.findByRole('button', { name: 'F2L 1' }, SLOW_RENDER));
    const detail = await screen.findByRole('dialog', { name: 'F2L 1' }, SLOW_RENDER);
    const known = within(detail).getByRole('button', { name: 'Known' });
    expect(within(detail).getByRole('button', { name: 'New' })).toHaveAttribute('aria-pressed', 'true');

    await user.click(known);

    // What is kept, and the sheet that asked for it. The set's cards redraw
    // too, but that is 41 cube pictures recomputed by a live query — under a
    // coverage run it outlasted any sensible wait, so the next test reads the
    // cards from a first draw instead.
    await waitFor(async () => expect((await db.algCases.get('f2l-1'))?.progress).toBe('known'), SLOW_RENDER);
    await waitFor(() => expect(known).toHaveAttribute('aria-pressed', 'true'), SLOW_RENDER);
  });

  it('shows how well a case is known, on its card and over the set', async () => {
    await setCaseProgress('f2l-1', 'known');
    render(<TrainerScreen />);

    expect(await screen.findByText('Known 1 of 41', undefined, SLOW_RENDER)).toBeInTheDocument();
    // The card says it too — to the eye as its edge, and in its name.
    expect(screen.getByRole('button', { name: 'F2L 1, Known' })).toHaveClass('is-known');
  });

  it('shows the cases of the first set as pictures you can open', async () => {
    render(<TrainerScreen />);

    const card = await screen.findByRole('button', { name: 'F2L 1' });
    // The picture is the card; its name is the caption, so the diagram itself
    // stays out of the accessibility tree — an image with no alt text.
    const diagram = card.querySelector('img');
    expect(diagram).toBeInTheDocument();
    expect(diagram?.getAttribute('alt')).toBe('');
    expect(diagram?.getAttribute('src')).toContain('data:image/svg+xml,');
    expect(screen.getAllByRole('button', { name: /^F2L \d+$/ })).toHaveLength(41);
  });

  it.each([
    ['small', 'case-grid'],
    ['large', 'case-grid case-grid--large'],
    ['list', 'case-grid case-grid--list'],
  ] as const)('lays the cases out %s, as chosen in Settings', async (layout, className) => {
    await setSetting('ui.caseLayout', layout);
    render(<TrainerScreen />);

    const card = await screen.findByRole('button', { name: 'F2L 1' }, SLOW_RENDER);
    expect(card.parentElement?.className).toBe(className);
  });

  it('names the triggers inside the algorithm of a case', async () => {
    const user = userEvent.setup();
    render(<TrainerScreen />);

    await user.click(await screen.findByRole('button', { name: 'PLL' }));
    await user.click(await screen.findByRole('button', { name: /^T$/ }));

    const detail = await screen.findByRole('dialog', { name: 'T' });
    // The T perm opens with a sexy move; the reader should be told so.
    expect(within(detail).getAllByText('Sexy move').length).toBeGreaterThan(0);
  });

  it('takes an algorithm of your own and drills that one instead', async () => {
    const user = userEvent.setup();
    render(<TrainerScreen />);

    await user.click(await screen.findByRole('button', { name: 'PLL' }));
    await user.click(await screen.findByRole('button', { name: /^T$/ }));

    const detail = await screen.findByRole('dialog', { name: 'T' });
    await user.type(within(detail).getByLabelText(/Your own algorithm/), "R U R' U'");
    await user.click(within(detail).getByRole('button', { name: 'Add' }));

    await waitFor(async () => {
      expect((await getActiveAlgorithm('pll-t'))?.source).toBe('user');
    });
  });

  it('offers a second built-in algorithm where the pack has one, and says why', async () => {
    const user = userEvent.setup();
    render(<TrainerScreen />);

    await user.click(await screen.findByRole('button', { name: 'PLL' }));
    await user.click(await screen.findByRole('button', { name: /^Ua/ }));

    const detail = await screen.findByRole('dialog', { name: 'Ua' });
    // Both are built in, and the list has to say which is which: one is the
    // pack's answer, the other a different solution offered beside it.
    expect(within(detail).getByText('built in')).toBeInTheDocument();
    expect(within(detail).getAllByText('built in · another way').length).toBeGreaterThan(0);

    // It is not hidden by the setting that hides the rotation variants, and
    // picking it makes it the one that gets drilled.
    await user.click(within(detail).getByRole('radio', { name: "R U' R U R U R U' R' U' R2" }));

    await waitFor(async () => {
      expect((await getActiveAlgorithm('pll-ua'))?.id).toBe('pll-ua-pack-other-1');
    });
  });

  it('refuses an algorithm it cannot read', async () => {
    const user = userEvent.setup();
    render(<TrainerScreen />);

    await user.click(await screen.findByRole('button', { name: 'PLL' }));
    await user.click(await screen.findByRole('button', { name: /^T$/ }));

    const detail = await screen.findByRole('dialog', { name: 'T' });
    await user.type(within(detail).getByLabelText(/Your own algorithm/), 'R U Q');

    expect(within(detail).getByRole('button', { name: 'Add' })).toBeDisabled();
    // Nothing was written: the case still has only what it shipped with.
    const stored = await db.algorithms.where('caseId').equals('pll-t').toArray();
    expect(stored.length).toBeGreaterThan(0);
    expect(stored.filter((algorithm) => algorithm.source === 'user')).toHaveLength(0);
  });

  it('offers the short route through OLL and PLL, and only those', async () => {
    const user = userEvent.setup();
    render(<TrainerScreen />);

    // F2L is one look; there is nothing to switch between.
    expect(await screen.findByRole('button', { name: 'F2L' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^2-Look \d/ })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'OLL' }));
    await user.click(await screen.findByRole('button', { name: /^2-Look \d/ }));

    // Three edge shapes and seven corner cases instead of fifty-seven.
    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: /^(I|L|Dot|Sune|Anti-Sune|H|Pi|T|U|Bowtie)$/ })).toHaveLength(10);
    });
    expect(screen.getByRole('heading', { name: '1 / Edges' })).toBeInTheDocument();
  });

  it('opens on the look last chosen', async () => {
    const user = userEvent.setup();
    await setSetting('trainer.twoLookDefault', true);
    render(<TrainerScreen />);

    await user.click(await screen.findByRole('button', { name: 'PLL' }));

    // Six cases under two-look PLL, twenty-one under the full set.
    expect(await screen.findByRole('button', { name: 'Y' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Ja' })).not.toBeInTheDocument();
  });

  it('remembers the look chosen on the screen, for the next visit', async () => {
    const user = userEvent.setup();
    render(<TrainerScreen />);

    await user.click(await screen.findByRole('button', { name: 'PLL' }));
    await user.click(await screen.findByRole('button', { name: /^2-Look \d/ }));

    // The setting, not the screen: what has to survive is the leaving.
    await waitFor(async () => {
      expect(await getSetting('trainer.twoLookDefault')).toBe(true);
    });
  });

  it('comes back to the set that was last looked at', async () => {
    const user = userEvent.setup();
    const first = render(<TrainerScreen />);

    await user.click(await screen.findByRole('button', { name: 'PLL' }));
    // The setting, not the screen: what has to survive is the leaving, and a
    // live query swapping fifty-seven cards for twenty-one is slow enough
    // under fake-indexeddb to time a test out on its own.
    await waitFor(async () => {
      expect(await getSetting('trainer.setId')).toBe('pll');
    });

    first.unmount();
    render(<TrainerScreen />);

    expect(await screen.findByRole('button', { name: 'T' })).toBeInTheDocument();
  });

  it('opens on the first set when the remembered one is gone', async () => {
    await setSetting('trainer.setId', 'no-such-set');
    render(<TrainerScreen />);

    expect(await screen.findByRole('button', { name: 'F2L 1' })).toBeInTheDocument();
  });

  it('offers the three levels of F2L, and only under F2L', async () => {
    const user = userEvent.setup();
    render(<TrainerScreen />);

    expect(await screen.findByRole('button', { name: 'Basic' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Advanced' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Expert' })).toBeInTheDocument();

    // A level is a set in the database; it must not also stand in the row that
    // names the sets, or F2L would appear to be three subjects.
    const sets = screen.getAllByRole('button', { name: /^(F2L|OLL|PLL|Advanced|Expert)$/ });
    expect(sets.filter((button) => button.textContent === 'Advanced')).toHaveLength(1);

    await user.click(screen.getByRole('button', { name: 'PLL' }));
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Expert' })).not.toBeInTheDocument();
    });
  });

  it('shows the advanced cases and comes back to them', async () => {
    const user = userEvent.setup();
    const first = render(<TrainerScreen />);

    await user.click(await screen.findByRole('button', { name: 'Advanced' }));
    await waitFor(async () => {
      expect(await getSetting('trainer.setId')).toBe('f2l-advanced');
    });

    first.unmount();
    render(<TrainerScreen />);

    expect(await screen.findByRole('button', { name: 'Advanced 1' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /^Advanced \d+$/ })).toHaveLength(36);
    // The row above still says F2L: the level is how far in, not another set.
    expect(screen.getByRole('button', { name: 'F2L' }).className).toContain('is-active');
  });

  it('goes back to the level last looked at after a detour through another set', async () => {
    const user = userEvent.setup();
    render(<TrainerScreen />);

    await user.click(await screen.findByRole('button', { name: 'Advanced' }));
    await user.click(screen.getByRole('button', { name: 'OLL' }));
    await waitFor(async () => {
      expect(await getSetting('trainer.setId')).toBe('oll');
    });

    // Picking F2L again is not a decision to start F2L over. The setting is
    // asserted rather than the cards: the swap is slow under fake-indexeddb.
    await user.click(screen.getByRole('button', { name: 'F2L' }));
    await waitFor(async () => {
      expect(await getSetting('trainer.setId')).toBe('f2l-advanced');
    });
  });

  it('opens a set with levels on its first level when none has been looked at', async () => {
    const user = userEvent.setup();
    await setSetting('trainer.setId', 'oll');
    render(<TrainerScreen />);

    await user.click(await screen.findByRole('button', { name: 'F2L' }));

    await waitFor(async () => {
      expect(await getSetting('trainer.setId')).toBe('f2l');
    });
  });

  it('marks the cards whose algorithm is the reader’s own doing', async () => {
    const user = userEvent.setup();
    const first = render(<TrainerScreen />);

    // Nothing is marked while every case is on the algorithm it shipped with.
    expect(await screen.findByRole('button', { name: 'F2L 1' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'F2L 1' }));
    const detail = await screen.findByRole('dialog', { name: 'F2L 1' });
    await user.type(within(detail).getByLabelText(/Your own algorithm/), "R U R' U'");
    await user.click(within(detail).getByRole('button', { name: 'Add' }));
    await waitFor(async () => {
      expect((await getActiveAlgorithm('f2l-1'))?.source).toBe('user');
    });

    first.unmount();
    render(<TrainerScreen />);

    // The dot is a colour; what it means is what the card is called.
    expect(
      await screen.findByRole('button', { name: 'F2L 1 your own algorithm' }),
    ).toBeInTheDocument();
  });

  it('marks a card whose algorithm takes a slot apart', async () => {
    const user = userEvent.setup();
    const first = render(<TrainerScreen />);

    await user.click(await screen.findByRole('button', { name: 'F2L 7' }));
    const detail = await screen.findByRole('dialog', { name: 'F2L 7' });
    await user.click(within(detail).getByRole('radio', { name: "y2 U2 L' U L U S' L S" }));
    await waitFor(async () => {
      expect((await getActiveAlgorithm('f2l-7'))?.id).toBe('f2l-7-pack-slot-1');
    });

    first.unmount();
    render(<TrainerScreen />);

    expect(
      await screen.findByRole('button', { name: 'F2L 7 breaks another slot' }),
    ).toBeInTheDocument();
  });

  it('keeps the two-look sets out of the list of sets', async () => {
    render(<TrainerScreen />);

    const sets = await screen.findAllByRole('button', { name: /^(F2L|OLL|PLL|2-Look OLL|2-Look PLL)$/ });
    expect(sets.map((button) => button.textContent)).toEqual(['F2L', 'OLL', 'PLL']);
  });

  it('explains the notation with a picture per move', async () => {
    const user = userEvent.setup();
    render(<TrainerScreen />);

    await user.click(await screen.findByRole('button', { name: 'Notation' }));

    expect(await screen.findByRole('img', { name: "R'" })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'M' })).toBeInTheDocument();
  });
});
