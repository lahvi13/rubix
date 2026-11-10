import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../../db/schema';
import { getSetting, setSetting } from '../../../db/repositories/settings-repository';
import { getOrCreateActiveSession } from '../../../db/repositories/session-repository';
import { addSolve } from '../../../db/repositories/solve-repository';
import type { SupportedPuzzle } from '../../../domain/puzzle/puzzles';
import { useWelcome } from '../hooks/use-welcome';
import { WelcomeCard } from './WelcomeCard';

async function addOneSolve(): Promise<void> {
  const session = await getOrCreateActiveSession('333', 'freestyle');
  await addSolve({
    sessionId: session.id,
    puzzle: '333',
    mode: 'freestyle',
    scramble: "R U R' U'",
    rawMs: 12_340,
    penalty: 'none',
    penaltySource: 'auto',
    inspectionMs: null,
    startedAt: Date.now(),
  });
}

/** The card as the timer shows it: there while the question stands. */
function Welcome({ puzzle = '333' }: { puzzle?: SupportedPuzzle }) {
  const welcome = useWelcome(puzzle);
  return welcome.isShown ? <WelcomeCard onLearn={welcome.learn} onSolve={welcome.solve} /> : null;
}

const question = () => screen.queryByRole('group', { name: 'Can you solve the cube?' });

describe('the question a new install asks', () => {
  beforeEach(async () => {
    await Promise.all(db.tables.map((table) => table.clear()));
    window.location.hash = '#/timer';
  });

  it('takes a beginner to the guide and keeps it on the bar', async () => {
    const user = userEvent.setup();
    // Put away once already, as it is for somebody asking the question again.
    await setSetting('ui.showLearn', false);
    render(<Welcome />);

    await user.click(await screen.findByRole('button', { name: 'Not yet, teach me' }));

    await waitFor(async () => {
      expect(await getSetting('ui.welcome')).toBe('asked');
    });
    expect(await getSetting('ui.showLearn')).toBe(true);
    expect(window.location.hash).toBe('#/learn');
    await waitFor(() => expect(question()).not.toBeInTheDocument());
  });

  it('leaves a solver on the timer, with the guide off the bar and nothing else touched', async () => {
    const user = userEvent.setup();
    render(<Welcome />);

    await user.click(await screen.findByRole('button', { name: 'Yes, time my solves' }));

    await waitFor(async () => {
      expect(await getSetting('ui.welcome')).toBe('asked');
    });
    expect(await getSetting('ui.showLearn')).toBe(false);
    expect(window.location.hash).toBe('#/timer');
    // The session is timed in what it was timed in, and the trainer opens
    // where it would have: the answer is not a choice of method.
    expect((await getOrCreateActiveSession('333', 'freestyle')).methodId).toBe('cfop');
    expect(await db.settings.get('trainer.setId')).toBeUndefined();
    await waitFor(() => expect(question()).not.toBeInTheDocument());
  });

  it("asks about the cube the timer is on, and sets that cube's guide", async () => {
    const user = userEvent.setup();
    render(<Welcome puzzle="222" />);

    await user.click(await screen.findByRole('button', { name: 'Yes, time my solves' }));

    await waitFor(async () => {
      expect(await getSetting('ui.showLearn.222')).toBe(false);
    });
    expect(await getSetting('ui.showLearn')).toBe(true);
  });

  it('goes unasked once there is a solve: the solve was the answer', async () => {
    render(<Welcome />);
    expect(await screen.findByRole('group', { name: 'Can you solve the cube?' })).toBeInTheDocument();

    await addOneSolve();

    await waitFor(() => expect(question()).not.toBeInTheDocument());
    // Nothing was decided for them: the guide is where it was.
    expect(await getSetting('ui.showLearn')).toBe(true);
  });

  it('is not asked on a device that already has solves', async () => {
    await addOneSolve();
    render(<Welcome />);
    // Long enough for the count to answer, which is what it waits for.
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(question()).not.toBeInTheDocument();
  });

  it('is asked again when Settings says so, solves or not', async () => {
    await addOneSolve();
    await setSetting('ui.welcome', 'again');
    render(<Welcome />);
    expect(await screen.findByRole('group', { name: 'Can you solve the cube?' })).toBeInTheDocument();
  });
});
