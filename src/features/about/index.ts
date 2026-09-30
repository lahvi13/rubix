import { lazy } from 'react';

// Loaded when first opened; see the Suspense in app/App.tsx.
export const AboutScreen = lazy(() =>
  import('./components/AboutScreen').then((module) => ({ default: module.AboutScreen })),
);
export { InstallNudge } from './components/InstallNudge';
