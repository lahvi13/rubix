import { Fragment, Suspense, useState } from 'react';
import { AboutScreen } from '../features/about';
import { DataScreen } from '../features/data-transfer';
import { HistoryScreen } from '../features/history';
import { LearnScreen } from '../features/learn';
import { SettingsScreen } from '../features/settings';
import { StatsScreen } from '../features/stats';
import { TimerScreen } from '../features/timer';
import { DrillScreen, TrainerScreen } from '../features/trainer';
import { HeaderSlotContext } from '../components/header-slot-context';
import { useDatabaseGeneration } from '../hooks/use-database-health';
import { useKeyCapture } from '../hooks/use-key-capture';
import { useSetting } from '../hooks/use-setting';
import { useAppearance } from '../hooks/use-appearance';
import { strings } from '../lib/strings';
import { ROUTES, navigate, useRoute } from './router';
import { useScrollMemory } from './use-scroll-memory';
import { useSharedScrambleLink } from './use-shared-scramble-link';
import { ErrorBanner } from './ErrorBanner';
import { UndoBar } from './UndoBar';
import { UpdatePrompt } from './UpdatePrompt';

export function App() {
  const route = useRoute();
  useScrollMemory(route);
  useSharedScrambleLink();
  const [isMenuOpen, setMenuOpen] = useState(false);
  const [headerSlot, setHeaderSlot] = useState<HTMLDivElement | null>(null);
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
        <div className="app__header-slot" ref={setHeaderSlot} />

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
                <Fragment key={target}>
                  {/* Set apart: it is about the app, not a place to use it. */}
                  {target === 'about' ? <hr className="app__menu-rule" /> : null}
                  <button
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
                </Fragment>
              ))}
            </nav>
          </>
        ) : null}
      </header>

      <Fragment key={generation}>
        <HeaderSlotContext.Provider value={headerSlot}>
        {/* Every screen but the timer is its own chunk, loaded the first time
            it is opened: the timer is where the app starts, and on a phone
            the first load pays for everything in it. The service worker has
            the chunks cached, so the blank moment is a frame, not a wait. */}
        <Suspense fallback={null}>
        {route === 'timer' ? <TimerScreen /> : null}
        {route === 'learn' ? <LearnScreen /> : null}
        {route === 'history' ? <HistoryScreen /> : null}
        {route === 'stats' ? <StatsScreen /> : null}
        {route === 'trainer' ? <TrainerScreen /> : null}
        {route === 'drill' ? <DrillScreen /> : null}
        {route === 'settings' ? <SettingsScreen /> : null}
        {route === 'data' ? <DataScreen /> : null}
        {route === 'about' ? <AboutScreen /> : null}
        </Suspense>
        </HeaderSlotContext.Provider>
      </Fragment>

      <ErrorBanner />
      <UndoBar />
      <UpdatePrompt />
    </div>
  );
}
