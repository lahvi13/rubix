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
// After the line above, not before it: Dexie takes hold of indexedDB as it loads.
import Dexie, { type DBCore, type DBCoreTransaction } from 'dexie';

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

/**
 * What the database hands a reader is never changed in place: a live query's
 * result is the cached one, shared by everything that asked for it (`cache:
 * 'immutable'` in db/schema.ts). Dexie freezes the list and each row, which
 * turns a sort in place into an error — but only on a list of two or more,
 * and a row's own lists (a solve's splits, its tags) are shared unfrozen, so
 * a change there would be quiet and everybody's.
 *
 * Under test every read is frozen all the way down, live or not, so that the
 * mistake fails here and loudly whatever the data happens to be. Writes are
 * left alone: a transaction that changes rows may change what it read.
 */
function freezeDeep(value: unknown): void {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) return;
  // A typed array with anything in it cannot be frozen, and nothing here stores one.
  if (ArrayBuffer.isView(value) || value instanceof ArrayBuffer) return;
  Object.freeze(value);
  for (const inner of Object.values(value)) freezeDeep(inner);
}

const isReadOnly = (trans: DBCoreTransaction): boolean =>
  'mode' in trans && trans.mode === 'readonly';

Dexie.addons.push((database) => {
  database.use({
    stack: 'dbcore',
    name: 'frozen-reads',
    create: (core: DBCore): DBCore => ({
      ...core,
      table: (name) => {
        const table = core.table(name);
        return {
          ...table,
          get: (request) =>
            table.get(request).then((row: unknown) => {
              if (isReadOnly(request.trans)) freezeDeep(row);
              return row;
            }),
          getMany: (request) =>
            table.getMany(request).then((rows) => {
              if (isReadOnly(request.trans)) freezeDeep(rows);
              return rows;
            }),
          query: (request) =>
            table.query(request).then((response) => {
              if (isReadOnly(request.trans)) freezeDeep(response.result);
              return response;
            }),
        };
      },
    }),
  });
});
