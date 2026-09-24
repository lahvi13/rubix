import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../../db/schema';
import { getSetting, setSetting } from '../../../db/repositories/settings-repository';
import { createSession } from '../../../db/repositories/session-repository';
import { addSolve, restoreSolves } from '../../../db/repositories/solve-repository';
import { BACKUP_REMINDER_SOLVES } from '../../../domain/transfer/backup-reminder';
import { BackupReminder } from './BackupReminder';

/** Rows as a restore would write them: one real solve, copied under new ids. */
async function timeSolves(count: number): Promise<void> {
  const session = await createSession('Evening', '333', 'freestyle');
  const template = await addSolve({
    sessionId: session.id,
    puzzle: '333',
    mode: 'freestyle',
    scramble: 'U',
    rawMs: 12_000,
    penalty: 'none',
    penaltySource: 'auto',
    inspectionMs: null,
    startedAt: Date.now(),
  });
  await restoreSolves(
    Array.from({ length: count - 1 }, (_, index) => ({ ...template, id: `copy-${index}` })),
  );
}

describe('BackupReminder', () => {
  beforeEach(async () => {
    await Promise.all(db.tables.map((table) => table.clear()));
  });

  it('stays silent while there is not much to lose', async () => {
    await timeSolves(BACKUP_REMINDER_SOLVES - 1);

    render(<BackupReminder />);

    // Give the live query time to answer before asserting nothing came of it.
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('says how many solves have never been backed up', async () => {
    await timeSolves(BACKUP_REMINDER_SOLVES);

    render(<BackupReminder />);

    expect(
      await screen.findByText(`Only on this device, with no backup: ${BACKUP_REMINDER_SOLVES} solves.`),
    ).toBeInTheDocument();
  });

  it('counts from the last backup once there is one', async () => {
    await setSetting('data.lastExportAt', 1);
    await timeSolves(BACKUP_REMINDER_SOLVES);

    render(<BackupReminder />);

    expect(
      await screen.findByText(`Not in your last backup: ${BACKUP_REMINDER_SOLVES} solves.`),
    ).toBeInTheDocument();
  });

  it('puts itself off on "Not now"', async () => {
    await timeSolves(BACKUP_REMINDER_SOLVES);
    const user = userEvent.setup();

    render(<BackupReminder />);
    await user.click(await screen.findByRole('button', { name: 'Not now' }));

    // The setting, not the rerender: a live query under fake-indexeddb takes
    // its time to come round again.
    await waitFor(async () => {
      expect(await getSetting('data.backupReminderSnoozedAt')).toBeGreaterThan(0);
    });
  });
});
