import { useSyncExternalStore } from 'react';

/**
 * Hash routing, hand-rolled. Three screens do not justify a router dependency,
 * and hash URLs work the same whether the app is served from a domain, a
 * preview URL or an installed PWA.
 */

export const ROUTES = [
  'timer',
  'learn',
  'trainer',
  'drill',
  'history',
  'stats',
  'settings',
  'data',
  'about',
] as const;
export type Route = (typeof ROUTES)[number];

const DEFAULT_ROUTE: Route = 'timer';

function isRoute(value: string): value is Route {
  return (ROUTES as readonly string[]).includes(value);
}

function currentRoute(): Route {
  // A link can carry more after the screen — a shared scramble does.
  const value = window.location.hash.replace(/^#\/?/, '').split('?')[0] ?? '';
  return isRoute(value) ? value : DEFAULT_ROUTE;
}

const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  window.addEventListener('hashchange', listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('hashchange', listener);
  };
}

export function useRoute(): Route {
  return useSyncExternalStore(subscribe, currentRoute);
}

/**
 * Tells the app straight away rather than leaving it to `hashchange`, which
 * arrives a frame later: whatever the click also changed — the menu closing —
 * would be drawn over the old screen first, and the old screen would flash.
 */
export function navigate(route: Route): void {
  window.location.hash = `#/${route}`;
  for (const listener of listeners) listener();
}
