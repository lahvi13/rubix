/**
 * All user-facing copy in one place. English, like everything else in the
 * repo. No i18n layer until there is a second language to justify one.
 */
export const strings = {
  appName: 'Rubix',
  scramble: {
    label: 'Scramble',
    loading: 'Generating scramble…',
    failed: 'Scramble failed — tap to retry',
    next: 'New scramble',
    showPreview: 'Show preview',
    hidePreview: 'Hide preview',
  },
  timer: {
    holdToStart: 'Hold to start',
    holdToStartInspection: 'Hold, then release to start',
    releaseToStart: 'Release to start',
    inspectionHint: 'Press to inspect',
    cancelled: 'Attempt discarded',
  },
  solve: {
    plusTwo: '+2',
    dnf: 'DNF',
    delete: 'Delete',
    empty: 'No solves yet. Hold to start.',
    autoPenalty: 'from inspection',
  },
  update: {
    available: 'A new version is available.',
    reload: 'Reload',
    dismiss: 'Later',
  },
} as const;
