import { lazy } from 'react';

// Loaded when first opened; see the Suspense in app/App.tsx.
export const HistoryScreen = lazy(() =>
  import('./components/HistoryScreen').then((module) => ({ default: module.HistoryScreen })),
);
export { SolveDetailSheet } from './components/SolveDetailSheet';
