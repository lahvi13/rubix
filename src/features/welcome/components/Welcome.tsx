import { lazy, Suspense } from 'react';
import { useWelcome } from '../hooks/use-welcome';

// Asked once in an install's life: nobody else pays for the sheet.
const WelcomeSheet = lazy(() =>
  import('./WelcomeSheet').then((module) => ({ default: module.WelcomeSheet })),
);

/** The welcome, when there is one to give; nothing at all otherwise. */
export function Welcome() {
  const welcome = useWelcome();
  if (!welcome.isShown) return null;
  return (
    <Suspense fallback={null}>
      <WelcomeSheet onAnswer={welcome.answer} onSkip={welcome.skip} />
    </Suspense>
  );
}
