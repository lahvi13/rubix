import { lazy } from 'react';

// Loaded when first opened; see the Suspense in app/App.tsx.
export const DataScreen = lazy(() =>
  import('./components/DataScreen').then((module) => ({ default: module.DataScreen })),
);
export { BackupReminder } from './components/BackupReminder';
