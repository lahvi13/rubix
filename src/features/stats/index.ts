import { lazy } from 'react';

// Loaded when first opened; see the Suspense in app/App.tsx.
export const StatsScreen = lazy(() =>
  import('./components/StatsScreen').then((module) => ({ default: module.StatsScreen })),
);
export { MiniStats } from './components/MiniStats';
