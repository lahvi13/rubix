import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../../db/schema';
import { getActiveAlgorithm } from '../../../db/repositories/alg-repository';
import { seedPacks } from '../../../db/seed/seed';
import { addDrillSolve } from '../../../db/repositories/drill-repository';
import { TrainerScreen } from './TrainerScreen';

describe('TrainerScreen', () => {
  beforeEach(async () => {
    await Promise.all(db.tables.map((table) => table.clear()));
    await seedPacks();
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

    expect(await screen.findByText('1 / 41 drilled · 3 attempts')).toBeInTheDocument();
    // The suggestion is a way into the case, not just a label: its ao5 is the
    // 9.50 in the middle of those three attempts.
    await user.click(await screen.findByRole('button', { name: 'F2L 1 9.50' }));
    expect(await screen.findByRole('dialog', { name: 'F2L 1' })).toBeInTheDocument();
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

  it('refuses an algorithm it cannot read', async () => {
    const user = userEvent.setup();
    render(<TrainerScreen />);

    await user.click(await screen.findByRole('button', { name: 'PLL' }));
    await user.click(await screen.findByRole('button', { name: /^T$/ }));

    const detail = await screen.findByRole('dialog', { name: 'T' });
    await user.type(within(detail).getByLabelText(/Your own algorithm/), 'R U Q');

    expect(within(detail).getByRole('button', { name: 'Add' })).toBeDisabled();
    expect(await db.algorithms.where('caseId').equals('pll-t').count()).toBe(1);
  });

  it('offers the short route through OLL and PLL, and only those', async () => {
    const user = userEvent.setup();
    render(<TrainerScreen />);

    // F2L is one look; there is nothing to switch between.
    expect(await screen.findByRole('button', { name: 'F2L' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /2-Look/ })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'OLL' }));
    await user.click(await screen.findByRole('button', { name: /2-Look/ }));

    // Three edge shapes and seven corner cases instead of fifty-seven.
    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: /^(I|L|Dot|Sune|Anti-Sune|H|Pi|T|U|Bowtie)$/ })).toHaveLength(10);
    });
    expect(screen.getByRole('heading', { name: '1 / Edges' })).toBeInTheDocument();
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
