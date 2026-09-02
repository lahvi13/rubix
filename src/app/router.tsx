import { useEffect, useState } from 'react';

/**
 * Hash routing, hand-rolled. Three screens do not justify a router dependency,
 * and hash URLs work the same whether the app is served from a domain, a
 * preview URL or an installed PWA.
 */

export const ROUTES = ['timer', 'history', 'stats', 'sessions'] as const;
export type Route = (typeof ROUTES)[number];

const DEFAULT_ROUTE: Route = 'timer';

function isRoute(value: string): value is Route {
  return (ROUTES as readonly string[]).includes(value);
}

function currentRoute(): Route {
  const value = window.location.hash.replace(/^#\/?/, '');
  return isRoute(value) ? value : DEFAULT_ROUTE;
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(currentRoute);

  useEffect(() => {
    const onHashChange = () => setRoute(currentRoute());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  return route;
}

export function navigate(route: Route): void {
  window.location.hash = `#/${route}`;
}
