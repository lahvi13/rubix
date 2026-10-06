import { lazy } from 'react';

// Loaded when first opened; see the Suspense in app/App.tsx.
export const TrainerScreen = lazy(() =>
  import('./components/TrainerScreen').then((module) => ({ default: module.TrainerScreen })),
);
export const DrillScreen = lazy(() =>
  import('./components/DrillScreen').then((module) => ({ default: module.DrillScreen })),
);

/**
 * Lent to whoever else has a case to show. The beginner's guide walks some of
 * the same cases in a different order, and a case has to look and behave the
 * same wherever it is met: the same picture, the same sheet, the same triggers.
 */
export { CaseCard } from './components/CaseCard';
export { CaseDetail } from './components/CaseDetail';
export { CasePlayer } from './components/CasePlayer';
export { AlgText } from './components/AlgText';
export { NotationReference } from './components/NotationReference';
export { diagramFor, type Diagram } from './case-view';
export { useSetCases, type CaseGroup, type TrainerCase } from './hooks/use-alg-cases';
export { useTriggers } from './hooks/use-triggers';
