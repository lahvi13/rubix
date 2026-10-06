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
      .queryAllByRole('button')
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

    // The cross shows its two situations; the first two layers have no
    // shortcut — every algorithm there has to be learned — and the three steps
    // that can be got through by repeating one algorithm show exactly that one.
    expect(sections().map((section) => caseButtons(section).length)).toEqual([2, 3, 2, 3, 1, 1, 1]);
  });

  it('shows how to hold the cube for the repeats, without an algorithm each', async () => {
    render(<LearnScreen />);
    await settled();

    const face = sectionFor(`5${strings.learn.steps.cornerOrientation.title}`);

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

    expect(sections().map((section) => caseButtons(section).length)).toEqual([2, 3, 2, 3, 7, 2, 4]);
  });

  it('shows the cross rather than describing it', async () => {
    render(<LearnScreen />);

    // The two ways an edge goes down, as cards, then the finished cross.
    const cross = sectionFor('1Cross');
    const pictures = [...caseButtons(cross), ...within(cross).getAllByRole('figure')];
    expect(pictures).toHaveLength(3);
    for (const picture of pictures) {
      expect(picture.querySelector('img')?.getAttribute('src')).toContain('data:image/svg+xml,');
    }
  });

  it('plays a cross situation where it is, without a case sheet', async () => {
    const user = userEvent.setup();
    render(<LearnScreen />);

    const cross = sectionFor('1Cross');
    await user.click(within(cross).getByRole('button', { name: /^White on top/ }));

    // The card opens round a cube with its own controls, and no sheet opens.
    const opened = within(cross).getAllByRole('figure')[0];
    if (!opened) throw new Error('the situation did not open');
    expect(opened).toHaveTextContent(strings.learn.crossCases.whiteUp);
    expect(within(opened).getByRole('button', { name: strings.playback.pause })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('opens the case sheet on a case, the same one the trainer opens', async () => {
    const user = userEvent.setup();
    render(<LearnScreen />);

    await user.click(await screen.findByRole('button', { name: /^Sune/ }));

    expect(await screen.findByRole('dialog', { name: 'Sune' })).toBeInTheDocument();
  });

  it('sends nobody to the drill', async () => {
    render(<LearnScreen />);
    await settled();

    // A deliberate absence, so it stays absent: practising one case against a
    // clock is for somebody who can already solve the cube.
    expect(screen.queryByText(/drill/i)).not.toBeInTheDocument();
    expect(window.location.hash).toBe('');
  });

  it('explains the letters without leaving the page', async () => {
    const user = userEvent.setup();
    render(<LearnScreen />);

    await user.click(screen.getByRole('button', { name: strings.trainer.notation }));

    expect(screen.getByText(strings.trainer.notationHint)).toBeInTheDocument();
  });

  it('folds the explanations away and keeps what the steps show', async () => {
    const user = userEvent.setup();
    render(<LearnScreen />);
    await settled();

    // A step is written in points; the first one stands for the rest.
    const text = LEARN_STEPS[0]?.points[0] ?? '';
    expect(screen.getByText(text)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: strings.learn.explanations }));

    await waitFor(() => {
      expect(screen.queryByText(text)).not.toBeInTheDocument();
    });
    expect(screen.queryByText(strings.learn.intro)).not.toBeInTheDocument();
    // How to hold the cube for the repeats is the page as a cheat sheet, not
    // an explanation of it.
    expect(screen.getByText(strings.learn.holds.noneOriented)).toBeInTheDocument();
    expect(await getSetting('ui.learnExplanations')).toBe(false);
  });

  it('goes to a step from the row of numbers', async () => {
    const user = userEvent.setup();
    const scrolled: Element[] = [];
    Element.prototype.scrollIntoView = function (this: Element) {
      scrolled.push(this);
    };
    render(<LearnScreen />);
    await settled();

    const nav = screen.getByRole('navigation', { name: strings.learn.stepsNav });
    await user.click(within(nav).getByRole('button', { name: 'Corners home' }));

    expect(scrolled).toEqual([sectionFor('6Corners home')]);
    expect(within(nav).getByRole('button', { name: 'Corners home' })).toHaveAttribute(
      'aria-current',
      'true',
    );
  });

  it('lets a reader who is past it take the page out of the menu', async () => {
    const user = userEvent.setup();
    render(<LearnScreen />);

    await user.click(await screen.findByRole('checkbox', { name: strings.learn.hide }));

    await waitFor(async () => {
      expect(await getSetting('ui.showLearn')).toBe(false);
    });
  });

  it('says where the method came from', () => {
    render(<LearnScreen />);

    expect(screen.getByRole('link', { name: strings.learn.sourceLink })).toHaveAttribute(
      'href',
      'http://badmephisto.com',
    );
  });
});
