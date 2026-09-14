import { describe, expect, it } from 'vitest';
import {
  BACKUP_REMINDER_SOLVES,
  backupReminderBaseline,
  isBackupDue,
} from './backup-reminder';

describe('backupReminderBaseline', () => {
  it.each([
    ['never backed up, never put off', 0, 0, 0],
    ['backed up, never put off', 500, 0, 500],
    ['put off after the backup', 500, 900, 900],
    // A backup after "not now" starts the count again from the backup.
    ['backed up after putting it off', 900, 500, 900],
  ])('%s', (_, lastExportAt, snoozedAt, expected) => {
    expect(backupReminderBaseline(lastExportAt, snoozedAt)).toBe(expected);
  });
});

describe('isBackupDue', () => {
  it.each([
    [0, false],
    [BACKUP_REMINDER_SOLVES - 1, false],
    [BACKUP_REMINDER_SOLVES, true],
    [5000, true],
  ])('%i unsaved solves → %s', (count, expected) => {
    expect(isBackupDue(count)).toBe(expected);
  });
});
