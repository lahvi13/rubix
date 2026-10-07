import type { Route } from './router';

/**
 * The screens a phone keeps under the thumb; the rest are a tap further, under
 * More. Somebody with the beginner's guide on is learning, and the guide is
 * what they come back to; somebody who has switched it off is drilling cases
 * instead. History is under More either way — the last solves are on the
 * timer already, and reading further back is not a daily trip.
 */
const WITH_GUIDE = ['timer', 'learn', 'trainer', 'stats'] as const;
const WITHOUT_GUIDE = ['timer', 'trainer', 'drill', 'stats'] as const;

export type TabRoute = (typeof WITH_GUIDE)[number] | (typeof WITHOUT_GUIDE)[number];

export function tabRoutes(showLearn: boolean): readonly TabRoute[] {
  return showLearn ? WITH_GUIDE : WITHOUT_GUIDE;
}

export function isTab(route: Route, tabs: readonly TabRoute[]): route is TabRoute {
  return (tabs as readonly Route[]).includes(route);
}
