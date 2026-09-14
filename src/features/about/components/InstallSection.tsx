import { showInstallPrompt } from '../../../lib/install';
import { strings } from '../../../lib/strings';
import { useInstall } from '../hooks/use-install';

/**
 * Where the app says how it is installed — and, on iOS, that it has to be done
 * by hand. Gone once it is on the home screen, and absent in a browser that
 * does not install at all.
 */
export function InstallSection() {
  const state = useInstall();

  if (state === 'installed' || state === 'none') return null;

  if (state === 'manual') {
    return (
      <section className="data-section">
        <h2 className="data-section__title">{strings.install.iosTitle}</h2>
        <p className="data-section__hint">{strings.install.iosSteps}</p>
        <p className="data-section__hint">{strings.install.iosWhy}</p>
      </section>
    );
  }

  return (
    <section className="data-section">
      <h2 className="data-section__title">{strings.install.title}</h2>
      <p className="data-section__hint">{strings.install.hint}</p>
      <button type="button" className="is-primary" onClick={() => void showInstallPrompt()}>
        {strings.install.action}
      </button>
    </section>
  );
}
