import { useRegisterSW } from 'virtual:pwa-register/react';
import { strings } from '../lib/strings';

const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000;

/**
 * registerType is 'prompt', so a new build never swaps itself in mid-solve —
 * the user decides when to reload.
 */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (!registration) return;
      // Browsers only look for a new service worker on navigation, and an
      // installed PWA can stay alive for days without one — so this banner
      // would never show. Poll, and re-check whenever the app comes back to
      // the foreground. The catch matters: update() rejects while offline.
      const check = () => void registration.update().catch(() => {});
      setInterval(check, UPDATE_CHECK_INTERVAL_MS);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') check();
      });
    },
  });

  if (!needRefresh) return null;

  return (
    <div className="update-prompt" role="status">
      <span>{strings.update.available}</span>
      <button type="button" onClick={() => void updateServiceWorker(true)}>
        {strings.update.reload}
      </button>
      <button type="button" onClick={() => setNeedRefresh(false)}>
        {strings.update.dismiss}
      </button>
    </div>
  );
}
