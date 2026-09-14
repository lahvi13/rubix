import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../../../db/schema';
import { getSetting } from '../../../db/repositories/settings-repository';
import { getOrCreateActiveSession } from '../../../db/repositories/session-repository';
import { addSolve } from '../../../db/repositories/solve-repository';
import type { InstallState } from '../../../lib/install';
import { strings } from '../../../lib/strings';
import { INSTALL_NUDGE_AFTER_SOLVES } from '../hooks/use-install-nudge';
import { InstallNudge } from './InstallNudge';

const install = vi.hoisted(() => ({ state: 'manual' as InstallState }));
vi.mock('../hooks/use-install', () => ({ useInstall: () => install.state }));

async function seedSolves(count: number) {
  const session = await getOrCreateActiveSession('333', 'freestyle');
  for (let index = 0; index < count; index += 1) {
    await addSolve({
      sessionId: session.id,
      puzzle: '333',
      mode: 'freestyle',
      scramble: "R U R' U'",
      rawMs: 20_000 + index,
      penalty: 'none',
      penaltySource: 'auto',
      inspectionMs: null,
      startedAt: Date.now(),
    });
  }
}

describe('InstallNudge', () => {
  beforeEach(async () => {
    await Promise.all(db.tables.map((table) => table.clear()));
    install.state = 'manual';
  });

  it('waits until the app is being used', async () => {
    await seedSolves(INSTALL_NUDGE_AFTER_SOLVES - 1);
    render(<InstallNudge />);

    // Give the count time to arrive, so the absence is not just "not yet".
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(screen.queryByText(strings.installNudge.message)).not.toBeInTheDocument();
  });

  it('asks on iOS once there are solves to lose, and stops when waved away', async () => {
    await seedSolves(INSTALL_NUDGE_AFTER_SOLVES);
    const user = userEvent.setup();
    render(<InstallNudge />);

    await user.click(await screen.findByRole('button', { name: strings.installNudge.dismiss }));

    await waitFor(() => {
      expect(screen.queryByText(strings.installNudge.message)).not.toBeInTheDocument();
    });
    expect(await getSetting('ui.installNudgeDismissed')).toBe(true);
  });

  it.each<InstallState>(['installed', 'prompt', 'none'])('says nothing where the state is %s', async (state) => {
    install.state = state;
    await seedSolves(INSTALL_NUDGE_AFTER_SOLVES);
    render(<InstallNudge />);

    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(screen.queryByText(strings.installNudge.message)).not.toBeInTheDocument();
  });
});
