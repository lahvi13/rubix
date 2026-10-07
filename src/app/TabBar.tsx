import type { ReactNode } from 'react';
import {
  HistoryIcon,
  MoreIcon,
  StatsIcon,
  TimerIcon,
  TrainerIcon,
} from '../components/Icons';
import { strings } from '../lib/strings';
import { navigate, type Route } from './router';
import { TAB_ROUTES, isTab, type TabRoute } from './tab-routes';

const ICONS: Record<TabRoute, ReactNode> = {
  timer: <TimerIcon />,
  trainer: <TrainerIcon />,
  history: <HistoryIcon />,
  stats: <StatsIcon />,
};

interface TabBarProps {
  route: Route;
  /** False while the reader scrolls down through a page; see `useBarScroll`. */
  isShown: boolean;
  isMoreOpen: boolean;
  onMore: () => void;
}

/**
 * The way between screens on a phone, along the bottom edge where the thumb
 * already is. Icons without words, to keep the bar low; each still says its
 * name to anyone who cannot see it. A wide screen keeps the menu in the header
 * instead — the stylesheet decides which one shows.
 */
export function TabBar({ route, isShown, isMoreOpen, onMore }: TabBarProps) {
  // On a screen of its own a tab is lit; on any of the rest, More is, which
  // is where that screen was found.
  const isMoreActive = !isTab(route);

  return (
    <nav
      className={isShown ? 'tab-bar' : 'tab-bar is-hidden'}
      aria-label={strings.nav.screens}
      inert={!isShown}
    >
      {TAB_ROUTES.map((target) => (
        <button
          key={target}
          type="button"
          className={route === target ? 'tab-bar__tab is-active' : 'tab-bar__tab'}
          aria-label={strings.nav[target]}
          aria-current={route === target ? 'page' : undefined}
          onClick={() => {
            // Already here: the tap goes back to the top, the way a long list
            // of cases is left.
            if (route === target) window.scrollTo({ top: 0, behavior: 'smooth' });
            else navigate(target);
          }}
        >
          {ICONS[target]}
        </button>
      ))}
      <button
        type="button"
        className={isMoreActive ? 'tab-bar__tab is-active' : 'tab-bar__tab'}
        aria-label={strings.nav.more}
        aria-expanded={isMoreOpen}
        onClick={onMore}
      >
        <MoreIcon />
      </button>
    </nav>
  );
}
