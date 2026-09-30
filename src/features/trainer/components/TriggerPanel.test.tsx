import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../../db/schema';
import { listTriggers } from '../../../db/repositories/trigger-repository';
import { TRIGGER_COLOURS } from '../../../domain/alg/triggers';
import { seedPacks } from '../../../db/seed/seed';
import { TriggerPanel } from './TriggerPanel';

describe('TriggerPanel', () => {
  beforeEach(async () => {
    await Promise.all(db.tables.map((table) => table.clear()));
    await seedPacks();
  });

  it('gives a new trigger the colour it was added in', async () => {
    const user = userEvent.setup();
    render(<TriggerPanel />);

    const wanted = TRIGGER_COLOURS[4];
    await user.type(await screen.findByPlaceholderText(/name/i), 'Fat hedgeslammer');
    await user.type(screen.getByPlaceholderText(/moves/i), "f R' F' R");

    const form = screen.getByRole('button', { name: /add trigger/i }).closest('form');
    expect(form).not.toBeNull();
    await user.click(within(form as HTMLElement).getByRole('button', { name: wanted }));
    await user.click(screen.getByRole('button', { name: /add trigger/i }));

    // Chosen while adding rather than hunted down afterwards: the list is
    // ordered by length, so a new trigger lands wherever its moves put it.
    await waitFor(async () => {
      const mine = (await listTriggers()).find((trigger) => trigger.name === 'Fat hedgeslammer');
      expect(mine?.colour).toBe(wanted);
    });
  });

  it('lets you throw away what you made and not what shipped', async () => {
    const user = userEvent.setup();
    render(<TriggerPanel />);

    const open = async (startsWith: string) => {
      const rows = await screen.findAllByRole('button', { expanded: false });
      const row = rows.find((button) => (button.textContent ?? '').startsWith(startsWith));
      expect(row).toBeDefined();
      if (row !== undefined) await user.click(row);
    };

    // A built-in one has the tick on its line and nothing that would bury it:
    // deleting writes a tombstone, and there would be no way back.
    await open('Sexy move');
    expect(screen.queryByRole('button', { name: /^Delete$/ })).toBeNull();
    expect(screen.getByText(/switch it off with the tick/)).toBeInTheDocument();
    await open('Sexy move');

    await user.type(screen.getByPlaceholderText(/name/i), 'Mine');
    await user.type(screen.getByPlaceholderText(/moves/i), "R U R' F'");
    await user.click(screen.getByRole('button', { name: /add trigger/i }));
    await waitFor(async () => {
      expect((await listTriggers()).some((trigger) => trigger.name === 'Mine')).toBe(true);
    });

    await open('Mine');
    expect(screen.getByRole('button', { name: /^Delete$/ })).toBeInTheDocument();
  });

  it('keeps the boxes that change a trigger behind a tap', async () => {
    const user = userEvent.setup();
    render(<TriggerPanel />);

    const rows = await screen.findAllByRole('button', { expanded: false });
    const row = rows.find((button) => (button.textContent ?? '').startsWith('Sexy move'));
    expect(row).toBeDefined();
    if (row === undefined) return;

    // Only the box for adding a new one, whatever the list is showing.
    expect(screen.getAllByLabelText('Moves')).toHaveLength(1);

    await user.click(row);

    // One trigger's boxes, not every trigger's: the panel is read far more
    // often than it is edited.
    const boxes = screen.getAllByLabelText('Moves');
    expect(boxes).toHaveLength(2);
    expect(boxes.map((box) => (box as HTMLInputElement).value)).toContain("R U R' U'");
  });
});
