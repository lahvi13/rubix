/**
 * How many solves may pile up outside any backup before the app says so.
 * Not a hundred: a keen evening is fifty solves, and a reminder every other
 * day is one people learn to tap away unread. Two hundred and fifty is still
 * well short of what would hurt to lose.
 */
export const BACKUP_REMINDER_SOLVES = 250;

/**
 * The moment the reminder counts from: the last backup, or the last time it
 * was put off, whichever is later. "Not now" therefore means "not for
 * another as many", and a backup starts the count again from nothing.
 */
export function backupReminderBaseline(lastExportAt: number, snoozedAt: number): number {
  return Math.max(lastExportAt, snoozedAt);
}

export function isBackupDue(changedSinceBaseline: number): boolean {
  return changedSinceBaseline >= BACKUP_REMINDER_SOLVES;
}
