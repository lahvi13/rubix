import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { ErrorBoundary } from './app/ErrorBoundary';
import { onDatabaseReconnect } from './db/schema';
import { seedPacks } from './db/seed/seed';
import { isBrowserSupported, showUnsupportedBrowser } from './lib/browser-support';
import { installGlobalErrorHandlers, reportError } from './lib/errors';
import { currentLanguage } from './lib/language';
import { strings } from './lib/strings';
import { applyAppearance, cachedAppearance } from './lib/appearance';
import { requestPersistentStorage } from './lib/storage';
import { loadSettings } from './hooks/use-setting';
import './index.css';

/**
 * How long the first render waits for the settings. A database being upgraded
 * after an update can take a while; one that hangs must not keep the app, and
 * its troubleshooting screen, from appearing at all.
 */
const SETTINGS_WAIT_MS = 1500;

const container = document.getElementById('root');
if (!container) throw new Error('Missing #root element');

// A browser too old for the stylesheet is told so before anything else runs:
// started anyway, it would draw a colourless page and write to a database the
// reader will never see working.
if (isBrowserSupported()) start(container);
else showUnsupportedBrowser(container);

function start(root: HTMLElement): void {
  installGlobalErrorHandlers();

  // Before the first frame: the database holds the real setting, but its answer
  // comes an async tick too late to paint with, and a light-theme reader should
  // not be shown a black screen on the way in.
  applyAppearance(cachedAppearance());

  // What the page is actually written in, for a screen reader's pronunciation
  // and for the browser's own offer to translate it. The attribute in the HTML
  // is only what the document is served as.
  document.documentElement.lang = currentLanguage();

  // Between backups, solves exist only in IndexedDB. Persistent storage tells
  // the browser this origin's data must survive disk pressure; installed PWAs
  // and engaged sites get it without any prompt.
  void requestPersistentStorage();

  // The built-in algorithm packs are put in place before anything reads them.
  // An upsert keyed by id, so this is also how a new version ships a fix.
  const seed = () => void seedPacks().catch((cause: unknown) => reportError(strings.errors.seed, cause));
  seed();

  // A connection lost mid-seed can leave the packs half written, and nothing
  // else would ever notice: the seed only runs at startup. It is cheap when
  // there is nothing to do, so running it after a repair costs little.
  onDatabaseReconnect(seed);

  // The settings are read before anything is drawn, so nothing is drawn with the
  // defaults and redrawn with the reader's choices a moment later — the theme
  // least of all. The page behind is already painted in the cached look.
  void loadSettings(SETTINGS_WAIT_MS).then(() => {
    createRoot(root).render(
      <StrictMode>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </StrictMode>,
    );
  });
}
