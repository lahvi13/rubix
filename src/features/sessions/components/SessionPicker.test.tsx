import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../../../db/schema';
import {
  createSession,
  getActiveSession,
  getOrCreateActiveSession,
} from '../../../db/repositories/session-repository';
import { SessionPicker } from './SessionPicker';

describe('SessionPicker', () => {
  beforeEach(async () => {
    await Promise.all(db.tables.map((table) => table.clear()));
  });

  it('switches to the session that was picked and closes', async () => {
    const first = await getOrCreateActiveSession('333', 'freestyle');
    await createSession('Evening', '333', 'freestyle');
    const onClose = vi.fn();
    const user = userEvent.setup();

    render(<SessionPicker onClose={onClose} />);

    await user.click(await screen.findByRole('button', { name: /Default/ }));

    await waitFor(async () => {
      expect((await getActiveSession('333', 'freestyle'))?.id).toBe(first.id);
    });
    expect(onClose).toHaveBeenCalled();
  });

  it('marks the session being timed into as the current one', async () => {
    await getOrCreateActiveSession('333', 'freestyle');
    await createSession('Evening', '333', 'freestyle');

    render(<SessionPicker onClose={vi.fn()} />);

    const current = await screen.findByRole('button', { current: true });
    expect(current).toHaveTextContent('Evening');
  });

  it('creates a session, makes it active right away and closes', async () => {
    await getOrCreateActiveSession('333', 'freestyle');
    const onClose = vi.fn();
    const user = userEvent.setup();

    render(<SessionPicker onClose={onClose} />);
    await user.type(screen.getByLabelText('New session name'), 'One-handed');
    await user.click(screen.getByRole('button', { name: 'Create' }));

    await waitFor(async () => {
      expect((await getActiveSession('333', 'freestyle'))?.name).toBe('One-handed');
    });
    expect(onClose).toHaveBeenCalled();
  });
});
