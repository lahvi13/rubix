import type { Route } from './router';

/**
 * The screens a phone keeps under the thumb. The rest are a tap further, under
 * More: the drill is reached from the trainer it drills, and settings, data
 * and the guide are not where a session is spent.
 */
export const TAB_ROUTES = ['timer', 'trainer', 'history', 'stats'] as const;
export type TabRoute = (typeof TAB_ROUTES)[number];

export function isTab(route: Route): route is TabRoute {
  return (TAB_ROUTES as readonly string[]).includes(route);
}
