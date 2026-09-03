import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { ErrorBoundary } from './app/ErrorBoundary';
import { onDatabaseReconnect } from './db/schema';
import { seedPacks } from './db/seed/seed';
import { installGlobalErrorHandlers, reportError } from './lib/errors';
import { strings } from './lib/strings';
import './index.css';

installGlobalErrorHandlers();

// Between backups, solves exist only in IndexedDB. Persistent storage tells
// the browser this origin's data must survive disk pressure; installed PWAs
// and engaged sites get it without any prompt.
if ('storage' in navigator && typeof navigator.storage.persist === 'function') {
  void navigator.storage.persist().catch(() => {});
}

// The built-in algorithm packs are put in place before anything reads them.
// An upsert keyed by id, so this is also how a new version ships a fix.
const seed = () => void seedPacks().catch((cause: unknown) => reportError(strings.errors.seed, cause));
seed();

// A connection lost mid-seed can leave the packs half written, and nothing
// else would ever notice: the seed only runs at startup. It is cheap when
// there is nothing to do, so running it after a repair costs little.
onDatabaseReconnect(seed);

const container = document.getElementById('root');
if (!container) throw new Error('Missing #root element');

createRoot(container).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
