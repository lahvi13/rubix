/**
 * What the browser promises about this origin's data. Between backups the
 * solves exist only in IndexedDB, and whether the browser may clear it under
 * disk pressure is the difference between an inconvenience and losing them.
 */
export interface StorageStatus {
  /** null when the browser does not say — it has no storage manager, or refused. */
  isPersisted: boolean | null;
  /** The whole origin: the cached app counts too, not just the data. */
  usageBytes: number | null;
}

function storageManager(): StorageManager | null {
  return 'storage' in navigator ? navigator.storage : null;
}

export async function readStorageStatus(): Promise<StorageStatus> {
  const storage = storageManager();
  const [isPersisted, usageBytes] = await Promise.all([
    typeof storage?.persisted === 'function'
      ? storage.persisted().catch(() => null)
      : Promise.resolve(null),
    typeof storage?.estimate === 'function'
      ? storage
          .estimate()
          .then((estimate) => estimate.usage ?? null)
          .catch(() => null)
      : Promise.resolve(null),
  ]);
  return { isPersisted, usageBytes };
}

/**
 * Asks for storage the browser will not clear on its own. Chrome decides
 * silently — an installed app is granted it — while Firefox asks the user, and
 * only in answer to a tap.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  const storage = storageManager();
  if (typeof storage?.persist !== 'function') return false;
  return storage.persist().catch(() => false);
}
