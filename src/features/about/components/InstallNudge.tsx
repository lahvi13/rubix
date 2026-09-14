import { memo } from 'react';
import { navigate } from '../../../app/router';
import { strings } from '../../../lib/strings';
import { useInstallNudge } from '../hooks/use-install-nudge';

/**
 * Asks an iPhone reader to put the app on the home screen, once, until waved
 * away. Memoised because it sits in the timer's panel, which is redrawn every
 * frame while a solve runs.
 */
export const InstallNudge = memo(function InstallNudge() {
  const { isShown, dismiss } = useInstallNudge();
  if (!isShown) return null;

  return (
    <div className="install-nudge" role="status">
      <p className="install-nudge__message">{strings.installNudge.message}</p>
      <div className="install-nudge__actions">
        <button type="button" className="is-primary" onClick={() => navigate('about')}>
          {strings.installNudge.how}
        </button>
        <button type="button" onClick={dismiss}>
          {strings.installNudge.dismiss}
        </button>
      </div>
    </div>
  );
});
