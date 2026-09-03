import { Fragment, useEffect, useState } from 'react';
import { DataScreen } from '../features/data-transfer';
import { HistoryScreen } from '../features/history';
import { SessionsScreen } from '../features/sessions';
import { SettingsScreen } from '../features/settings';
import { StatsScreen } from '../features/stats';
import { TimerScreen } from '../features/timer';
import { TrainerScreen } from '../features/trainer';
import { useDatabaseGeneration } from '../hooks/use-database-health';
import { strings } from '../lib/strings';
import { ROUTES, navigate, useRoute } from './router';
import { ErrorBanner } from './ErrorBanner';
import { UpdatePrompt } from './UpdatePrompt';

export function App() {
  const route = useRoute();
  const [isMenuOpen, setMenuOpen] = useState(false);
  // A screen that lived through a lost connection holds dead live queries; the
  // key mounts it again once the database is back.
  const generation = useDatabaseGeneration();

  // While the menu is open the keyboard belongs to it: the timer listens on
  // the window, and a Space meant for a menu item must not start a solve
  // underneath. Propagation is stopped, never the default action, so Space and
  // Enter still activate the focused item.
  useEffect(() => {
    if (!isMenuOpen) return;
    const swallow = (event: KeyboardEvent) => {
      event.stopPropagation();
      if (event.type === 'keydown' && event.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('keydown', swallow, true);
    window.addEventListener('keyup', swallow, true);
    return () => {
      window.removeEventListener('keydown', swallow, true);
      window.removeEventListener('keyup', swallow, true);
    };
  }, [isMenuOpen]);

  return (
    <div className="app">
      <header className="app__header">
        <button
          type="button"
          className="app__menu-toggle"
          aria-expanded={isMenuOpen}
          aria-controls="app-menu"
          aria-label={isMenuOpen ? strings.nav.closeMenu : strings.nav.openMenu}
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span aria-hidden="true">☰</span>
        </button>

        <h1 className="app__title">
          {strings.appName}
          <span className="app__route">{strings.nav[route]}</span>
        </h1>

        <span className="app__version">v{__APP_VERSION__}</span>
      </header>

      {isMenuOpen ? (
        <>
          <button
            type="button"
            className="app__scrim"
            aria-label={strings.nav.closeMenu}
            onClick={() => setMenuOpen(false)}
          />
          <nav id="app-menu" className="app__menu">
            {ROUTES.map((target) => (
              <button
                key={target}
                type="button"
                className={route === target ? 'is-active' : ''}
                aria-current={route === target ? 'page' : undefined}
                onClick={() => {
                  navigate(target);
                  setMenuOpen(false);
                }}
              >
                {strings.nav[target]}
              </button>
            ))}
          </nav>
        </>
      ) : null}

      <Fragment key={generation}>
        {route === 'timer' ? <TimerScreen /> : null}
        {route === 'history' ? <HistoryScreen /> : null}
        {route === 'stats' ? <StatsScreen /> : null}
        {route === 'sessions' ? <SessionsScreen /> : null}
        {route === 'trainer' ? <TrainerScreen /> : null}
        {route === 'settings' ? <SettingsScreen /> : null}
        {route === 'data' ? <DataScreen /> : null}
      </Fragment>

      <ErrorBanner />
      <UpdatePrompt />
    </div>
  );
}
