import { Fragment, useState } from 'react';
import { DataScreen } from '../features/data-transfer';
import { HistoryScreen } from '../features/history';
import { LearnScreen } from '../features/learn';
import { SettingsScreen } from '../features/settings';
import { StatsScreen } from '../features/stats';
import { TimerScreen } from '../features/timer';
import { DrillScreen, TrainerScreen } from '../features/trainer';
import { useDatabaseGeneration } from '../hooks/use-database-health';
import { useKeyCapture } from '../hooks/use-key-capture';
import { useSetting } from '../hooks/use-setting';
import { useAppearance } from '../hooks/use-appearance';
import { strings } from '../lib/strings';
import { ROUTES, navigate, useRoute } from './router';
import { ErrorBanner } from './ErrorBanner';
import { UndoBar } from './UndoBar';
import { UpdatePrompt } from './UpdatePrompt';

export function App() {
  const route = useRoute();
  const [isMenuOpen, setMenuOpen] = useState(false);
  // A screen that lived through a lost connection holds dead live queries; the
  // key mounts it again once the database is back.
  const generation = useDatabaseGeneration();
  const [showLearn] = useSetting('ui.showLearn');
  // Hidden from the menu, not switched off: a bookmark on #/learn is somebody
  // who wants the guide, and hiding it is about a shorter menu, not a lock.
  const menu = ROUTES.filter((target) => target !== 'learn' || showLearn);
  // Applied here because this is the one component that is always mounted.
  useAppearance();

  useKeyCapture(isMenuOpen, () => setMenuOpen(false));

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
        {isMenuOpen ? (
          <>
            <button
              type="button"
              className="app__scrim"
              aria-label={strings.nav.closeMenu}
              onClick={() => setMenuOpen(false)}
            />
            <nav id="app-menu" className="app__menu">
              {menu.map((target) => (
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
      </header>

      <Fragment key={generation}>
        {route === 'timer' ? <TimerScreen /> : null}
        {route === 'learn' ? <LearnScreen /> : null}
        {route === 'history' ? <HistoryScreen /> : null}
        {route === 'stats' ? <StatsScreen /> : null}
        {route === 'trainer' ? <TrainerScreen /> : null}
        {route === 'drill' ? <DrillScreen /> : null}
        {route === 'settings' ? <SettingsScreen /> : null}
        {route === 'data' ? <DataScreen /> : null}
      </Fragment>

      <ErrorBanner />
      <UndoBar />
      <UpdatePrompt />
    </div>
  );
}
