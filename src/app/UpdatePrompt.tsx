import { useRegisterSW } from 'virtual:pwa-register/react';
import { strings } from '../lib/strings';

/**
 * registerType is 'prompt', so a new build never swaps itself in mid-solve —
 * the user decides when to reload.
 */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

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
