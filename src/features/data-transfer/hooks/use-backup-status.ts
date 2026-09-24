import { useLiveQuery } from 'dexie-react-hooks';
import { useCallback, useEffect, useState } from 'react';
import { countRecordsChangedSince } from '../../../db/repositories/solve-repository';
import type { RecordCounts } from '../../../domain/transfer/backup-reminder';
import { useSetting } from '../../../hooks/use-setting';
import { isStoragePersisted, requestPersistentStorage } from '../../../lib/storage';

export interface BackupStatus {
  /** null until this device has written a backup. */
  lastExportAt: number | null;
  /** null when not known — no backup yet, or one taken before sizes were kept. */
  lastExportBytes: number | null;
  /** Records the last backup does not hold as they are now, by kind; undefined while counting. */
  changedSince: RecordCounts | undefined;
  /** undefined while the browser is being asked, null when it does not say. */
  isPersisted: boolean | null | undefined;
  /** Whether the browser agreed. */
  keepStorage: () => Promise<boolean>;
}

/**
 * How much there is to lose. With no sync, the backup file is the only copy
 * of anything that is not on this device, and the storage the browser grants
 * decides whether this device is a copy worth trusting at all.
 */
export function useBackupStatus(): BackupStatus {
  const [lastExportAt] = useSetting('data.lastExportAt');
  const [lastExportBytes] = useSetting('data.lastExportBytes');
  const changedSince = useLiveQuery(() => countRecordsChangedSince(lastExportAt), [lastExportAt]);
  const [isPersisted, setPersisted] = useState<boolean | null | undefined>(undefined);

  useEffect(() => {
    let isCurrent = true;
    void isStoragePersisted().then((answer) => {
      if (isCurrent) setPersisted(answer);
    });
    return () => {
      isCurrent = false;
    };
  }, []);

  return {
    lastExportAt: lastExportAt === 0 ? null : lastExportAt,
    lastExportBytes: lastExportAt === 0 || lastExportBytes === 0 ? null : lastExportBytes,
    changedSince,
    isPersisted,
    keepStorage: useCallback(async () => {
      const isGranted = await requestPersistentStorage();
      setPersisted(await isStoragePersisted());
      return isGranted;
    }, []),
  };
}
