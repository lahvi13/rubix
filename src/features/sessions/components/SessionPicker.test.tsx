import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../../../db/schema';
import {
  activateSession,
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
  describe('renaming', () => {
    it('renames on Enter', async () => {
      await getOrCreateActiveSession('333', 'freestyle');
      const user = userEvent.setup();

      render(<SessionPicker onClose={vi.fn()} />);
      await user.click(await screen.findByRole('button', { name: 'Rename' }));
      await user.clear(screen.getByRole('textbox', { name: 'Rename' }));
      await user.type(screen.getByRole('textbox', { name: 'Rename' }), 'Morning{Enter}');

      await waitFor(async () => {
        expect((await getActiveSession('333', 'freestyle'))?.name).toBe('Morning');
      });
    });

    it('takes Escape back to the name as it was, and keeps the picker open', async () => {
      await getOrCreateActiveSession('333', 'freestyle');
      const onClose = vi.fn();
      const user = userEvent.setup();

      render(<SessionPicker onClose={onClose} />);
      await user.click(await screen.findByRole('button', { name: 'Rename' }));
      await user.type(screen.getByRole('textbox', { name: 'Rename' }), ' typo{Escape}');

      expect(screen.queryByRole('textbox', { name: 'Rename' })).not.toBeInTheDocument();
      expect(onClose).not.toHaveBeenCalled();
      expect((await getActiveSession('333', 'freestyle'))?.name).toBe('Default');
    });
  });

  describe('choosing a destination', () => {
    it('hands the choice back and leaves the active session alone', async () => {
      const active = await getOrCreateActiveSession('333', 'freestyle');
      const other = await createSession('Evening', '333', 'freestyle');
      // createSession activates what it creates; the source is the active one.
      await activateSession(active.id);
      const onPick = vi.fn();
      const user = userEvent.setup();

      render(<SessionPicker onPick={onPick} onClose={vi.fn()} />);

      await user.click(await screen.findByRole('button', { name: /Evening/ }));

      expect(onPick).toHaveBeenCalledWith(other.id, 'Evening');
      expect((await getActiveSession('333', 'freestyle'))?.id).toBe(active.id);
    });

    it('offers somewhere else to put them, never where they already are', async () => {
      await getOrCreateActiveSession('333', 'freestyle');
      await createSession('Evening', '333', 'freestyle');

      render(<SessionPicker onPick={vi.fn()} onClose={vi.fn()} />);

      // 'Evening' is active after being created, so 'Default' is the only
      // destination — and renaming and archiving are not on offer at all.
      expect(await screen.findByRole('button', { name: /Default/ })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Evening/ })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Rename' })).not.toBeInTheDocument();
      expect(screen.queryByLabelText('New session name')).not.toBeInTheDocument();
    });

    it('says so when there is nowhere else to put them', async () => {
      await getOrCreateActiveSession('333', 'freestyle');

      render(<SessionPicker onPick={vi.fn()} onClose={vi.fn()} />);

      expect(await screen.findByText('There is no other session.')).toBeInTheDocument();
    });
  });
  describe('deleting a session', () => {
    it('asks once more, and says what leaves with it', async () => {
      await getOrCreateActiveSession('333', 'freestyle');
      const user = userEvent.setup();

      render(<SessionPicker onClose={vi.fn()} />);

      await user.click(await screen.findByRole('button', { name: 'Delete' }));

      expect(
        screen.getByText('This session has no solves in it.'),
      ).toBeInTheDocument();
      // Still there: the first press only arms the second.
      expect(await db.sessions.count()).toBe(1);

      await user.click(screen.getByRole('button', { name: 'Delete session' }));

      await waitFor(async () => {
        expect(await db.sessions.count()).toBe(0);
      });
    });

    it('backs out without deleting anything', async () => {
      await getOrCreateActiveSession('333', 'freestyle');
      const user = userEvent.setup();

      render(<SessionPicker onClose={vi.fn()} />);

      await user.click(await screen.findByRole('button', { name: 'Delete' }));
      await user.click(screen.getByRole('button', { name: 'Cancel' }));

      expect(screen.queryByRole('button', { name: 'Delete session' })).not.toBeInTheDocument();
      expect(await db.sessions.count()).toBe(1);
    });

    // Choosing where solves go is no place to offer to destroy any of it.
    it('is not offered while a destination is being chosen', async () => {
      await getOrCreateActiveSession('333', 'freestyle');
      await createSession('Evening', '333', 'freestyle');

      render(<SessionPicker onPick={vi.fn()} onClose={vi.fn()} />);

      expect(await screen.findByRole('button', { name: /Default/ })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
    });
  });
});
