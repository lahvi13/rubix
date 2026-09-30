import { lazy } from 'react';

// Loaded when first opened; see the Suspense in app/App.tsx.
export const LearnScreen = lazy(() =>
  import('./components/LearnScreen').then((module) => ({ default: module.LearnScreen })),
);
