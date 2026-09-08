import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../../db/schema';
import { getSetting } from '../../../db/repositories/settings-repository';
import { seedPacks } from '../../../db/seed/seed';
import { strings } from '../../../lib/strings';
import { LEARN_STEPS } from '../steps';
import { LearnScreen } from './LearnScreen';

describe('LearnScreen', () => {
  beforeEach(async () => {
    await Promise.all(db.tables.map((table) => table.clear()));
    await seedPacks();
    window.location.hash = '';
  });

  it('walks a whole solve, a numbered step at a time', async () => {
    render(<LearnScreen />);

    const headings = await screen.findAllByRole('heading', { level: 2 });
    expect(headings.map((heading) => heading.textContent)).toEqual(
      LEARN_STEPS.map((step, index) => `${index + 1}${step.title}`),
    );
  });

  /** A case shows a cube; the buttons that work the screen do not. */
  const caseButtons = (section: HTMLElement): HTMLElement[] =>
    within(section)
      .getAllByRole('button')
      .filter((button) => button.querySelector('img') !== null);

  const sections = (): HTMLElement[] =>
    screen.getAllByRole('heading', { level: 2 }).map((heading) => {
      const section = heading.closest('section');
      if (section === null) throw new Error('a step outside a section');
      return section;
    });

  const settled = () =>
    waitFor(() => {
      expect(screen.queryByText(strings.learn.loading)).not.toBeInTheDocument();
    });

  it('opens on one algorithm per last-layer step, however many cases it has', async () => {
    render(<LearnScreen />);
    await settled();

    // The first two layers have no shortcut — every case there has to be
    // learned — and the four last-layer steps each open on one algorithm.
    expect(sections().map((section) => caseButtons(section).length)).toEqual([0, 3, 2, 1, 1, 1, 1]);
  });

  /**
   * The other half of the same point: the cases are there, and the step
   * headings point at groups that still exist. A group name that stopped
   * matching its pack would leave a step empty and nothing else would notice.
   */
  it('has every case of every step behind the button', async () => {
    const user = userEvent.setup();
    render(<LearnScreen />);
    await settled();

    for (const button of screen.getAllByRole('button', { name: strings.learn.showCases })) {
      await user.click(button);
    }

    expect(sections().map((section) => caseButtons(section).length)).toEqual([0, 3, 2, 3, 7, 2, 4]);
  });

  it('shows the cross rather than describing it', async () => {
    render(<LearnScreen />);

    const figure = screen.getByRole('figure');
    expect(figure.querySelector('img')?.getAttribute('src')).toContain('data:image/svg+xml,');
  });

  it('opens the case sheet on a case, the same one the trainer opens', async () => {
    const user = userEvent.setup();
    render(<LearnScreen />);

    await user.click(await screen.findByRole('button', { name: /^Sune/ }));

    expect(await screen.findByRole('dialog', { name: 'Sune' })).toBeInTheDocument();
  });

  it('sends the drill at one step, not at the whole set it comes from', async () => {
    const user = userEvent.setup();
    render(<LearnScreen />);
    await settled();

    const edgeStep = screen
      .getAllByRole('heading', { level: 2 })
      .find((heading) => heading.textContent === '4Last layer cross')
      ?.closest('section');
    if (!edgeStep) throw new Error('no edge orientation step');

    await user.click(within(edgeStep).getByRole('button', { name: 'Drill this step' }));

    expect(await getSetting('trainer.drillSetId')).toBe('2look-oll');
    // The first look of two-look OLL, not its seven corner cases as well.
    expect(await getSetting('trainer.drillCaseIds')).toEqual([
      '2oll-line',
      '2oll-l',
      '2oll-dot',
    ]);
    expect(window.location.hash).toBe('#/drill');
  });
});
