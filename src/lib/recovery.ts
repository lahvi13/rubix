/**
 * Repair for a wedged installation: a stale service worker can keep serving a
 * mix of old and new files across plain reloads forever. Unregistering it and
 * dropping the Cache Storage forces the next load to fetch the current build
 * and install a fresh service worker. IndexedDB is deliberately untouched —
 * the user's solves survive.
 */
export async function recoverAndReload(): Promise<void> {
  try {
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((registration) => registration.unregister()));
    }
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
    }
  } catch {
    // Repair is best effort; the reload below is the part that must happen.
  }
  window.location.reload();
}
