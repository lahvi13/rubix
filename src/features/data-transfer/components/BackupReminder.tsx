import { navigate } from '../../../app/router';
import { strings } from '../../../lib/strings';
import { useBackupReminder } from '../hooks/use-backup-reminder';

/**
 * The backup, brought up where the solves are being admired rather than on a
 * screen nobody visits unprompted. Silent until enough is at stake; a backup
 * or "Not now" quiets it for as long again.
 */
export function BackupReminder() {
  const { unsaved, hasBackup, snooze } = useBackupReminder();
  if (unsaved === null) return null;

  return (
    <div className="backup-reminder" role="status">
      <p className="backup-reminder__message">
        {hasBackup
          ? strings.backupReminder.sinceBackup(unsaved)
          : strings.backupReminder.never(unsaved)}
      </p>
      <div className="backup-reminder__actions">
        <button type="button" className="is-primary" onClick={() => navigate('data')}>
          {strings.backupReminder.backUp}
        </button>
        <button type="button" onClick={snooze}>
          {strings.backupReminder.later}
        </button>
      </div>
    </div>
  );
}
