import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { ErrorBoundary } from './app/ErrorBoundary';
import { installGlobalErrorHandlers } from './lib/errors';
import './index.css';

installGlobalErrorHandlers();

// Until export/import lands, solves exist only in IndexedDB. Persistent
// storage tells the browser this origin's data must survive disk pressure;
// installed PWAs and engaged sites get it without any prompt.
if ('storage' in navigator && typeof navigator.storage.persist === 'function') {
  void navigator.storage.persist().catch(() => {});
}

const container = document.getElementById('root');
if (!container) throw new Error('Missing #root element');

createRoot(container).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
