function storageManager(): StorageManager | null {
  return 'storage' in navigator ? navigator.storage : null;
}

/**
 * Whether the browser has promised not to clear this origin's data under disk
 * pressure. Between backups the solves exist only in IndexedDB, so this is the
 * difference between an inconvenience and losing them. null when the browser
 * does not say — it has no storage manager, or refused to answer.
 */
export async function isStoragePersisted(): Promise<boolean | null> {
  const storage = storageManager();
  if (typeof storage?.persisted !== 'function') return null;
  return storage.persisted().catch(() => null);
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
