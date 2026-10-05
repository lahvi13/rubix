import { cleanup, configure } from '@testing-library/react';
import { afterEach } from 'vitest';
import '@testing-library/jest-dom/vitest';

// Vitest globals are off, so RTL cannot register its own auto-cleanup and
// rendered trees would pile up across tests.
afterEach(cleanup);

// A screen answering a live query under fake-indexeddb redraws in well under
// a second alone, and in a full run — a hundred files at once — in more than
// the default second some of the time: the drill and the trainer each failed
// one run in a few on a wait that had nothing wrong with it. Only a wait that
// is still pending spends the extra time, so a passing test is no slower.
configure({ asyncUtilTimeout: 3000 });
// Repository tests run against a real IndexedDB implementation in memory.
import 'fake-indexeddb/auto';

// jsdom has no crypto.randomUUID; the ids only need to be unique, not secure.
if (!('randomUUID' in crypto)) {
  Object.defineProperty(crypto, 'randomUUID', {
    value: () => `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`,
  });
}

// jsdom has no matchMedia, and anything that draws a cube asks it which theme
// is on. Nothing dark-specific is under test, so the light answer will do.
if (typeof window.matchMedia !== 'function') {
  Object.defineProperty(window, 'matchMedia', {
    value: (media: string) => ({
      media,
      matches: false,
      addEventListener: () => {},
      removeEventListener: () => {},
    }),
  });
}
