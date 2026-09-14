import { useSyncExternalStore } from 'react';
import { onDatabaseReconnect } from '../db/schema';
import {
  readSetting,
  setSetting,
  watchSettings,
  type SettingKey,
  type SettingValues,
  type StoredSettings,
} from '../db/repositories/settings-repository';
import { reportError, watchWrite } from '../lib/errors';
import { strings } from '../lib/strings';

/*
 * Every setting, read once and shared. A query per component meant every
 * screen was first drawn with the defaults and redrawn with the reader's own
 * choices a few frames later — on a phone, long enough to watch the settings
 * screen jump from one to the other.
 */

const NOTHING_READ: StoredSettings = new Map();

let stored = NOTHING_READ;
let isLoaded = false;
const listeners = new Set<() => void>();
let unwatch: (() => void) | null = null;
let stopReconnecting: (() => void) | null = null;
let settleLoad: (() => void) | null = null;
let loaded: Promise<void> = Promise.resolve();

function watch(): void {
  unwatch?.();
  unwatch = watchSettings(
    (next) => {
      stored = next;
      isLoaded = true;
      settle();
      for (const listener of listeners) listener();
    },
    (cause) => {
      // The app is drawn with the defaults rather than not drawn at all.
      settle();
      reportError(strings.errors.settings, cause);
    },
  );
}

function settle(): void {
  settleLoad?.();
  settleLoad = null;
}

function start(): void {
  if (unwatch !== null) return;
  loaded = new Promise((resolve) => {
    settleLoad = resolve;
  });
  watch();
  // A watch whose connection died never delivers again. What it had read is
  // kept meanwhile: the settings did not change because the connection went.
  stopReconnecting = onDatabaseReconnect(watch);
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  start();
  return () => {
    listeners.delete(listener);
    if (listeners.size > 0) return;
    // Only reached when nothing holds the settings — never in the app, which
    // does from before its first render, but after every test, and a test
    // must not start from the last one's choices.
    unwatch?.();
    unwatch = null;
    stopReconnecting?.();
    stopReconnecting = null;
    stored = NOTHING_READ;
    isLoaded = false;
  };
}

/**
 * Reads every setting before the app is first drawn, and holds on to them for
 * as long as it runs. Settles once they are in, once the read has failed, or
 * after `waitMs`: a database that does not answer must not keep the app off
 * the screen, where the way to repair it is.
 */
export function loadSettings(waitMs: number): Promise<void> {
  subscribe(() => {});
  return Promise.race([
    loaded,
    new Promise<void>((resolve) => {
      setTimeout(resolve, waitMs);
    }),
  ]);
}

/**
 * One setting, live. Every screen that shows a setting also has to see it
 * change from somewhere else — the timer's inspection toggle and the settings
 * screen are the same switch.
 */
export function useSetting<K extends SettingKey>(
  key: K,
): [SettingValues[K], (value: SettingValues[K]) => void] {
  const value = useSyncExternalStore(subscribe, () => readSetting(stored, key));

  return [
    value,
    (next) => {
      watchWrite(() => setSetting(key, next), key);
    },
  ];
}

/** Whether `useSetting` is answering with what is stored, or still with the defaults. */
export function useSettingsLoaded(): boolean {
  return useSyncExternalStore(subscribe, () => isLoaded);
}
