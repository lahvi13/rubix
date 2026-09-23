import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../../../db/schema';
import { setSetting } from '../../../db/repositories/settings-repository';
import { getOrCreateActiveSession } from '../../../db/repositories/session-repository';
import { addSolve } from '../../../db/repositories/solve-repository';
import { resetSheetHistory } from '../../../lib/sheet-history';
import { unpinScramble } from '../../../hooks/use-pinned-scramble';
import { TimerScreen } from './TimerScreen';

// The real client spins up a module worker, which jsdom cannot run, and
// cubing/twisty is a custom element that needs a real browser.
vi.mock('../../../lib/scramble-client', () => ({
  requestScramble: () => scrambles(),
}));
vi.mock('cubing/twisty', () => ({}));

const SCRAMBLE = "R U R' U' F2";
const NEXT_SCRAMBLE = "D2 B L' F2";
let scrambles: () => Promise<string>;

/**
 * The scramble is laid out one move per cell, so no single node holds the whole
 * of it; the paragraph around them does.
 */
function findScramble(text = SCRAMBLE): Promise<HTMLElement> {
  return screen.findByText(
    (_, element) =>
      element?.classList.contains('scramble__moves') === true &&
      element.textContent?.replace(/\s+/g, ' ').trim() === text,
  );
}

/** The phase toggle needs a method to take its phases from. */
async function seedCfop(): Promise<void> {
  await db.methods.put({
    id: 'cfop',
    name: 'CFOP',
    puzzle: '333',
    phases: [
      { key: 'cross', label: 'Cross', order: 0 },
      { key: 'f2l', label: 'F2L', order: 1 },
      { key: 'oll', label: 'OLL', order: 2 },
      { key: 'pll', label: 'PLL', order: 3 },
    ],
    createdAt: 0,
    updatedAt: 0,
  });
}

/** A whole attempt on the keyboard: tap to inspect, hold to start, tap to stop. */
async function keyboardSolve(
  user: ReturnType<typeof userEvent.setup>,
  tick: (ms: number) => void,
  solveMs: number,
): Promise<void> {
  await user.keyboard('[Space>]');
  tick(50);
  await user.keyboard('[/Space]');
  tick(3000);
  await user.keyboard('[Space>]');
  tick(400);
  await user.keyboard('[/Space]');
  tick(solveMs);
  await user.keyboard('[Space>]');
  await user.keyboard('[/Space]');
}

