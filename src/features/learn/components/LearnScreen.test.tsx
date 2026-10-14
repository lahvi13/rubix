import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../../db/schema';
import { getSetting, setSetting } from '../../../db/repositories/settings-repository';
import { createSession } from '../../../db/repositories/session-repository';
import { seedPacks } from '../../../db/seed/seed';
import { strings } from '../../../lib/strings';
import { LEARN_STEPS, ORTEGA_STEPS, POCKET_STEPS, ROUX_STEPS, ZZ_STEPS } from '../steps';
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

  it('opens a cross situation in a sheet of its own, with only the cube and the moves', async () => {
    const user = userEvent.setup();
    render(<LearnScreen />);

    await user.click(within(sectionFor('1Cross')).getByRole('button', { name: /^White on top/ }));

    const sheet = await screen.findByRole('dialog', { name: strings.learn.crossCases.whiteUp });
    expect(within(sheet).getByRole('button', { name: strings.playback.play })).toBeInTheDocument();
    // Not a case to learn: no progress to mark, no variants to pick.
    expect(within(sheet).queryByRole('group', { name: strings.trainer.progressLabel })).not.toBeInTheDocument();
    expect(within(sheet).queryByRole('radio')).not.toBeInTheDocument();
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

  it('opens on the guide of the method being timed in', async () => {
    await createSession('Blocks', '333', 'freestyle', 'roux');
    render(<LearnScreen />);

    await waitFor(() =>
      expect(sections().map((section) => section.querySelector('h2')?.textContent)).toEqual(
        ROUX_STEPS.map((step, index) => `${index + 1}${step.title}`),
      ),
    );
  });

  it('comes back to the guide read last, whatever the session is timed in', async () => {
    const user = userEvent.setup();
    const first = render(<LearnScreen />);
    await settled();

    await user.click(screen.getByRole('button', { name: 'Roux' }));
    await waitFor(async () => {
      expect(await getSetting('ui.learnMethod')).toBe('roux');
    });
    first.unmount();

    // Still a CFOP session; the page was left on Roux.
    render(<LearnScreen />);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Roux' })).toHaveAttribute('aria-pressed', 'true'),
    );
  });

  it('switches to the other guide, each Roux step shown by pictures or one algorithm', async () => {
    const user = userEvent.setup();
    render(<LearnScreen />);
    await settled();

    await user.click(screen.getByRole('button', { name: 'Roux' }));
    await settled();

    expect(screen.getByRole('button', { name: 'Roux' })).toHaveAttribute('aria-pressed', 'true');
    // No moves for the left block, two pairs for the right one, Sune and Jb,
    // the arrow and the four ways to it, the four places the side edges can
    // be with the first drawn for both colours, and the two ways the middle
    // slice can be left.
    await waitFor(() =>
      expect(sections().map((section) => caseButtons(section).length)).toEqual([
        0, 2, 1, 1, 5, 5, 2,
      ]),
    );
    // The left block is shown finished instead.
    const [leftBlock] = sections();
    if (!leftBlock) throw new Error('the guide lost its first step');
    expect(within(leftBlock).getByRole('figure')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: strings.learn.rouxSourceLink })).toHaveAttribute(
      'href',
      'https://sites.google.com/view/kianroux/',
    );
  });

  it('has a third guide for ZZ, its first step an example and its edges and pairs all pictures', async () => {
    const user = userEvent.setup();
    render(<LearnScreen />);
    await settled();

    await user.click(screen.getByRole('button', { name: 'ZZ' }));
    await settled();

    expect(sections().map((section) => section.querySelector('h2')?.textContent)).toEqual(
      ZZ_STEPS.map((step, index) => `${index + 1}${step.title}`),
    );
    // Nothing to turn while the bad edges are being counted; five pictures of
    // turning them good, two for the cross, the two shapes a pair goes in
    // from, and the last layer as the first guide has it.
    await waitFor(() =>
      expect(sections().map((section) => caseButtons(section).length)).toEqual([
        0, 5, 2, 2, 1, 1, 1,
      ]),
    );
    // The three kinds of colour to find as pictures, then the cube to count
    // on and the same cube with the answer, the moves that make it printed
    // once.
    const [badEdges, , , pairs] = sections();
    if (!badEdges || !pairs) throw new Error('the guide lost a step');
    expect(within(badEdges).getAllByRole('figure')).toHaveLength(5);
    expect(within(badEdges).getByText(strings.learn.zzRules.readsSide)).toBeInTheDocument();
    expect(within(badEdges).getByText(strings.learn.zzFigures.answer)).toBeInTheDocument();
    expect(badEdges.querySelectorAll('.alg')).toHaveLength(1);

    // The way to the two shapes is there for whoever asks, and goes away again.
    await user.click(within(pairs).getByRole('button', { name: strings.learn.zzPairsMore.show }));
    expect(caseButtons(pairs)).toHaveLength(7);
    expect(within(pairs).getByText(strings.learn.zzPairsMore.lead)).toBeInTheDocument();
    await user.click(within(pairs).getByRole('button', { name: strings.learn.zzPairsMore.hide }));
    expect(caseButtons(pairs)).toHaveLength(2);

    expect(screen.getByText(strings.learn.zzNext.more)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: strings.learn.zzSourceLink })).toHaveAttribute(
      'href',
      'https://www.zzmethod.com/',
    );
  });

  it('says where the method came from', () => {
    render(<LearnScreen />);

    expect(screen.getByRole('link', { name: strings.learn.sourceLink })).toHaveAttribute(
      'href',
      'http://badmephisto.com',
    );
  });

  describe('with the app on the 2×2', () => {
    beforeEach(async () => {
      await setSetting('ui.puzzle', '222');
    });

    it("walks the 2×2's own three steps, and offers its two guides only", async () => {
      render(<LearnScreen />);
      await screen.findByText(strings.learn.pocket.intro);

      expect(sections().map((section) => section.querySelector('h2')?.textContent)).toEqual(
        POCKET_STEPS.map((step, index) => `${index + 1}${step.title}`),
      );
      const methods = screen.getByRole('group', { name: strings.learn.method });
      expect(within(methods).getAllByRole('button').map((button) => button.textContent)).toEqual([
        strings.learn.guideNames['222-layers'],
        strings.learn.guideNames['222-ortega'],
      ]);
      expect(screen.queryByRole('button', { name: 'CFOP' })).toBeNull();
    });

    it('switches to Ortega: the face, then every case of the two sets, each one to play', async () => {
      const user = userEvent.setup();
      render(<LearnScreen />);
      await user.click(await screen.findByRole('button', { name: strings.learn.guideNames['222-ortega'] }));
      await screen.findByText(strings.learn.ortega.intro);
      await settled();

      expect(sections().map((section) => section.querySelector('h2')?.textContent)).toEqual(
        ORTEGA_STEPS.map((step, index) => `${index + 1}${step.title}`),
      );
      await waitFor(() =>
        expect(sections().map((section) => caseButtons(section).length)).toEqual([0, 7, 5]),
      );
      expect(await getSetting('ui.learnMethod.222')).toBe('222-ortega');
      expect(await getSetting('ui.learnMethod')).toBe('');

      const [, oll] = sections();
      if (!oll) throw new Error('the guide lost its OLL');
      const [sune] = caseButtons(oll);
      if (!sune) throw new Error('no case to open');
      await user.click(sune);

      const sheet = await screen.findByRole('dialog');
      expect(within(sheet).getByRole('heading', { level: 2, name: 'Sune' })).toBeInTheDocument();
      expect(within(sheet).getByRole('button', { name: strings.playback.play })).toBeInTheDocument();
    });

    it('draws every picture as a 2×2: four stickers to a face, not nine', async () => {
      render(<LearnScreen />);
      await screen.findByText(strings.learn.pocket.intro);

      const pictures = [...document.querySelectorAll<HTMLImageElement>('main img')];
      expect(pictures.length).toBeGreaterThanOrEqual(9);
      for (const picture of pictures) {
        const drawn = decodeURIComponent(picture.src);
        // Three faces of plastic under four stickers each.
        expect((drawn.match(/<polygon/g) ?? []).length).toBe(15);
      }
    });

    it('opens a situation in its own sheet, the four moves printed once', async () => {
      const user = userEvent.setup();
      render(<LearnScreen />);
      await screen.findByText(strings.learn.pocket.intro);

      const [whiteLayer] = sections();
      if (!whiteLayer) throw new Error('the guide lost its first step');
      const cards = caseButtons(whiteLayer);
      expect(cards).toHaveLength(3);
      expect(whiteLayer.querySelectorAll('.alg')).toHaveLength(3);

      const [, threeTimes] = cards;
      if (!threeTimes) throw new Error('no second card');
      await user.click(threeTimes);
      const sheet = await screen.findByRole('dialog', { name: strings.learn.pocket.situations.whiteUp });
      expect(within(sheet).getByRole('button', { name: strings.playback.play })).toBeInTheDocument();
    });

    it('explains only the letters a 2×2 can turn', async () => {
      const user = userEvent.setup();
      render(<LearnScreen />);
      await screen.findByText(strings.learn.pocket.intro);

      await user.click(screen.getByRole('button', { name: strings.trainer.notation }));

      expect(screen.getByRole('img', { name: "R'" })).toBeInTheDocument();
      expect(screen.getByRole('img', { name: 'y' })).toBeInTheDocument();
      expect(screen.queryByRole('img', { name: 'M' })).toBeNull();
      expect(screen.queryByRole('img', { name: 'r' })).toBeNull();
    });

    it("takes its own guide out of the menu and leaves the 3×3's where it was", async () => {
      const user = userEvent.setup();
      render(<LearnScreen />);

      await user.click(await screen.findByRole('checkbox', { name: strings.learn.hide }));

      await waitFor(async () => {
        expect(await getSetting('ui.showLearn.222')).toBe(false);
      });
      expect(await getSetting('ui.showLearn')).toBe(true);
    });

    it('says where the method came from', async () => {
      render(<LearnScreen />);

      expect(
        await screen.findByRole('link', { name: strings.learn.pocket.sourceLink }),
      ).toHaveAttribute('href', 'https://jperm.net/2x2');
    });
  });
});
