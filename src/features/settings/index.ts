import { lazy } from 'react';

// Loaded when first opened; see the Suspense in app/App.tsx.
export const SettingsScreen = lazy(() =>
  import('./components/SettingsScreen').then((module) => ({ default: module.SettingsScreen })),
);
