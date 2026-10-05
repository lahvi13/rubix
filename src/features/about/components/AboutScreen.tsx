import { navigate } from '../../../app/router';
import { Wordmark } from '../../../components/Wordmark';
import { useCubeSkin } from '../../../hooks/use-cube-skin';
import type { UpdateCheck } from '../../../lib/app-update';
import type { LinkShareOutcome } from '../../../lib/share';
import { strings } from '../../../lib/strings';
import { useAboutActions } from '../hooks/use-about-actions';
import { InstallSection } from './InstallSection';

const CONTACT = 'jan@lahvi.cz';
const REPO = 'github.com/lahvi13/rubix';

const UPDATE_MESSAGE: Record<UpdateCheck, string> = {
  current: strings.about.updateCurrent,
  ready: strings.about.updateReady,
  offline: strings.about.updateOffline,
  unavailable: strings.about.updateUnavailable,
};

const SHARE_MESSAGE: Record<LinkShareOutcome, string | null> = {
  shared: null,
  cancelled: null,
  copied: strings.about.copied,
  failed: strings.about.shareFailed,
};

const CREDITS = [
  { text: strings.about.creditAlgs, href: 'https://jperm.net/', link: 'jperm.net' },
  { text: strings.about.creditMethod, href: 'http://badmephisto.com', link: 'badmephisto.com' },
  { text: strings.about.creditCubing, href: 'https://js.cubing.net/cubing/', link: 'js.cubing.net' },
  { text: strings.about.creditClaude, href: 'https://claude.com/claude-code', link: 'claude.com/claude-code' },
] as const;

/**
 * What the app is, how it gets onto the home screen, and which build this is.
 * Kept to what somebody opening it for the first time, or reporting a bug,
 * needs — the rest of the app explains itself where it is used.
 */
export function AboutScreen() {
  const skin = useCubeSkin();
  const { update, checkUpdates, shareOutcome, share } = useAboutActions();
  const shareMessage = shareOutcome === null ? null : SHARE_MESSAGE[shareOutcome];
  // The version rides along in the subject, so a report says which build it
  // is about without anybody having to be asked.
  const mailto = `mailto:${CONTACT}?subject=${encodeURIComponent(strings.about.version(__APP_VERSION__))}`;
  // GitHub fills an issue form's field from a query parameter named after its id.
  const issueUrl = `https://${REPO}/issues/new?template=bug.yml&version=${encodeURIComponent(__APP_VERSION__)}`;

  return (
    <main className="screen screen--scroll">
      <section className="data-section">
        {/* The header above already says Rubix; a heading saying it again,
            over a card signed with the name, was the third time. Kept for a
            screen reader, which reads the page by its headings. */}
        <h2 className="visually-hidden">{strings.about.title}</h2>
        <p className="data-section__hint">{strings.about.what}</p>
        <p className="data-section__hint">{strings.about.who}</p>
        <div className="about__sign">
          <button type="button" onClick={share}>
            {strings.about.share}
          </button>
          <Wordmark faces={skin.faces} />
        </div>
        {shareMessage === null ? null : (
          <p className="data-section__hint data-section__hint--after" role="status">
            {shareMessage}
          </p>
        )}
      </section>

      <InstallSection />

      <section className="data-section">
        <h2 className="data-section__title">{strings.about.dataTitle}</h2>
        <p className="data-section__hint">{strings.about.data}</p>
        <p className="data-section__hint">{strings.about.analytics}</p>
        <button type="button" onClick={() => navigate('data')}>
          {strings.about.toData}
        </button>
      </section>

      <section className="data-section">
        <h2 className="data-section__title">{strings.about.versionTitle}</h2>
        <p className="about__version">{strings.about.version(__APP_VERSION__)}</p>
        <button type="button" disabled={update.status === 'checking'} onClick={checkUpdates}>
          {update.status === 'checking' ? strings.about.checking : strings.about.checkUpdates}
        </button>
        {update.status === 'done' ? (
          <p className="data-section__hint data-section__hint--after" role="status">
            {UPDATE_MESSAGE[update.result]}
          </p>
        ) : null}
      </section>

      <section className="data-section">
        <h2 className="data-section__title">{strings.about.contactTitle}</h2>
        <p className="data-section__hint">
          {strings.about.contact} <a href={mailto}>{CONTACT}</a>
        </p>
        <p className="data-section__hint">
          {strings.about.contactIssue}{' '}
          <a href={issueUrl} target="_blank" rel="noopener noreferrer">
            {strings.about.issueLink}
          </a>
        </p>
        <p className="data-section__hint">
          {strings.about.source}{' '}
          <a href={`https://${REPO}`} target="_blank" rel="noopener noreferrer">
            {REPO}
          </a>
        </p>
      </section>

      <section className="data-section">
        <h2 className="data-section__title">{strings.about.creditsTitle}</h2>
        <ul className="about__credits">
          {CREDITS.map((credit) => (
            <li key={credit.href}>
              {credit.text}{' '}
              <a href={credit.href} target="_blank" rel="noopener noreferrer">
                {credit.link}
              </a>
            </li>
          ))}
          <li>{strings.about.creditFonts}</li>
        </ul>
      </section>
    </main>
  );
}
