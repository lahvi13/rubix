import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';
import '@testing-library/jest-dom/vitest';

// Vitest globals are off, so RTL cannot register its own auto-cleanup and
// rendered trees would pile up across tests.
afterEach(cleanup);
// Repository tests run against a real IndexedDB implementation in memory.
import 'fake-indexeddb/auto';

// jsdom has no crypto.randomUUID; the ids only need to be unique, not secure.
if (!('randomUUID' in crypto)) {
  Object.defineProperty(crypto, 'randomUUID', {
    value: () => `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`,
  });
}
