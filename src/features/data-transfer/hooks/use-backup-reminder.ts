import { useLiveQuery } from 'dexie-react-hooks';
import {
  countRecordsChangedSince,
  countSolvesChangedSince,
} from '../../../db/repositories/solve-repository';
import {
  backupReminderBaseline,
  isBackupDue,
  type RecordCounts,
} from '../../../domain/transfer/backup-reminder';
import { useSetting } from '../../../hooks/use-setting';
import { now } from '../../../lib/clock';

export interface BackupReminder {
  /**
   * Records in no backup, by kind, when there are enough of them to say so;
   * null otherwise. Drill and recognition attempts count toward "enough" as
   * much as solves do: a backup holds them all, and months of drilling are as
   * much to lose.
   */
  unsaved: RecordCounts | null;
  /** Whether any backup was ever taken here — it changes what the reminder says. */
  hasBackup: boolean;
  snooze: () => void;
}

export function useBackupReminder(): BackupReminder {
  const [lastExportAt] = useSetting('data.lastExportAt');
  const [snoozedAt, setSnoozedAt] = useSetting('data.backupReminderSnoozedAt');

  const unsaved = useLiveQuery(async () => {
    const baseline = backupReminderBaseline(lastExportAt, snoozedAt);
    const sinceBaseline = await countSolvesChangedSince(baseline);
    if (!isBackupDue(sinceBaseline)) return null;
    // Said as everything outside the backup, not only what came after "not now".
    return countRecordsChangedSince(lastExportAt);
  }, [lastExportAt, snoozedAt]);

  return {
    unsaved: unsaved ?? null,
    hasBackup: lastExportAt !== 0,
    snooze: () => setSnoozedAt(now()),
  };
}
