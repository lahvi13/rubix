import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../../db/schema';
import {
  createSession,
  getActiveSession,
  getOrCreateActiveSession,
} from '../../../db/repositories/session-repository';
import { SessionsScreen } from './SessionsScreen';

describe('SessionsScreen', () => {
  beforeEach(async () => {
    await Promise.all(db.tables.map((table) => table.clear()));
  });

  it('offers an explicit switch on every session that is not active', async () => {
    const first = await getOrCreateActiveSession('333', 'freestyle');
    await createSession('Evening', '333', 'freestyle');
    const user = userEvent.setup();

    render(<SessionsScreen />);

    // Only the inactive session gets a Use button.
    const switches = await screen.findAllByRole('button', { name: 'Use' });
    expect(switches).toHaveLength(1);

    await user.click(switches[0]!);

    await waitFor(async () => {
      expect((await getActiveSession('333', 'freestyle'))?.id).toBe(first.id);
    });
  });

  it('creates a session and makes it active right away', async () => {
    await getOrCreateActiveSession('333', 'freestyle');
    const user = userEvent.setup();

    render(<SessionsScreen />);
    await user.type(screen.getByLabelText('New session name'), 'One-handed');
    await user.click(screen.getByRole('button', { name: 'Create' }));

    await waitFor(async () => {
      expect((await getActiveSession('333', 'freestyle'))?.name).toBe('One-handed');
    });
  });
});
