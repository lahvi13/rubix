import { useLiveQuery } from 'dexie-react-hooks';
import { countSolvesChangedSince } from '../../../db/repositories/solve-repository';
import { backupReminderBaseline, isBackupDue } from '../../../domain/transfer/backup-reminder';
import { useSetting } from '../../../hooks/use-setting';
import { now } from '../../../lib/clock';

export interface BackupReminder {
  /** Solves in no backup, when there are enough of them to say so; null otherwise. */
  unsavedCount: number | null;
  /** Whether any backup was ever taken here — it changes what the reminder says. */
  hasBackup: boolean;
  snooze: () => void;
}

export function useBackupReminder(): BackupReminder {
  const [lastExportAt] = useSetting('data.lastExportAt');
  const [snoozedAt, setSnoozedAt] = useSetting('data.backupReminderSnoozedAt');

  const unsavedCount = useLiveQuery(async () => {
    const baseline = backupReminderBaseline(lastExportAt, snoozedAt);
    const sinceBaseline = await countSolvesChangedSince(baseline);
    if (!isBackupDue(sinceBaseline)) return null;
    // Said as everything outside the backup, not only what came after "not now".
    return baseline === lastExportAt ? sinceBaseline : countSolvesChangedSince(lastExportAt);
  }, [lastExportAt, snoozedAt]);

  return {
    unsavedCount: unsavedCount ?? null,
    hasBackup: lastExportAt !== 0,
    snooze: () => setSnoozedAt(now()),
  };
}
