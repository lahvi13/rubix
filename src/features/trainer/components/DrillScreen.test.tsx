import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../../../db/schema';
import { parseAlg } from '../../../domain/cube/notation';
import { applyAlg, solvedState, FACELETS } from '../../../domain/cube/state';
import { getSetting, setSetting } from '../../../db/repositories/settings-repository';
import { setCaseProgress } from '../../../db/repositories/alg-repository';
import { seedPacks } from '../../../db/seed/seed';
import { CROSS_SCRAMBLE_LENGTH } from '../../../domain/drill/cross-scramble';
import { DrillScreen } from './DrillScreen';

vi.mock('cubing/twisty', () => ({}));

/** What the solver hands back for a case; the cross is drawn by the app itself. */
const CASE_SCRAMBLE = "D2 B' L2 U R2 F2 D' B2";
let caseScramble: (target: string) => Promise<string>;
vi.mock('../../../lib/scramble-client', () => ({
  requestScramble: () => Promise.resolve(''),
  requestCaseScramble: (target: string) => caseScramble(target),
}));

/**
 * The cross scramble the drill drew, once it is on screen.
 *
 * Read rather than dictated: it is drawn from the app's own cube now, so a
 * test that knew it in advance would be testing a scramble nobody was given.
 */
async function shownScramble(): Promise<string> {
  const line = await waitFor(() => {
    const node = document.querySelector('.drill__scramble .drill__moves');
    if (node?.textContent == null || node.textContent.trim() === '') {
      throw new Error('no scramble on screen yet');
    }
    return node;
  });
  return line.textContent?.trim() ?? '';
}

/**
 * A cross drill with its answer on show, drawn on a scramble that has more
 * than one shortest solution.
 *
 * Which cross the drill hands out is not the test's to choose — it is drawn
 * where the reader's is drawn — and close to a third of them have a single
 * shortest solution and so nothing to list beside it. Rather than dictating a
 * scramble nobody was given, this draws again until it gets one of the rest.
 */
async function shownWithAlternatives(
  user: ReturnType<typeof userEvent.setup>,
): Promise<{ scramble: string; alternatives: string[] }> {
  for (let draw = 0; draw < 12; draw += 1) {
    const view = render(<DrillScreen />);
    const scramble = await shownScramble();

    await user.click(screen.getByRole('button', { name: 'Show me' }));
    await screen.findByRole('heading', { name: /Shortest cross/ });

    const alternatives = screen
      .queryAllByRole('listitem')
      .map((node) => node.textContent?.trim() ?? '');
    if (alternatives.length > 0) return { scramble, alternatives };

    view.unmount();
  }

  throw new Error('twelve crosses drawn, every one with a single shortest solution');
}

/** Hold past the threshold, release to start, press again to stop. */
async function attempt(user: ReturnType<typeof userEvent.setup>, solveMs: number): Promise<void> {
  let clock = 0;
  vi.spyOn(performance, 'now').mockImplementation(() => clock);

  await user.keyboard('[Space>]');
  clock += 400;
  await user.keyboard('[/Space]');
  clock += solveMs;
  await user.keyboard('[Space>]');
  await user.keyboard('[/Space]');
}

/** Everything but the set row lives behind one line; this is the tap that opens it. */
async function openSetup(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  await user.click(await screen.findByRole('button', { name: /^Change what is drilled/ }));
}

/**
 * Whether the printed solution really solves the cross of the held cube.
 *
 * It starts from a solved cube, which is also the check that the drill's
 * promise holds: only the cross pieces of the starting state can matter, so a
 * cube that merely has its cross solved gets the same answer, and that is what
 * lets one attempt run straight into the next.
 */
function isCrossSolvedAfter(scramble: string, hold: string, solution: string): boolean {
  const moves = [scramble, hold, solution].map((text) => {
    const parsed = parseAlg(text);
    if (!parsed.ok) throw new Error(`unparsable: ${text}`);
    return parsed.moves;
  });
  const state = moves.reduce((cube, part) => applyAlg(cube, part), solvedState());

  const centre = (face: string): string | undefined =>
    state[
      FACELETS.findIndex(
        (sticker) =>
          sticker.face === face &&
          sticker.position.filter((coordinate) => coordinate === 0).length === 2,
      )
    ];

  return FACELETS.every((sticker, index) => {
    const zeros = sticker.position.filter((coordinate) => coordinate === 0).length;
    if (zeros !== 1 || sticker.position[1] !== -1) return true;
    return state[index] === centre(sticker.face);
  });
}