describe('TimerScreen', () => {
  beforeEach(async () => {
    await Promise.all(db.tables.map((table) => table.clear()));
    scrambles = () => Promise.resolve(SCRAMBLE);
    // The panels hold their entries in module state, which outlives a render.
    resetSheetHistory();
    // So does a scramble chosen for the next solve.
    unpinScramble();
  });

  it('shows a scramble, a zeroed timer and an empty session', async () => {
    render(<TimerScreen />);

    expect(await findScramble()).toBeInTheDocument();
    expect(screen.getByRole('timer')).toHaveTextContent('0.00');
    expect(screen.getByText(/no solves yet/i)).toBeInTheDocument();
  });

  it('still reacts to the space bar when a button holds focus', async () => {
    const user = userEvent.setup();
    // The countdown is what proves the key arrived, so it has to be switched on.
    await setSetting('timer.inspectionEnabled', true);
    render(<TimerScreen />);
    await findScramble();

    // Tapping the nav or any control leaves focus on a button; the timer must
    // not go deaf because of it.
    screen.getByTitle('Switch session').focus();
    await user.keyboard('[Space>]');
    await user.keyboard('[/Space]');

    expect(await screen.findByText('15')).toBeInTheDocument();
  });

  it('stores a solve after a full attempt', async () => {
    const user = userEvent.setup();
    let clock = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => clock);

    render(<TimerScreen />);
    await findScramble();

    // Tap to start inspection.
    await user.keyboard('[Space>]');
    clock += 50;
    await user.keyboard('[/Space]');

    // Hold past the threshold, then release to start the solve.
    clock += 8000;
    await user.keyboard('[Space>]');
    clock += 400;
    await user.keyboard('[/Space]');

    // Solve for 12.34s, then press to stop.
    clock += 12_340;
    await user.keyboard('[Space>]');

    await waitFor(async () => {
      expect(await db.solves.count()).toBe(1);
    });
    const solve = await db.solves.toCollection().first();
    expect(solve?.rawMs).toBe(12_340);
  });

  it('stops a running solve on any key, not just space', async () => {
    const user = userEvent.setup();
    let clock = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => clock);

    render(<TimerScreen />);
    await findScramble();

    await user.keyboard('[Space>]');
    clock += 50;
    await user.keyboard('[/Space]');
    clock += 3000;
    await user.keyboard('[Space>]');
    clock += 400;
    await user.keyboard('[/Space]');

    clock += 9990;
    await user.keyboard('[KeyK>]');
    await user.keyboard('[/KeyK]');

    await waitFor(async () => {
      expect(await db.solves.count()).toBe(1);
    });
    expect((await db.solves.toCollection().first())?.rawMs).toBe(9990);
  });

  it('shows the result and the next scramble together, without being asked', async () => {
    const user = userEvent.setup();
    let clock = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => clock);
    let served = 0;
    scrambles = () => Promise.resolve(served++ === 0 ? SCRAMBLE : NEXT_SCRAMBLE);

    render(<TimerScreen />);
    await findScramble();

    await user.keyboard('[Space>]');
    clock += 50;
    await user.keyboard('[/Space]');
    clock += 3000;
    await user.keyboard('[Space>]');
    clock += 400;
    await user.keyboard('[/Space]');
    clock += 12_340;
    await user.keyboard('[Space>]');
    await user.keyboard('[/Space]');

    const next = await findScramble(NEXT_SCRAMBLE);
    expect(next.closest('.scramble')).not.toHaveClass('scramble--hidden');
    expect(screen.getByRole('timer')).toHaveTextContent('12.34');
    expect(screen.queryByRole('button', { name: 'Next scramble' })).not.toBeInTheDocument();
  });

  it.each([
    ['hidden', 'Solving'],
    ['tenths', '4.5'],
    ['seconds', '4'],
  ] as const)('shows the running time as %s, and the stopped one in full', async (...row) => {
    const [display, running] = row;
    await setSetting('timer.runningDisplay', display);
    const user = userEvent.setup();
    let clock = 0;
    const tick = (ms: number) => (clock += ms);
    vi.spyOn(performance, 'now').mockImplementation(() => clock);

    render(<TimerScreen />);
    await findScramble();
    await user.keyboard('[Space>]');
    tick(50);
    await user.keyboard('[/Space]');
    tick(3000);
    await user.keyboard('[Space>]');
    tick(400);
    await user.keyboard('[/Space]');

    tick(4567);
    const shown = new RegExp(`^${running}$`);
    await waitFor(() => expect(screen.getByRole('timer')).toHaveTextContent(shown));

    await user.keyboard('[Space>]');
    await user.keyboard('[/Space]');
    await waitFor(() => expect(screen.getByRole('timer')).toHaveTextContent('4.56'));
  });

  it('hides the phase times as well when the running time is hidden', async () => {
    await seedCfop();
    await setSetting('timer.runningDisplay', 'hidden');
    await setSetting('timer.splitMode', 'phases');
    const user = userEvent.setup();
    let clock = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => clock);

    const { container } = render(<TimerScreen />);
    await findScramble();
    await user.keyboard('[Space>]');
    clock += 50;
    await user.keyboard('[/Space]');
    clock += 3000;
    await user.keyboard('[Space>]');
    clock += 400;
    await user.keyboard('[/Space]');

    // Cross over, F2L under way: both would carry a time with the clock shown.
    clock += 2500;
    await user.keyboard('[Space>]');
    await user.keyboard('[/Space]');
    clock += 1500;
    expect(await screen.findByText('F2L')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('timer')).toHaveTextContent('Solving'));
    expect(container.querySelector('.phase-run')?.textContent).not.toMatch(/d/);
  });

  it('times a solve phase by phase, and the last tap stops the clock', async () => {
    await seedCfop();
    const user = userEvent.setup();
    let clock = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => clock);

    render(<TimerScreen />);
    await findScramble();
    const phaseToggle = await screen.findByRole('checkbox', { name: 'Phases' });
    // The toggle stays disabled until the method's phases have been read.
    await waitFor(() => expect(phaseToggle).toBeEnabled());
    await user.click(phaseToggle);

    // Tap to inspect, hold to start.
    await user.keyboard('[Space>]');
    clock += 50;
    await user.keyboard('[/Space]');
    clock += 3000;
    await user.keyboard('[Space>]');
    clock += 400;
    await user.keyboard('[/Space]');

    expect(await screen.findByText('Cross')).toBeInTheDocument();

    // Cross, F2L and OLL end on a tap; the fourth tap ends PLL and the solve.
    for (const phaseMs of [2000, 8000, 4000, 6000]) {
      clock += phaseMs;
      await user.keyboard('[Space>]');
      await user.keyboard('[/Space]');
    }

    await waitFor(async () => {
      expect(await db.solves.count()).toBe(1);
    });
    const solve = await db.solves.toCollection().first();
    expect(solve?.rawMs).toBe(20_000);
    expect(solve?.splits).toEqual([
      { phase: 'cross', atMs: 2000, source: 'manual' },
      { phase: 'f2l', atMs: 10_000, source: 'manual' },
      { phase: 'oll', atMs: 14_000, source: 'manual' },
    ]);
  });

  it('finishes a phase solve early when the tap is held', async () => {
    await seedCfop();
    const user = userEvent.setup();
    let clock = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => clock);

    render(<TimerScreen />);
    await findScramble();
    const phaseToggle = await screen.findByRole('checkbox', { name: 'Phases' });
    // The toggle stays disabled until the method's phases have been read.
    await waitFor(() => expect(phaseToggle).toBeEnabled());
    await user.click(phaseToggle);

    await user.keyboard('[Space>]');
    clock += 50;
    await user.keyboard('[/Space]');
    clock += 3000;
    await user.keyboard('[Space>]');
    clock += 400;
    await user.keyboard('[/Space]');

    clock += 2000;
    await user.keyboard('[Space>]');
    await user.keyboard('[/Space]');

    // The cube was done during F2L: hold instead of tapping through OLL and PLL.
    clock += 7000;
    await user.keyboard('[Space>]');
    clock += 400;
    await user.keyboard('[/Space]');

    await waitFor(async () => {
      expect(await db.solves.count()).toBe(1);
    });
    const solve = await db.solves.toCollection().first();
    // The time comes from the press, so holding it costs nothing.
    expect(solve?.rawMs).toBe(9000);
    expect(solve?.splits).toEqual([{ phase: 'cross', atMs: 2000, source: 'manual' }]);
  });

  it('ends a phase on any key, the same way any key stops a plain solve', async () => {
    await seedCfop();
    const user = userEvent.setup();
    let clock = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => clock);

    render(<TimerScreen />);
    await findScramble();
    const phaseToggle = await screen.findByRole('checkbox', { name: 'Phases' });
    await waitFor(() => expect(phaseToggle).toBeEnabled());
    await user.click(phaseToggle);

    await user.keyboard('[Space>]');
    clock += 50;
    await user.keyboard('[/Space]');
    clock += 3000;
    await user.keyboard('[Space>]');
    clock += 400;
    await user.keyboard('[/Space]');

    // Mid-solve nobody aims for a particular key (SPEC 3.1), so a phase has to
    // end on whatever was hit — and the machine must not stay parked waiting
    // for a release it filtered out.
    clock += 2000;
    await user.keyboard('[KeyK>]');
    clock += 40;
    await user.keyboard('[/KeyK]');

    expect(await screen.findByText('F2L')).toBeInTheDocument();

    clock += 7000;
    await user.keyboard('[KeyJ>]');
    clock += 40;
    await user.keyboard('[/KeyJ]');

    expect(await screen.findByText('OLL')).toBeInTheDocument();
  });

  it('keeps the tap that stopped the clock from reaching what was under it', async () => {
    const user = userEvent.setup();
    let clock = 0;
    const tick = (ms: number) => (clock += ms);
    vi.spyOn(performance, 'now').mockImplementation(() => clock);
    // The attempt below is the one that starts with a tap to inspect.
    await setSetting('timer.inspectionEnabled', true);

    const { container } = render(<TimerScreen />);
    await findScramble();

    // A solve in the list, so the press surface has a DNF button under it.
    await keyboardSolve(user, tick, 5000);
    await waitFor(async () => {
      expect(await db.solves.count()).toBe(1);
    });

    // The next attempt on the glass: tap to inspect, hold to start, tap to stop.
    const surface = container.querySelector('.timer');
    if (surface === null) throw new Error('the clock never appeared');
    await user.pointer([
      { keys: '[TouchA>]', target: surface },
      { keys: '[/TouchA]', target: surface },
    ]);
    const overlay = container.querySelector('.timer-overlay');
    if (overlay === null) throw new Error('the press surface never appeared');
    tick(3000);
    await user.pointer({ keys: '[TouchA>]', target: overlay });
    tick(400);
    await user.pointer({ keys: '[/TouchA]', target: overlay });
    tick(7000);
    await user.pointer([
      { keys: '[TouchA>]', target: overlay },
      { keys: '[/TouchA]', target: overlay },
    ]);

    await waitFor(async () => {
      expect(await db.solves.count()).toBe(2);
    });

    // The click the tap leaves behind is dispatched once the surface is gone,
    // and lands on whatever the timer was covering.
    const dnf = await screen.findByRole('button', { name: 'DNF' });
    await act(async () => {
      dnf.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });
    expect((await db.solves.orderBy('createdAt').last())?.penalty).toBe('none');

    // Only that one click, though — the button still works when aimed at.
    await user.click(dnf);
    await waitFor(async () => {
      expect((await db.solves.orderBy('createdAt').last())?.penalty).toBe('dnf');
    });
  });

  it('starts only once both hands are off the glass', async () => {
    let clock = 0;
    const tick = (ms: number) => (clock += ms);
    vi.spyOn(performance, 'now').mockImplementation(() => clock);
    // The events below fire faster than any hand, so the session has to be
    // there before the first of them rather than a query after it.
    await getOrCreateActiveSession('333', 'freestyle');
    const { container } = render(<TimerScreen />);
    await findScramble();
    await screen.findByText(/no solves yet/i);
    const surface = container.querySelector('.timer');
    if (surface === null) throw new Error('the clock never appeared');

    fireEvent.pointerDown(surface, { pointerId: 1, pointerType: 'touch' });
    fireEvent.pointerDown(surface, { pointerId: 2, pointerType: 'touch' });
    tick(400);
    fireEvent.pointerUp(surface, { pointerId: 1, pointerType: 'touch' });
    tick(5000);
    // Still being held by the other hand: the solve starts here, not above.
    fireEvent.pointerUp(surface, { pointerId: 2, pointerType: 'touch' });
    tick(3000);
    const overlay = await waitFor(() => {
      const node = container.querySelector('.timer-overlay');
      if (node === null) throw new Error('the clock is not running');
      return node;
    });
    fireEvent.pointerDown(overlay, { pointerId: 3, pointerType: 'touch' });
    fireEvent.pointerUp(overlay, { pointerId: 3, pointerType: 'touch' });

    await waitFor(async () => {
      expect((await db.solves.toCollection().first())?.rawMs).toBe(3000);
    });
  });

  it('forgets a hold the phone took away, so a later tap starts nothing', async () => {
    let clock = 0;
    const tick = (ms: number) => (clock += ms);
    vi.spyOn(performance, 'now').mockImplementation(() => clock);
    const { container } = render(<TimerScreen />);
    await findScramble();
    const surface = container.querySelector('.timer');
    if (surface === null) throw new Error('the clock never appeared');

    fireEvent.pointerDown(surface, { pointerId: 1, pointerType: 'touch' });
    tick(500);
    // A system gesture claims the finger; no pointerup ever comes.
    fireEvent.pointerCancel(surface, { pointerId: 1, pointerType: 'touch' });
    tick(10_000);
    fireEvent.pointerDown(surface, { pointerId: 2, pointerType: 'touch' });
    tick(20);
    fireEvent.pointerUp(surface, { pointerId: 2, pointerType: 'touch' });

    await waitFor(() => expect(container.querySelector('.timer-overlay')).toBeNull());
    expect(screen.getByRole('timer')).not.toHaveTextContent(/[1-9]/);
  });

  it('pulls the list up on a drag, and never on a scroll', async () => {
    const user = userEvent.setup();
    let clock = 0;
    const tick = (ms: number) => (clock += ms);
    vi.spyOn(performance, 'now').mockImplementation(() => clock);

    const { container } = render(<TimerScreen />);
    await findScramble();
    await keyboardSolve(user, tick, 5000);
    await waitFor(async () => {
      expect(await db.solves.count()).toBe(1);
    });

    const list = container.querySelector('.solves');
    if (list === null) throw new Error('the list of solves never appeared');
    const browsing = () => container.querySelector('.screen--browsing');

    /*
     * A scroll must not open it. The list does not scroll while it is down,
     * and a gesture the browser has claimed grants no user activation — the
     * back entry the panel would push is one Chrome skips over, which is a
     * back press spent leaving the app.
     */
    fireEvent.scroll(list);
    await act(async () => {});
    expect(browsing()).toBeNull();

    // Short of the threshold the reader was aiming at a row, not pulling.
    fireEvent.pointerDown(list, { clientX: 200, clientY: 700 });
    fireEvent.pointerUp(list, { clientX: 200, clientY: 680 });
    await act(async () => {});
    expect(browsing()).toBeNull();

    fireEvent.pointerDown(list, { clientX: 200, clientY: 700 });
    fireEvent.pointerUp(list, { clientX: 200, clientY: 540 });
    await waitFor(() => expect(browsing()).not.toBeNull());

    // And back puts it away, which is the whole reason the gesture is a drag.
    await act(async () => {
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    expect(browsing()).toBeNull();
  });

  it('takes two taps to delete the last solve', async () => {
    const user = userEvent.setup();
    let clock = 0;
    const tick = (ms: number) => (clock += ms);
    vi.spyOn(performance, 'now').mockImplementation(() => clock);

    render(<TimerScreen />);
    await findScramble();
    await keyboardSolve(user, tick, 5000);
    await waitFor(async () => {
      expect(await db.solves.count()).toBe(1);
    });

    // +2 and DNF are the neighbours this button is protected from.
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    expect(await db.solves.count()).toBe(1);

    const armed = await screen.findByRole('button', { name: /tap again/i });
    await user.click(armed);
    await waitFor(async () => {
      expect(await db.solves.count()).toBe(0);
    });
  });

  it('disarms the delete when another action is taken instead', async () => {
    const user = userEvent.setup();
    let clock = 0;
    const tick = (ms: number) => (clock += ms);
    vi.spyOn(performance, 'now').mockImplementation(() => clock);

    render(<TimerScreen />);
    await findScramble();
    await keyboardSolve(user, tick, 5000);
    await waitFor(async () => {
      expect(await db.solves.count()).toBe(1);
    });

    await user.click(screen.getByRole('button', { name: 'Delete' }));
    await user.click(screen.getByRole('button', { name: '+2' }));

    // Back to asking, not to deleting: the next tap must not be the second one.
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
    expect(await db.solves.count()).toBe(1);
  });

  it('says what the finished time was worth, biggest record first', async () => {
    const user = userEvent.setup();
    let clock = 0;
    const tick = (ms: number) => (clock += ms);
    vi.spyOn(performance, 'now').mockImplementation(() => clock);

    render(<TimerScreen />);
    await findScramble();

    // The first solve of an empty database is the best there has ever been.
    await keyboardSolve(user, tick, 12_340);
    expect(await screen.findByText('Personal best')).toBeInTheDocument();

    await keyboardSolve(user, tick, 20_000);
    await waitFor(async () => {
      expect(await db.solves.count()).toBe(2);
    });
    expect(screen.queryByText('Personal best')).not.toBeInTheDocument();
    expect(screen.queryByText('Session best')).not.toBeInTheDocument();
  });

  it('names the phase a slower solve turned out to hold', async () => {
    await seedCfop();
    const user = userEvent.setup();
    let clock = 0;
    const tick = (ms: number) => (clock += ms);
    vi.spyOn(performance, 'now').mockImplementation(() => clock);

    render(<TimerScreen />);
    await findScramble();
    const phaseToggle = await screen.findByRole('checkbox', { name: 'Phases' });
    await waitFor(() => expect(phaseToggle).toBeEnabled());
    await user.click(phaseToggle);

    /** An attempt tapped through its phases, ending on the last one. */
    async function phaseSolve(phaseMs: number[]): Promise<void> {
      await user.keyboard('[Space>]');
      tick(50);
      await user.keyboard('[/Space]');
      tick(3000);
      await user.keyboard('[Space>]');
      tick(400);
      await user.keyboard('[/Space]');
      for (const ms of phaseMs) {
        tick(ms);
        await user.keyboard('[Space>]');
        await user.keyboard('[/Space]');
      }
    }

    await phaseSolve([2000, 8000, 4000, 6000]);
    await waitFor(async () => {
      expect(await db.solves.count()).toBe(1);
    });

    // Slower overall, so neither record is its — but nobody has ever crossed
    // faster, and that is the thing worth saying.
    await phaseSolve([1500, 9000, 5000, 7000]);
    await waitFor(async () => {
      expect(await db.solves.count()).toBe(2);
    });
    expect(await screen.findByText('Best Cross')).toBeInTheDocument();
  });

  it('puts the attempt switches away while the list is up over the cube', async () => {
    const user = userEvent.setup();
    render(<TimerScreen />);
    await findScramble();
    expect(screen.getByRole('checkbox', { name: 'Inspection' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'More solves' }));
    expect(screen.queryByRole('checkbox', { name: 'Inspection' })).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: 'Phases' })).not.toBeInTheDocument();

    // The chevron, not the grip: with the list up, both put it away.
    await user.click(screen.getByRole('button', { name: 'Back to the timer', expanded: true }));
    expect(screen.getByRole('checkbox', { name: 'Inspection' })).toBeInTheDocument();
  });

  it('puts the list down when an attempt finishes under it', async () => {
    const user = userEvent.setup();
    let clock = 0;
    const tick = (ms: number) => (clock += ms);
    vi.spyOn(performance, 'now').mockImplementation(() => clock);

    const { container } = render(<TimerScreen />);
    await findScramble();
    await user.click(screen.getByRole('button', { name: 'More solves' }));
    expect(container.querySelector('.screen--browsing')).not.toBeNull();

    // The space bar reaches the timer from anywhere, list up or not.
    await keyboardSolve(user, tick, 9990);
    await waitFor(async () => {
      expect(await db.solves.count()).toBe(1);
    });

    // The finished time is what there is to look at now, not the list.
    expect(container.querySelector('.screen--browsing')).toBeNull();
    expect(screen.getByRole('timer')).toHaveTextContent('9.99');
  });

  it('leaves the list where it was when an attempt is abandoned', async () => {
    const user = userEvent.setup();
    let clock = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => clock);

    const { container } = render(<TimerScreen />);
    await findScramble();
    await user.click(screen.getByRole('button', { name: 'More solves' }));

    await user.keyboard('[Space>]');
    clock += 50;
    await user.keyboard('[/Space]');
    await user.keyboard('{Escape}');

    // Nothing was timed, so nothing has taken the reader off what they were on.
    await waitFor(() => expect(container.querySelector('.screen--browsing')).not.toBeNull());
    expect(await db.solves.count()).toBe(0);
  });

  it('slides the list over the screen, and drops it into its slot only once it is down', async () => {
    // jsdom has no Web Animations; a slide here is one that finishes when told.
    const slides: { finish: () => void }[] = [];
    Object.defineProperty(HTMLElement.prototype, 'animate', {
      configurable: true,
      value: () => {
        let finish = () => {};
        const finished = new Promise<void>((resolve) => (finish = resolve));
        slides.push({ finish });
        return { finished, cancel: () => {} };
      },
    });

    try {
      const user = userEvent.setup();
      const { container } = render(<TimerScreen />);
      await findScramble();
      const panel = () => container.querySelector('.solves-panel');

      await user.click(screen.getByRole('button', { name: 'More solves' }));
      expect(panel()).toHaveClass('is-sheet');
      expect(slides).toHaveLength(1);

      await user.click(screen.getByRole('button', { name: 'Back to the timer', expanded: true }));
      // Closed as far as the screen is concerned — but still over it, on its way
      // down. Dropped now, it would be a peek sliding from the top, with the
      // clock showing beneath it for the length of the slide.
      expect(container.querySelector('.screen--browsing')).toBeNull();
      expect(panel()).toHaveClass('is-sheet');
      expect(slides).toHaveLength(2);

      await act(async () => slides[1]?.finish());
      expect(panel()).not.toHaveClass('is-sheet');
    } finally {
      Reflect.deleteProperty(HTMLElement.prototype, 'animate');
    }
  });

  it('says a finished time beat the goal, but never over a record', async () => {
    await setSetting('stats.goalMs', 15_000);
    const user = userEvent.setup();
    let clock = 0;
    const tick = (ms: number) => (clock += ms);
    vi.spyOn(performance, 'now').mockImplementation(() => clock);

    render(<TimerScreen />);
    await findScramble();

    // Under the goal as well, but a personal best is the thing that happened.
    await keyboardSolve(user, tick, 12_000);
    expect(await screen.findByText('Personal best')).toBeInTheDocument();
    expect(screen.queryByText(/^Sub /)).not.toBeInTheDocument();

    await keyboardSolve(user, tick, 14_000);
    expect(await screen.findByText('Sub 15')).toBeInTheDocument();

    await keyboardSolve(user, tick, 16_000);
    await waitFor(async () => {
      expect(await db.solves.count()).toBe(3);
    });
    expect(screen.queryByText('Sub 15')).not.toBeInTheDocument();
  });

  it('counts and numbers the whole session, not only the fifty solves it lists', async () => {
    const session = await getOrCreateActiveSession('333', 'freestyle');
    for (let index = 0; index < 51; index++) {
      await addSolve({
        sessionId: session.id,
        puzzle: '333',
        mode: 'freestyle',
        scramble: SCRAMBLE,
        rawMs: 20_000 + index,
        penalty: 'none',
        penaltySource: 'auto',
        inspectionMs: null,
        startedAt: index,
      });
    }

    render(<TimerScreen />);

    const title = (await screen.findByTitle('Switch session')).closest('h2');
    await waitFor(() => expect(title).toHaveTextContent('· 51'));
    expect(screen.getByText('51.')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(50);
  });

  it('creates the default session on first render', async () => {
    render(<TimerScreen />);

    await waitFor(async () => {
      expect(await db.sessions.count()).toBe(1);
    });
    const session = await db.sessions.toCollection().first();
    expect(session?.puzzle).toBe('333');
    expect(session?.isActive).toBe(1);
  });

  describe('a scramble of your own', () => {
    const OWN = "F R U' R' U' R U R' F'";

    async function chooseOwn(user: ReturnType<typeof userEvent.setup>, text: string) {
      await user.click(await screen.findByRole('button', { name: /^Change the scramble/ }));
      const field = screen.getByRole('textbox', { name: 'Scramble to solve' });
      await user.clear(field);
      await user.type(field, text);
    }

    it('is timed on the scramble typed in, once, and then the random ones come back', async () => {
      const user = userEvent.setup();
      let clock = 0;
      const tick = (ms: number) => (clock += ms);
      vi.spyOn(performance, 'now').mockImplementation(() => clock);
      render(<TimerScreen />);
      await findScramble();

      await chooseOwn(user, OWN);
      await user.click(screen.getByRole('button', { name: 'Use it' }));

      expect(await findScramble(OWN)).toBeInTheDocument();
      expect(screen.getByText('Your own scramble')).toBeInTheDocument();

      await keyboardSolve(user, tick, 7000);
      await waitFor(async () => {
        expect((await db.solves.toCollection().first())?.scramble).toBe(OWN);
      });
      // The generated one was never shown in between, so it is the one back.
      expect(await findScramble(SCRAMBLE)).toBeInTheDocument();
      expect(screen.queryByText('Your own scramble')).toBeNull();
    });

    it('will not take what is not a scramble', async () => {
      const user = userEvent.setup();
      render(<TimerScreen />);
      await findScramble();

      await chooseOwn(user, 'R U X Q');

      expect(screen.getByText(/Not a scramble/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Use it' })).toBeDisabled();
    });

    it('can be put back for a random one before it is solved', async () => {
      const user = userEvent.setup();
      render(<TimerScreen />);
      await findScramble();

      await chooseOwn(user, OWN);
      await user.click(screen.getByRole('button', { name: 'Use it' }));
      await user.click(await screen.findByRole('button', { name: 'Back to a random scramble' }));

      expect(await findScramble(SCRAMBLE)).toBeInTheDocument();
    });

    it('skips to a fresh random scramble from the same panel', async () => {
      const user = userEvent.setup();
      let served = 0;
      scrambles = () => Promise.resolve(served++ === 0 ? SCRAMBLE : NEXT_SCRAMBLE);
      render(<TimerScreen />);
      await findScramble();

      await user.click(screen.getByRole('button', { name: /^Change the scramble/ }));
      await user.click(screen.getByRole('button', { name: 'New scramble' }));

      expect(await findScramble(NEXT_SCRAMBLE)).toBeInTheDocument();
    });

    it('takes a solve from the list back to the timer to solve again', async () => {
      const user = userEvent.setup();
      const session = await getOrCreateActiveSession('333', 'freestyle');
      await addSolve({
        sessionId: session.id,
        puzzle: '333',
        mode: 'freestyle',
        scramble: OWN,
        rawMs: 9000,
        penalty: 'none',
        penaltySource: 'auto',
        inspectionMs: null,
        startedAt: 1,
      });
      render(<TimerScreen />);
      await findScramble();

      await user.click(await screen.findByRole('button', { name: /9\.00/ }));
      await user.click(await screen.findByRole('button', { name: 'Solve this scramble again' }));

      expect(await findScramble(OWN)).toBeInTheDocument();
      expect(screen.getByText('Scramble from the history')).toBeInTheDocument();
      expect(screen.queryByRole('dialog')).toBeNull();
    });
  });
});
