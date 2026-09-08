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

  const sectionFor = (title: string): HTMLElement => {
    const found = sections().find((section) => section.textContent?.startsWith(title));
    if (!found) throw new Error(`no step titled ${title}`);
    return found;
  };

  const settled = () =>
    waitFor(() => {
      expect(screen.queryByText(strings.learn.loading)).not.toBeInTheDocument();
    });

  it('walks a whole solve, a numbered step at a time', async () => {
    render(<LearnScreen />);
    await settled();

    expect(sections().map((section) => section.querySelector('h2')?.textContent)).toEqual(
      LEARN_STEPS.map((step, index) => `${index + 1}${step.title}`),
    );
  });

  it('opens the last-layer steps on one algorithm, however many cases they have', async () => {
    render(<LearnScreen />);
    await settled();

    // The first two layers have no shortcut — every algorithm there has to be
    // learned — and the three steps that can be got through by repeating one
    // algorithm show exactly that one.
    expect(sections().map((section) => caseButtons(section).length)).toEqual([0, 3, 2, 3, 1, 1, 1]);
  });

  it('shows how to hold the cube for the repeats, without an algorithm each', async () => {
    render(<LearnScreen />);
    await settled();

    const face = sectionFor('5Last layer face');

    expect(within(face).getAllByRole('figure')).toHaveLength(2);
    expect(within(face).getByText(strings.learn.holds.noneOriented)).toBeInTheDocument();
  });

  /**
   * The other half of the same point: the cases are there, and the steps point
   * at groups that still exist. A group name that stopped matching its pack
   * would leave a step empty and nothing else would notice.
   */
  it('has every case of the step behind the button', async () => {
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

    const figure = within(sectionFor('1Cross')).getByRole('figure');
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

    const step = sectionFor('4Last layer cross');
    await user.click(within(step).getByRole('button', { name: strings.learn.drillStep }));

    expect(await getSetting('trainer.drillSetId')).toBe('2look-oll');
    // The first look of two-look OLL, not its seven corner cases as well.
    expect(await getSetting('trainer.drillCaseIds')).toEqual(['2oll-line', '2oll-l', '2oll-dot']);
    expect(window.location.hash).toBe('#/drill');
  });

  it('drills the level on show, not the one underneath it', async () => {
    const user = userEvent.setup();
    render(<LearnScreen />);
    await settled();

    // The corner step's beginner algorithm and its quicker version live in
    // different sets, so switching level has to change what the drill gets.
    const step = sectionFor('6Corners home');
    await user.click(within(step).getByRole('button', { name: strings.learn.drillStep }));
    expect(await getSetting('trainer.drillSetId')).toBe('beginner');
    expect(await getSetting('trainer.drillCaseIds')).toEqual(['beg-corners']);

    await user.click(within(step).getByRole('button', { name: strings.learn.showCases }));
    await user.click(within(step).getByRole('button', { name: strings.learn.drillStep }));

    expect(await getSetting('trainer.drillSetId')).toBe('2look-pll');
    expect(await getSetting('trainer.drillCaseIds')).toEqual(['2pll-t', '2pll-y']);
  });
});
