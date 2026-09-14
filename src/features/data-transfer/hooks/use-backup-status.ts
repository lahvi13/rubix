import { useLiveQuery } from 'dexie-react-hooks';
import { useCallback, useEffect, useState } from 'react';
import { countSolvesChangedSince } from '../../../db/repositories/solve-repository';
import { useSetting } from '../../../hooks/use-setting';
import {
  readStorageStatus,
  requestPersistentStorage,
  type StorageStatus,
} from '../../../lib/storage';

export interface BackupStatus {
  /** null until this device has written a backup. */
  lastExportAt: number | null;
  /** Solves the last backup does not hold as they are now; undefined while counting. */
  changedSince: number | undefined;
  /** null while the browser is being asked. */
  storage: StorageStatus | null;
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
  const changedSince = useLiveQuery(() => countSolvesChangedSince(lastExportAt), [lastExportAt]);
  const [storage, setStorage] = useState<StorageStatus | null>(null);

  useEffect(() => {
    let isCurrent = true;
    void readStorageStatus().then((status) => {
      if (isCurrent) setStorage(status);
    });
    return () => {
      isCurrent = false;
    };
  }, []);

  return {
    lastExportAt: lastExportAt === 0 ? null : lastExportAt,
    changedSince,
    storage,
    keepStorage: useCallback(async () => {
      const isGranted = await requestPersistentStorage();
      setStorage(await readStorageStatus());
      return isGranted;
    }, []),
  };
}
