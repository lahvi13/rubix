import { HistoryScreen } from '../features/history';
import { SessionsScreen } from '../features/sessions';
import { StatsScreen } from '../features/stats';
import { TimerScreen } from '../features/timer';
import { strings } from '../lib/strings';
import { ROUTES, navigate, useRoute } from './router';
import { ErrorBanner } from './ErrorBanner';
import { UpdatePrompt } from './UpdatePrompt';

export function App() {
  const route = useRoute();

  return (
    <div className="app">
      <header className="app__header">
        <h1 className="app__title">
          {strings.appName} <span className="app__version">v{__APP_VERSION__}</span>
        </h1>
        <nav className="app__nav">
          {ROUTES.map((target) => (
            <button
              key={target}
              type="button"
              className={route === target ? 'is-active' : ''}
              onClick={() => navigate(target)}
            >
              {strings.nav[target]}
            </button>
          ))}
        </nav>
      </header>

      {route === 'timer' ? <TimerScreen /> : null}
      {route === 'history' ? <HistoryScreen /> : null}
      {route === 'stats' ? <StatsScreen /> : null}
      {route === 'sessions' ? <SessionsScreen /> : null}

      <ErrorBanner />
      <UpdatePrompt />
    </div>
  );
}
