import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../../db/schema';
import { getActiveAlgorithm } from '../../../db/repositories/alg-repository';
import { seedPacks } from '../../../db/seed/seed';
import { TrainerScreen } from './TrainerScreen';

describe('TrainerScreen', () => {
  beforeEach(async () => {
    await Promise.all(db.tables.map((table) => table.clear()));
    await seedPacks();
  });

  it('shows the cases of the first set as pictures you can open', async () => {
    render(<TrainerScreen />);

    const card = await screen.findByRole('button', { name: 'F2L 1' });
    // The picture is the card; its name is the caption, so the diagram itself
    // stays out of the accessibility tree.
    expect(card.querySelector('svg')).toBeInTheDocument();
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

  it('explains the notation with a picture per move', async () => {
    const user = userEvent.setup();
    render(<TrainerScreen />);

    await user.click(await screen.findByRole('button', { name: 'Notation' }));

    expect(await screen.findByRole('img', { name: "R'" })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'M' })).toBeInTheDocument();
  });
});