describe('DrillScreen', () => {
  beforeEach(async () => {
    await Promise.all(db.tables.map((table) => table.clear()));
    caseScramble = () => Promise.resolve(CASE_SCRAMBLE);
    await seedPacks();
    await setSetting('trainer.drillSetId', 'pll');
    // One case in the pool, so what comes up is not a matter of luck.
    await setSetting('trainer.drillCaseIds', ['pll-t']);
  });

  it('shows the scramble but keeps the case to itself until the attempt is over', async () => {
    const user = userEvent.setup();
    render(<DrillScreen />);

    expect(await screen.findByText(CASE_SCRAMBLE)).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'T' })).not.toBeInTheDocument();

    await attempt(user, 3210);

    expect(await screen.findByRole('heading', { name: 'T' })).toBeInTheDocument();
    await waitFor(async () => expect(await db.solves.count()).toBe(1));
    const solve = await db.solves.toCollection().first();
    expect(solve?.mode).toBe('drill');
    expect(solve?.caseId).toBe('pll-t');
    expect(solve?.rawMs).toBe(3210);
    expect(solve?.penalty).toBe('none');
  });

  it('asks the solver for the case rather than handing out its setup', async () => {
    const asked: string[] = [];
    caseScramble = (target) => {
      asked.push(target);
      return Promise.resolve(CASE_SCRAMBLE);
    };
    render(<DrillScreen />);

    expect(await screen.findByText(CASE_SCRAMBLE)).toBeInTheDocument();
    expect(asked).toHaveLength(1);
    // The setup is the T perm backwards; reading it off the screen would be
    // reading the answer. Its R2 F' survives every rotation and AUF.
    expect(asked[0]).toMatch(/R2 F'/);
    expect(screen.queryByText(/R2 F'/)).not.toBeInTheDocument();
  });

  it("writes the solver's half turns the way the rest of the app does", async () => {
    caseScramble = () => Promise.resolve("B2' R U2'");
    render(<DrillScreen />);

    expect(await screen.findByText('B2 R U2')).toBeInTheDocument();
  });

  it('will not start the clock before the scramble has arrived', async () => {
    const user = userEvent.setup();
    let deliver: (scramble: string) => void = () => {};
    caseScramble = () => new Promise((resolve) => (deliver = resolve));
    render(<DrillScreen />);
    expect(await screen.findByText('Generating scramble…')).toBeInTheDocument();

    await attempt(user, 3000);
    expect(await db.solves.count()).toBe(0);

    deliver(CASE_SCRAMBLE);
    expect(await screen.findByText(CASE_SCRAMBLE)).toBeInTheDocument();
  });

  it('falls back to the setup when the solver cannot be reached', async () => {
    caseScramble = () => Promise.reject(new Error('offline'));
    render(<DrillScreen />);

    expect(await screen.findByText(/R2 F'/)).toBeInTheDocument();
  });

  it('never lets a late scramble land on the next case', async () => {
    const user = userEvent.setup();
    await setSetting('trainer.drillCaseIds', ['pll-t', 'pll-y']);
    const pending: ((scramble: string) => void)[] = [];
    caseScramble = () => new Promise((resolve) => pending.push(resolve));
    render(<DrillScreen />);
    await screen.findByText('Generating scramble…');

    await user.click(screen.getByRole('button', { name: 'Show me' }));
    await user.click(await screen.findByRole('button', { name: 'Next case' }));
    await waitFor(() => expect(pending).toHaveLength(2));

    pending[0]?.("R U R' U'");
    pending[1]?.(CASE_SCRAMBLE);
    expect(await screen.findByText(CASE_SCRAMBLE)).toBeInTheDocument();
    expect(screen.queryByText("R U R' U'")).not.toBeInTheDocument();
  });

  it('never inspects, whatever the timer screen is set to', async () => {
    const user = userEvent.setup();
    await setSetting('timer.inspectionEnabled', true);
    render(<DrillScreen />);
    await screen.findByText(CASE_SCRAMBLE);

    await attempt(user, 5000);

    // With inspection, that first tap would have started a countdown instead
    // of the solve, and the stored attempt would carry an inspection time.
    const solve = await db.solves.toCollection().first();
    expect(solve?.rawMs).toBe(5000);
    expect(solve?.inspectionMs).toBeNull();
  });

  it('will not time a case you have looked up', async () => {
    const user = userEvent.setup();
    render(<DrillScreen />);
    await screen.findByText(CASE_SCRAMBLE);

    await user.click(screen.getByRole('button', { name: 'Show me' }));
    expect(await screen.findByRole('heading', { name: 'T' })).toBeInTheDocument();

    // Reaching for the answer costs a DNF, the way giving up on a solve does —
    // and it is what keeps the case in "Needs work" instead of leaving it with
    // no attempts and so no pace at all.
    await waitFor(async () => {
      expect(await db.solves.count()).toBe(1);
    });
    const looked = await db.solves.toCollection().first();
    expect(looked?.penalty).toBe('dnf');
    expect(looked?.rawMs).toBe(0);
    expect(screen.getByText('Looked up, so it counts as a DNF.')).toBeInTheDocument();

    await attempt(user, 9000);

    // Recognising the case is most of the work, so a time set with the answer
    // already on screen is not a time. The clock refuses rather than storing
    // one, and says why.
    expect(await db.solves.count()).toBe(1);
    expect(screen.getByRole('timer')).toHaveTextContent('0.00');
    expect(screen.getByText('Answer shown — Next case to go again')).toBeInTheDocument();
  });

  it('draws the brackets the algorithm was written with, as the trainer does', async () => {
    // A block no trigger claims, so only the bracket can draw it.
    await db.algorithms
      .where('caseId')
      .equals('pll-t')
      .modify({ moves: "R U R' U' (R' F R2 U') R' U' R U R' F'" });
    const user = userEvent.setup();
    render(<DrillScreen />);
    await screen.findByText(CASE_SCRAMBLE);

    await user.click(screen.getByRole('button', { name: 'Show me' }));
    await screen.findByRole('heading', { name: 'T' });

    const blocks = [...document.querySelectorAll('.drill__answer .alg__part--group')];
    expect(blocks.map((node) => node.textContent)).toEqual(["R' F R2 U'"]);
  });

  it('lets a look-up be thrown away, but not turned into a time', async () => {
    const user = userEvent.setup();
    render(<DrillScreen />);
    await screen.findByText(CASE_SCRAMBLE);

    await user.click(screen.getByRole('button', { name: 'Show me' }));
    await screen.findByRole('heading', { name: 'T' });
    await waitFor(async () => {
      expect(await db.solves.count()).toBe(1);
    });

    // Clearing the DNF would leave a solve of no seconds standing as a time,
    // so the only judgement on offer is throwing it away.
    expect(screen.queryByRole('button', { name: 'DNF' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '+2' })).not.toBeInTheDocument();

    // The row is written before the screen hears it was, so the button that
    // acts on it comes a render later.
    await user.click(await screen.findByRole('button', { name: 'Delete' }));
    await waitFor(async () => {
      expect(await db.solves.count()).toBe(0);
    });
  });

  it('will not time the same case twice once its answer is up', async () => {
    const user = userEvent.setup();
    render(<DrillScreen />);
    await screen.findByText(CASE_SCRAMBLE);

    await attempt(user, 3210);
    expect(await screen.findByRole('heading', { name: 'T' })).toBeInTheDocument();
    await waitFor(async () => {
      expect(await db.solves.count()).toBe(1);
    });

    // A second go at a case whose answer is on screen would flatter its
    // numbers with an attempt nobody really made.
    await attempt(user, 1000);

    expect(await db.solves.count()).toBe(1);
    // The time that was earned is still the one on the clock.
    expect(screen.getByRole('timer')).toHaveTextContent('3.21');

    // Moving on hands the clock back.
    await user.click(screen.getByRole('button', { name: 'Next case' }));
    await attempt(user, 4560);
    await waitFor(async () => {
      expect(await db.solves.count()).toBe(2);
    });
  });

  it('counts the case towards its own statistics, not the timer session', async () => {
    const user = userEvent.setup();
    render(<DrillScreen />);
    await screen.findByText(CASE_SCRAMBLE);

    await attempt(user, 2000);

    // The answer carries what this case has cost so far.
    expect(await screen.findByText('Attempts')).toBeInTheDocument();
    // The clock still shows the same number, so read the case's own record of
    // it rather than the first 2.00 on the screen.
    const recorded = screen.getAllByRole('definition').map((node) => node.textContent);
    expect(recorded).toContain('2.00');
    const session = await db.sessions.toCollection().first();
    expect(session?.mode).toBe('drill');
  });

  it('drills the cross from a real scramble, with no case to reveal', async () => {
    const user = userEvent.setup();
    await setSetting('trainer.drillSetId', 'cross');
    // The cross inspects unless the switch says otherwise; this test is about
    // the scramble, so it takes the short way to the clock.
    await setSetting('timer.inspectionEnabled', false);
    render(<DrillScreen />);

    const scramble = await shownScramble();
    expect(scramble.split(' ')).toHaveLength(CROSS_SCRAMBLE_LENGTH);
    // Nothing to pick from and nothing to look up.
    await openSetup(user);
    expect(screen.queryByRole('button', { name: /^Cases/ })).not.toBeInTheDocument();

    await attempt(user, 4000);

    const solve = await db.solves.toCollection().first();
    expect(solve?.caseId).toBe('cross');
    expect(solve?.scramble).toBe(scramble);
  });

  it('inspects the cross, because planning it is the point', async () => {
    const user = userEvent.setup();
    await setSetting('trainer.drillSetId', 'cross');
    await setSetting('timer.inspectionEnabled', true);
    let clock = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => clock);
    render(<DrillScreen />);
    await shownScramble();

    // A tap starts the countdown rather than the solve.
    await user.keyboard('[Space>]');
    clock += 50;
    await user.keyboard('[/Space]');
    expect(await screen.findByText('15')).toBeInTheDocument();

    clock += 7000;
    await user.keyboard('[Space>]');
    clock += 400;
    await user.keyboard('[/Space]');
    clock += 12_000;
    await user.keyboard('[Space>]');
    await user.keyboard('[/Space]');

    await waitFor(async () => {
      expect(await db.solves.count()).toBe(1);
    });
    const solve = await db.solves.toCollection().first();
    expect(solve?.rawMs).toBe(12_000);
    expect(solve?.inspectionMs).toBe(7400);
  });

  it('takes the answer and the time with it when you move on', async () => {
    const user = userEvent.setup();
    render(<DrillScreen />);
    await screen.findByText(CASE_SCRAMBLE);

    await attempt(user, 3210);
    expect(await screen.findByRole('heading', { name: 'T' })).toBeInTheDocument();
    // On the clock, and again in the case's own record of it — which is a
    // live query of its own and may arrive a moment after the answer.
    await waitFor(() => expect(screen.getAllByText('3.21').length).toBeGreaterThan(1));

    await user.click(screen.getByRole('button', { name: 'Next case' }));

    // The answer belonged to that attempt, and so did the time on the clock.
    expect(screen.queryByRole('heading', { name: 'T' })).not.toBeInTheDocument();
    expect(screen.queryByText('3.21')).not.toBeInTheDocument();
    expect(screen.getByRole('timer')).toHaveTextContent('0.00');
  });

  it('does not carry the answer over to another set', async () => {
    const user = userEvent.setup();
    render(<DrillScreen />);
    await screen.findByText(CASE_SCRAMBLE);

    await attempt(user, 3210);
    expect(await screen.findByRole('heading', { name: 'T' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'F2L' }));

    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: 'T' })).not.toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: 'Show me' })).toBeInTheDocument();
    expect(screen.getByRole('timer')).toHaveTextContent('0.00');
  });

  it('ticks the cases being learned, and offers nothing before there are any', async () => {
    const user = userEvent.setup();
    render(<DrillScreen />);

    await openSetup(user);
    await user.click(await screen.findByRole('button', { name: /^Cases/ }));
    expect(await screen.findByRole('button', { name: "What I'm learning" })).toBeDisabled();

    await setCaseProgress('pll-y', 'learning');
    await setCaseProgress('pll-h', 'learning');
    await setCaseProgress('pll-t', 'known');
    const learning = screen.getByRole('button', { name: "What I'm learning" });
    await waitFor(() => expect(learning).toBeEnabled());
    await user.click(learning);

    await waitFor(async () => {
      expect([...(await getSetting('trainer.drillCaseIds'))].sort()).toEqual(['pll-h', 'pll-y']);
    });
  });

  it('closes the case picker without scrolling back to the top', async () => {
    const user = userEvent.setup();
    render(<DrillScreen />);

    await openSetup(user);
    await user.click(await screen.findByRole('button', { name: /^Cases/ }));
    expect(await screen.findByLabelText('T')).toBeInTheDocument();

    // Closing it from the bottom of the list, where the reader already is.
    await user.click(screen.getByRole('button', { name: 'Done' }));
    expect(screen.queryByLabelText('T')).not.toBeInTheDocument();
  });

  it('shows the shortest cross for the scramble it just gave you', async () => {
    const user = userEvent.setup();
    await setSetting('trainer.drillSetId', 'cross');
    await setSetting('timer.inspectionEnabled', false);
    render(<DrillScreen />);
    const scramble = await shownScramble();

    await user.click(screen.getByRole('button', { name: 'Show me' }));

    const heading = await screen.findByRole('heading', { name: /Shortest cross/ });
    // Green in front by default, which is the cube exactly as it was
    // scrambled: cross down, no turn at all.
    const solution = heading.parentElement?.querySelector('.drill__moves')?.textContent ?? '';
    expect(solution).not.toBe('');
    expect(isCrossSolvedAfter(scramble, '', solution)).toBe(true);
  });

  it('asks which side is in front before the attempt, because the picture needs it', async () => {
    await setSetting('trainer.drillSetId', 'cross');
    await setSetting('timer.inspectionEnabled', false);
    render(<DrillScreen />);
    await shownScramble();

    // The grip decides the colours of the cross drawn above as well as the
    // moves written below, and the picture is read before the clock runs.
    expect(screen.getByRole('button', { name: 'Green' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /Shortest cross/ })).not.toBeInTheDocument();
  });

  it('names the four fronts for a cube held cross down', async () => {
    await setSetting('trainer.drillSetId', 'cross');
    render(<DrillScreen />);
    await shownScramble();

    // Front, right, back, left of the cube as it was scrambled — cross down,
    // which is how it is held for the whole drill.
    for (const colour of ['Green', 'Orange', 'Blue', 'Red']) {
      expect(screen.getByRole('button', { name: colour })).toBeInTheDocument();
    }
  });

  it('draws the cross the scramble lands on, and claims nothing else', async () => {
    await setSetting('trainer.drillSetId', 'cross');
    render(<DrillScreen />);
    await shownScramble();

    // Only the cross: the rest of the reader's cube is whatever the last
    // attempt left there, so drawing it would be an invention. And only here —
    // every other set is set up from the case being drilled, and a picture of
    // that cube would give the answer away.
    expect(
      screen.getByAltText('The cross after the scramble, as you will hold it'),
    ).toBeInTheDocument();
  });

  it("keeps the picture off when the timer's own preview is off", async () => {
    await setSetting('trainer.drillSetId', 'cross');
    await setSetting('timer.showScramblePreview', false);
    render(<DrillScreen />);
    await shownScramble();

    await waitFor(() => {
      expect(
        screen.queryByAltText('The cross after the scramble, as you will hold it'),
      ).not.toBeInTheDocument();
    });
    // The words are the fallback, so what the moves are performed on — a cube
    // whose cross is solved, not a solved cube — is still said somewhere.
    expect(screen.getByText(/The cross never leaves the bottom/)).toBeInTheDocument();
  });

  it('offers the other solutions of the same length', async () => {
    const user = userEvent.setup();
    await setSetting('trainer.drillSetId', 'cross');
    await setSetting('timer.inspectionEnabled', false);
    const { scramble, alternatives } = await shownWithAlternatives(user);

    for (const alternative of alternatives) {
      expect(isCrossSolvedAfter(scramble, '', alternative)).toBe(true);
    }
  });

  it('puts an alternative on the cube by tapping it', async () => {
    const user = userEvent.setup();
    await setSetting('trainer.drillSetId', 'cross');
    await setSetting('timer.inspectionEnabled', false);
    const { scramble, alternatives } = await shownWithAlternatives(user);

    const shown = () =>
      screen.getByRole('heading', { name: /Shortest cross/ }).parentElement
        ?.querySelector('.drill__moves')?.textContent?.trim() ?? '';
    const listed = () =>
      screen.getAllByRole('listitem').map((node) => node.textContent?.trim() ?? '');

    const first = shown();
    const [alternative] = alternatives;
    expect(alternative).toBeDefined();
    if (alternative === undefined) return;

    // Reading five moves is not the same as seeing them, so tapping one takes
    // the place of the solution above — which is what the cube performs.
    await user.click(screen.getByRole('button', { name: alternative }));

    expect(shown()).toBe(alternative);
    expect(listed()).toContain(first);
    // Still a shortest cross for the cube as it is held, not just a swap of text.
    expect(isCrossSolvedAfter(scramble, '', shown())).toBe(true);
  });

  it('rewrites the cross for the side you say is in front', async () => {
    const user = userEvent.setup();
    await setSetting('trainer.drillSetId', 'cross');
    await setSetting('timer.inspectionEnabled', false);
    render(<DrillScreen />);
    const scramble = await shownScramble();
    await user.click(screen.getByRole('button', { name: 'Show me' }));
    await screen.findByRole('heading', { name: /Shortest cross/ });

    await user.click(screen.getByRole('button', { name: 'Red' }));

    await waitFor(() => {
      const solution =
        screen.getByRole('heading', { name: /Shortest cross/ }).parentElement
          ?.querySelector('.drill__moves')?.textContent ?? '';
      // Red is the left of a cube held cross down, so it comes round the
      // other way, and the moves have to follow.
      expect(isCrossSolvedAfter(scramble, "y'", solution)).toBe(true);
    });
  });

  it('lets a dropped cube be judged or thrown away on the spot', async () => {
    const user = userEvent.setup();
    render(<DrillScreen />);
    await screen.findByText(CASE_SCRAMBLE);

    await attempt(user, 3210);
    await screen.findByRole('heading', { name: 'T' });

    // The judging buttons come with the stored attempt, a write after the answer.
    await user.click(await screen.findByRole('button', { name: '+2' }));
    await waitFor(async () => {
      expect((await db.solves.toCollection().first())?.penalty).toBe('plus2');
    });

    // Pressing it again clears it, the way every cubing timer behaves.
    await user.click(screen.getByRole('button', { name: '+2' }));
    await waitFor(async () => {
      expect((await db.solves.toCollection().first())?.penalty).toBe('none');
    });

    await user.click(screen.getByRole('button', { name: 'Delete' }));
    await waitFor(async () => {
      expect(await db.solves.count()).toBe(0);
    });
    // Gone means gone: the buttons go with it.
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
  });

  it('keeps the cross history where the cross is drilled', async () => {
    const user = userEvent.setup();
    await setSetting('trainer.drillSetId', 'cross');
    await setSetting('timer.inspectionEnabled', false);
    render(<DrillScreen />);
    await shownScramble();

    // Nothing drilled yet, nothing to offer.
    await openSetup(user);
    expect(screen.queryByRole('button', { name: /^Attempts/ })).not.toBeInTheDocument();
    await openSetup(user);

    await attempt(user, 8000);
    await user.click(screen.getByRole('button', { name: 'Next case' }));

    // The cross has no case sheet in the trainer, so its attempts have to be
    // reachable from here.
    await openSetup(user);
    await user.click(await screen.findByRole('button', { name: 'Attempts 1' }));
    // The panel says 8.00 three times over: last, best, and the attempt row
    // itself — which is the one with the buttons on it.
    expect(screen.getAllByText('8.00').length).toBeGreaterThan(1);

    await user.click(screen.getByRole('button', { name: 'Delete all' }));
    await user.click(screen.getByRole('button', { name: 'Delete them all?' }));

    await waitFor(async () => {
      expect(await db.solves.count()).toBe(0);
    });
  });

  it('judges a cross attempt on the spot as well', async () => {
    const user = userEvent.setup();
    await setSetting('trainer.drillSetId', 'cross');
    await setSetting('timer.inspectionEnabled', false);
    render(<DrillScreen />);
    await shownScramble();

    await attempt(user, 8000);
    await user.click(await screen.findByRole('button', { name: 'DNF' }));

    await waitFor(async () => {
      expect((await db.solves.toCollection().first())?.penalty).toBe('dnf');
    });
  });

  it('says how much of the set is being drilled without being opened', async () => {
    const user = userEvent.setup();
    render(<DrillScreen />);

    // The folded line has to answer it on its own, or folding it away would
    // hide what is being practised.
    expect(
      await screen.findByRole('button', { name: 'Change what is drilled: Full · 1 / 21' }),
    ).toBeInTheDocument();

    await openSetup(user);
    expect(screen.getByRole('button', { name: 'Cases 1 / 21' })).toBeInTheDocument();
  });
});
