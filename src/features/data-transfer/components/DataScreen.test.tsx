import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../../db/schema';
import { createSession } from '../../../db/repositories/session-repository';
import { addSolve } from '../../../db/repositories/solve-repository';
import { buildExportFile, clearAllData } from '../../../db/repositories/transfer-repository';
import { DataScreen } from './DataScreen';

async function exportedFile(): Promise<File> {
  const session = await createSession('Evening', '333', 'freestyle');
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

  const file = await buildExportFile('0.4.0');
  await clearAllData();
  return new File([JSON.stringify(file)], 'rubix-backup.json', { type: 'application/json' });
}

describe('DataScreen', () => {
  beforeEach(async () => {
    await Promise.all(db.tables.map((table) => table.clear()));
  });

  it('previews a file first and only writes after the import is confirmed', async () => {
    const backup = await exportedFile();
    const user = userEvent.setup();

    render(<DataScreen />);
    await user.upload(screen.getByLabelText('Choose a file'), backup);

    const row = await screen.findByRole('row', { name: /^Solves/ });
    expect(row).toHaveTextContent('1');
    expect(await db.solves.count()).toBe(0);

    await user.click(screen.getByRole('button', { name: 'Import' }));

    await waitFor(async () => {
      expect(await db.solves.count()).toBe(1);
    });
    expect(await db.sessions.count()).toBe(1);
    expect(screen.getByText('Import finished.')).toBeInTheDocument();
  });

  it('explains a file it cannot read instead of touching the database', async () => {
    const user = userEvent.setup();

    render(<DataScreen />);
    await user.upload(
      screen.getByLabelText('Choose a file'),
      new File(['{"format":"csTimer"}'], 'other.json', { type: 'application/json' }),
    );

    expect(await screen.findByText('That file is not a Rubix export.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Import' })).not.toBeInTheDocument();
  });

  it('asks twice before deleting everything', async () => {
    const session = await createSession('Evening', '333', 'freestyle');
    await addSolve({
      sessionId: session.id,
      puzzle: '333',
      mode: 'freestyle',
      scramble: 'U',
      rawMs: 9_000,
      penalty: 'none',
      penaltySource: 'auto',
      inspectionMs: null,
      startedAt: Date.now(),
    });
    const user = userEvent.setup();

    render(<DataScreen />);
    await user.click(screen.getByRole('button', { name: 'Delete all data' }));
    expect(await db.solves.count()).toBe(1);

    await user.click(screen.getByRole('button', { name: 'Delete everything' }));

    await waitFor(async () => {
      expect(await db.solves.count()).toBe(0);
    });
  });
});
