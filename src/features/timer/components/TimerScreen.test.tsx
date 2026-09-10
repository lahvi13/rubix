import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../../../db/schema';
import { resetSheetHistory } from '../../../lib/sheet-history';
import { TimerScreen } from './TimerScreen';

// The real client spins up a module worker, which jsdom cannot run, and
// cubing/twisty is a custom element that needs a real browser.
vi.mock('../../../lib/scramble-client', () => ({
  requestScramble: () => Promise.resolve(SCRAMBLE),
}));
vi.mock('cubing/twisty', () => ({}));

const SCRAMBLE = "R U R' U' F2";

/**
 * The scramble is laid out one move per cell, so no single node holds the whole
 * of it; the paragraph around them does.
 */
function findScramble(): Promise<HTMLElement> {
  return screen.findByText(
    (_, element) =>
      element?.tagName === 'P' && element.textContent?.replace(/s+/g, ' ').trim() === SCRAMBLE,
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
    // The panels hold their entries in module state, which outlives a render.
    resetSheetHistory();
  });

  it('shows a scramble, a zeroed timer and an empty session', async () => {
    render(<TimerScreen />);

    expect(await findScramble()).toBeInTheDocument();
    expect(screen.getByRole('timer')).toHaveTextContent('0.00');
    expect(screen.getByText(/no solves yet/i)).toBeInTheDocument();
  });

  it('still reacts to the space bar when a button holds focus', async () => {
    const user = userEvent.setup();
    render(<TimerScreen />);
    await findScramble();

    // Tapping the nav or any control leaves focus on a button; the timer must
    // not go deaf because of it.
    screen.getByTitle('Switch session').focus();
    await user.keyboard('[Space>]');
    await user.keyboard('[/Space]');

    // Inspection is on by default, so a tap starts the countdown at 15.
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

  it('shows the result and reveals the next scramble only after confirmation', async () => {
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
    clock += 12_340;
    await user.keyboard('[Space>]');
    await user.keyboard('[/Space]');

    const next = await screen.findByRole('button', { name: 'Next scramble' });
    expect((await findScramble()).closest('.scramble')).toHaveClass(
      'scramble--hidden',
    );

    await user.click(next);
    expect((await findScramble()).closest('.scramble')).not.toHaveClass(
      'scramble--hidden',
    );
    expect(screen.queryByRole('button', { name: 'Next scramble' })).not.toBeInTheDocument();
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

  it('holds the list open through the scrolling that follows the first', async () => {
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
    Object.defineProperty(list, 'scrollTop', { value: 40, configurable: true });

    const back = vi.spyOn(window.history, 'back').mockImplementation(() => {});
    // Pulled up by a finger, so the entry waits for it to lift.
    await act(async () => {
      window.dispatchEvent(new Event('touchstart'));
    });
    fireEvent.scroll(list);
    await act(async () => {
      window.dispatchEvent(new Event('touchend'));
    });
    expect(container.querySelector('.screen--browsing')).not.toBeNull();

    // Every scroll from here on is the reader moving around inside a list that
    // is already up. Not one may let go of the entry it is holding: the pop
    // that follows closes it under them.
    await act(async () => {
      window.dispatchEvent(new Event('touchstart'));
    });
    for (let index = 0; index < 5; index += 1) fireEvent.scroll(list);
    await act(async () => {});
    expect(back).not.toHaveBeenCalled();
    expect(container.querySelector('.screen--browsing')).not.toBeNull();
    back.mockRestore();
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
});
