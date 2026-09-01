import { TimerScreen } from '../features/timer';
import { strings } from '../lib/strings';
import { UpdatePrompt } from './UpdatePrompt';

export function App() {
  return (
    <div className="app">
      <header className="app__header">
        <h1 className="app__title">{strings.appName}</h1>
      </header>
      <TimerScreen />
      <UpdatePrompt />
    </div>
  );
}
