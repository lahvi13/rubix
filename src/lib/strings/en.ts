/**
 * All user-facing copy, in the language the rest of the repo is written in.
 * The Czech translation in `cs.ts` is typed against this object, so a key
 * added here and forgotten there fails the build; `index.ts` picks between
 * the two once, at startup.
 */

import type { Translated } from './types';

export const en = {
  appName: 'Rubix',
  common: {
    dismiss: 'Dismiss',
  },
  scramble: {
    label: 'Scramble',
    loading: 'Generating scramble…',
    failed: 'Scramble failed — tap to retry',
    next: 'New scramble',
    replay: 'Watch the scramble',
    showPicture: 'Back to the picture',
    showPreview: 'Show preview',
    hidePreview: 'Hide preview',
    edit: (scramble: string) => `Change the scramble: ${scramble}`,
    field: 'Scramble to solve',
    hint: 'Type or paste your own — from a competition, say. It is used for one solve, then the scrambles are random again.',
    invalid: "Not a scramble — write moves like R U' F2.",
    use: 'Use it',
    own: 'Your own scramble',
    fromHistory: 'Scramble from the history',
    unpin: 'Back to a random scramble',
  },
  timer: {
    holdToStart: 'Hold to start',
    holdToStartInspection: 'Hold, then release to start',
    releaseToStart: 'Release to start',
    releaseToInspect: 'Release to inspect',
    inspectionHint: 'Tap to inspect',
    /* The same hints where the timer runs on the space bar. */
    keys: {
      holdToStart: 'Hold Space to start',
      holdToStartInspection: 'Hold Space, then release to start',
      inspectionHint: 'Press Space to inspect',
      tapToEndPhase: 'Space ends the phase · hold to finish',
    },
    /* Said where the hint lives, because the clock refusing to start is
       otherwise indistinguishable from the clock being broken. */
    locked: 'Answer shown — Next case to go again',
    /*
     * Two switches share the panel's heading with the session name and the
     * count, and at the largest text size the words push each other onto a
     * line of their own. Abbreviated for the eye there and nowhere else; the
     * full word is what a screen reader is given, and what the settings and
     * the drill print, where the line is not fighting anything for width.
     */
    inspectionToggle: 'Insp',
    inspectionToggleLabel: 'Inspection',
    cancelled: 'Attempt discarded',
    phaseToggle: 'Phase',
    phaseToggleLabel: 'Phases',
    tapToEndPhase: 'Tap to end · hold to finish',
    releaseToFinish: 'Release to finish',
    /* Where the time would be, with the clock set to show none while solving. */
    solving: 'Solving',
    /*
     * What the time that has just landed is worth, said in the line the hint
     * leaves empty once a solve is over. The wording is the history's, so the
     * same achievement is not called two different things on two screens.
     */
    recordPb: 'Personal best',
    recordSession: 'Session best',
    recordPhases: (phases: string) => `Best ${phases}`,
    /** Between the names of phases that were all best on the same solve. */
    recordPhaseJoin: ' · ',
    /*
     * Beside a beaten goal, in place of the records' star: a goal within reach
     * is beaten often, and it must not be mistaken for the rarer thing.
     */
    goalMark: '✓',
  },
  splits: {
    bestPhase: (phase: string) => `Best ${phase} of this session`,
    title: 'Phases',
    phaseAverages: 'Phase averages',
    phaseTrend: 'Phase trend',
    best: 'Best',
    total: 'Total',
    all: 'All',
    length: 'Length',
    endsAtColumn: 'Ends at',
    endsAt: 'ends at',
    endsAtStop: 'at the stop',
    addSplit: 'Add',
    removeSplit: 'Remove',
    clear: 'Clear phase times',
    none: 'This solve was timed as a whole.',
    /** Both counts, because the two differ and the difference is the point. */
    measuredNote: (measured: number, total: number) =>
      `${measured} of ${total} solves were timed by phase; the rest were timed as a whole.`,
    trendAxes: (count: number) =>
      `Along the bottom: the last ${count} phase-timed solves, oldest first.`,
    smoothing: 'Smooth',
    /** Under the chart, where there is room to say why. */
    smoothingOn:
      'Smoothed: each point is the mean of that solve and the four before it, so one lucky or slow solve does not jump out.',
    /** In the readout, which has to stay narrow enough for a phone. */
    smoothingTooltip: 'Mean of this solve and the four before it.',
    smoothingOff: 'Each solve as it was timed.',
    modeStacked: 'Stacked',
    modeSeparate: 'Separate',
    modeShare: 'Share',
    modeStackedNote: 'Phases stacked, so the height is the whole solve.',
    modeSeparateNote: 'Each phase from zero, so one phase can be followed on its own.',
    modeShareNote: 'Each phase as a percentage of the solve, whatever the total was.',
  },
  solve: {
    expandList: 'More solves',
    collapseList: 'Back to the timer',
    plusTwo: '+2',
    dnf: 'DNF',
    delete: 'Delete',
    /* What the delete button says once it is armed and one more tap will do it. */
    confirmDelete: 'Delete?',
    confirmDeleteLabel: 'Delete this solve — tap again to confirm',
    empty: 'No solves yet. Hold to start.',
    emptyKeys: 'No solves yet. Hold Space to start.',
    autoPenalty: 'from inspection',
  },
  undo: {
    action: 'Undo',
    deleted: (count: number) => (count === 1 ? 'Solve deleted.' : `${count} solves deleted.`),
    restoring: 'Putting the solves back',
    putBack: 'Putting it back',
    tagDeleted: (name: string) => `Tag “${name}” deleted.`,
    sessionDeleted: (name: string, solves: number) =>
      solves === 0
        ? `Session “${name}” deleted.`
        : `Session “${name}” deleted, with ${solves} ${solves === 1 ? 'solve' : 'solves'}.`,
    moved: (count: number, session: string) =>
      count === 1 ? `Solve moved to ${session}.` : `${count} solves moved to ${session}.`,
  },
  sheet: {
    previous: 'Previous',
    next: 'Next',
    position: (at: number, total: number) => `${at} / ${total}`,
  },
  nav: {
    timer: 'Timer',
    history: 'History',
    stats: 'Stats',
    learn: 'Learn',
    trainer: 'Trainer',
    drill: 'Drill',
    settings: 'Settings',
    data: 'Data',
    about: 'About',
    openMenu: 'Open menu',
    closeMenu: 'Close menu',
  },
  stats: {
    empty: 'No solves in this session yet.',
    emptyAll: 'No solves yet.',
    scope: 'Which solves',
    allSessions: 'All sessions',
    thisSession: 'This session',
    recent: (count: number) => `Last ${count}`,
    solvesOf: (read: number, total: number) => `Last ${read} of ${total} solves`,
    bestSingle: 'Best single',
    recentBest: (count: number) => `Best of last ${count}`,
    solves: 'solves',
    averages: 'Averages',
    current: 'Current',
    best: 'Best',
    pbSingle: 'PB single',
    sessionBest: 'Session best',
    mean: 'Mean',
    median: 'Median',
    stdDev: 'Std dev',
    dnfRate: 'DNF rate',
    plusTwoRate: '+2 rate',
    distribution: 'Time distribution',
    trend: 'Trend',
    bySolve: 'Rolling ao12',
    byDay: 'By day',
    trendNeedsSolves: 'The rolling ao12 starts at the twelfth solve.',
    dailyMean: 'Mean',
    dailyBest: 'Best',
    solvesLabel: 'Solves',
    dailyAxes:
      'Each point is a day you practised: the line is its mean, the dot its best solve. The bottom counts calendar days, so a break shows as a stretch with no points.',
    practice: 'Practice',
    /** The section links under the header; short, so the row fits a phone. */
    sections: 'Sections',
    navDistribution: 'Distribution',
    toTop: 'Back to the top',
    toTopMark: '↑',
    streak: 'Streak',
    dayCount: (count: number) => (count === 1 ? '1 day' : `${count} days`),
    daysPractised: 'Days practised',
    solvesInDays: (days: number) => `Solves in ${days} days`,
    daysOf: (active: number, total: number) => `${active} of ${total}`,
    practiceNote: (days: number) => `Solves per day over the last ${days} days.`,
    trendSeries: 'ao12',
    singleSeries: 'Single',
    windowTitle: (at: 'current' | 'best' | object, n: number) =>
      at === 'best' ? `Best ao${n}` : at === 'current' ? `Current ao${n}` : `ao${n}`,
    /** Why the average is not the plain mean of the times listed under it. */
    windowTrimNote: (trim: number) =>
      trim === 1
        ? 'The fastest and the slowest solve are cut (in brackets); the average is the mean of the rest.'
        : `The ${trim} fastest and ${trim} slowest solves are cut (in brackets); the average is the mean of the rest.`,
    windowDnfNote: 'More DNFs than the trim can cut, so the average is a DNF.',
    trimmed: 'not counted',
    goal: 'Goal',
    goalHint: 'Pick a time to chase, and see how often you beat it.',
    goalFormat: 'Minutes and seconds as 1:30, or 1 30 where the keyboard has no colon.',
    goalSet: 'Set a goal',
    goalTime: 'Goal time',
    goalPlaceholder: '1:30',
    goalSave: 'Save',
    goalCancel: 'Cancel',
    goalChange: 'Change',
    goalRemove: 'Remove',
    goalName: (time: string) => `Sub ${time}`,
    goalRecent: (count: number) => `Last ${count} solves`,
    goalAll: (count: number) => `All ${count} solves`,
    goalSeries: 'Goal',
    records: 'Records',
    recordKind: 'Which record',
    noRecords: (n: number) => (n === 1 ? 'No records yet.' : `No ao${n} yet — it takes ${n} solves.`),
    /** In place of the gain on the first record, which beat nothing. */
    firstRecord: 'first',
    allRecords: (count: number) => `Show all ${count}`,
    fewerRecords: 'Show fewer',
    histogramSeries: 'Solves',
    loadingCharts: 'Loading charts…',
    penalties: 'Penalties',
    dnfShort: 'DNF',
    plusTwoShort: '+2',
    solveIndex: 'Solve',
    /** Axis captions, so a chart can be read without the table above it. */
    distributionAxes: 'Each bar is a range of solve times; height is how many solves fell in it.',
    trendAxes:
      'The line is the average of the twelve solves ending at each point; the dots are the solves themselves, oldest first.',
    andUp: 'and up',
    bestAo12: 'Best ao12',
    containsCurrent: 'Current ao12 falls here',
    touchBar: 'Touch a bar to see its range and count.',
  },
  history: {
    empty: 'Nothing matches these filters.',
    noSolves: 'No solves in this session yet.',
    loadMore: 'Load more',
    detailTitle: 'Solve detail',
    solveAgain: 'Solve this scramble again',
    close: 'Close',
    rawTime: 'Time',
    invalidTime: 'Use 12.34 or 1:23.45 — or 1 23.45, without the colon',
    /** A record's mark. Never the reader's own — that one is the flag. */
    star: '★',
    /** The reader's own mark, so that it cannot be read as a record. */
    mark: '⚑',
    marked: 'Marked',
    /** Said on the row when the solve carries a note. */
    noteMark: '✎',
    hasNote: 'Has a note',
    personalBest: 'Personal best',
    sessionBest: 'Best of this session',
    tags: 'Tags',
    newTag: 'New tag',
    note: 'Note',
    inspection: 'inspection',
    edited: 'edited',
    select: 'Select solve',
    startSelecting: 'Select',
    stopSelecting: 'Done',
    selected: (count: number) => `${count} selected`,
    /** How many a filter let through, out of the whole session. */
    matchedOf: (matched: number, total: number) => `${matched} of ${total}`,
    deleteSelected: 'Delete',
    moveTo: 'Move to…',
    moveTitle: 'Move to session',
    filterBy: 'Filter by',
    penaltyLabel: 'Penalty',
    markSolve: 'Mark solve',
    filterMarked: 'Filter marked',
    filterRecords: 'Filter records',
    filterDay: 'Filter by day',
    days: 'Days',
    today: 'Today',
    yesterday: 'Yesterday',
    allDays: 'All days',
    noDays: 'Nothing has been timed into this session yet.',
    editTags: 'Edit tags',
    tagName: 'Tag name',
    noTags: 'No tags yet. A tag made here can be put on any solve.',
    /** Said next to a delete, so it reads as what would be stripped. */
    tagOnSolves: (count: number) => `on ${count} ${count === 1 ? 'solve' : 'solves'}`,
  },
  sessions: {
    /* Written into the first session on a device, and only there: it is data
       from that moment on, and a device set up in another language keeps the
       name it was given. */
    defaultName: 'Default',
    title: 'Sessions',
    /** Written before the name, so the name reads as a session and as a button. */
    label: 'Session',
    create: 'Create',
    switchSession: 'Switch session',
    /** The one being timed into. A label on the row, not a button. */
    activeBadge: 'active',
    solveCount: (count: number) => `${count} ${count === 1 ? 'solve' : 'solves'}`,
    rename: 'Rename',
    archive: 'Archive',
    restore: 'Restore',
    showArchived: 'Show archived',
    /** Shown when a destination is asked for and this is the only session. */
    noOther: 'There is no other session.',
    /** Archiving is the reversible one; this is not, and says so first. */
    deleteWarning: (count: number) =>
      count === 0
        ? 'This session has no solves in it.'
        : `Deleting takes ${count} ${count === 1 ? 'solve' : 'solves'} with it, out of the`
          + ' averages and out of the personal best.',
    confirmDelete: 'Delete session',
    cancel: 'Cancel',
    namePlaceholder: 'New session name',
  },
  learn: {
    intro:
      'Seven steps from a scrambled cube to a solved one. A faster method keeps the cross and joins the rest in pairs: steps 2 and 3 become F2L, 4 and 5 OLL, 6 and 7 PLL. The pictures hold the cube the way the trainer does: the cross on the bottom, the last layer on top.',
    explanations: 'Explanations',
    stepsNav: 'Steps',
    hide: 'Hide this guide from the menu',
    hideHint: 'Once you can solve a cube without reading, take this out of the menu. Settings puts it back.',
    source: 'The method and the order of its steps follow the beginner guide at',
    sourceLink: 'badmephisto.com',
    loading: 'Loading the cases…',
    crossCaption: 'A finished cross: an edge under every centre whose colour it shares.',
    showCases: 'Every case, one algorithm each',
    hideCases: 'Back to the one algorithm',
    steps: {
      cross: {
        title: 'Cross',
        text:
          'The cross is four edges of the bottom colour, white here. Start with the white centre facing down (D).\n\n'
          + 'Each white edge has to reach the bottom with its other colour matching the centre beside it. No algorithm helps here: bring a white edge up to the top layer (U), turn the top until its side colour is over the matching centre, and take it down with two turns of that side.\n\n'
          + 'Every later step assumes a correct cross, so do not rush it — move on once you can build it without thinking.',
      },
      corners: {
        title: 'Bottom layer corners',
        text:
          'Next come the four white corners. Each corner wears three colours and belongs in the gap between the three centres of those colours.\n\n'
          + 'Find a white corner in the top layer and turn the top (U) until it sits right above its gap (its slot). Then look where its white sticker points — right, front or up — and use the algorithm that goes with it. All three are just below.\n\n'
          + 'A corner already at the bottom but twisted, or in the wrong slot, has to come up first: run any of the three algorithms on it.',
      },
      middle: {
        title: 'Middle layer edges',
        text:
          'Four middle-layer edges are left. Look in the top layer for an edge with no yellow on it — every such edge belongs in the middle.\n\n'
          + 'Turn the top (U) until the edge is on the right, its side colour matching the right centre. Then look at the colour facing up: it says whether the edge goes into the front slot or the back one. Both algorithms are below.\n\n'
          + 'An edge already in the middle layer but flipped, or in the wrong slot, has to come up first: hold the cube with that slot on the right and run either algorithm.\n\n'
          + 'That is the first two layers done — steps 2 and 3 together are what is called F2L. A faster method joins them into one, and the trainer has it under that name.',
      },
      edgeOrientation: {
        title: 'Last layer cross',
        text:
          'The bottom two layers are done; from here on only the top one is being solved. First comes the yellow cross — and all that matters is where the yellow is, not whether the pieces are in their places.\n\n'
          + 'Look at the yellow stickers on top and find yours among the pictures below: a line (I), an L, or just the dot. Hold the cube as the picture shows and run the algorithm under it. For the dot, run both one after the other, exactly as written there.\n\n'
          + 'The lower-case f in the second algorithm is not a typo. A capital F turns only the front face; a lower-case f turns the front face and the middle layer behind it — two layers at once. The whole notation is under the Notation button at the top.',
      },
      cornerOrientation: {
        title: 'Last layer face',
        text:
          'The whole top face is left, and one algorithm is enough for it. Run it, look again, and run it again if needed — you will never need it more than three times.\n\n'
          + 'How to hold the cube depends on how many corners already show yellow; all three possibilities are in the pictures below. The button then has the seven cases, each done in a single go.\n\n'
          + 'Steps 4 and 5 together are OLL, orienting the last layer. Done in two looks like this, they are in the trainer under 2-Look OLL.',
      },
      cornerPermutation: {
        title: 'Corners home',
        text:
          'The yellow face is done, but the pieces are not in their places yet. Now they go home, corners first.\n\n'
          + 'Look at the cube from every side for headlights — two corners on one side showing the same colour. Turn the whole cube so the headlights are at the back, as the pictures below show. The edges stay exactly where they are.',
      },
      edgePermutation: {
        title: 'Edges home',
        text:
          'Only the edges are left. Turn the top (U) until one side is a solid block of colour — that side is finished. Then turn the whole cube so that side is at the back, and the other three edges go round it.\n\n'
          + 'No corner moves while they do. Once the last edge is round, the cube is solved.\n\n'
          + 'Steps 6 and 7 together are PLL, permuting the last layer — putting every piece where it belongs. The trainer has them under 2-Look PLL.',
      },
    },
    holds: {
      oneOriented:
        'One corner already showing the top colour: put it at the front left. This is the case the algorithm ends on its own.',
      twoOriented:
        'Two already showing: turn the top until the top-colour sticker of the front-left corner faces you.',
      noneOriented:
        'None showing yet: turn the top until the top-colour sticker of the front-left corner faces left.',
      headlights: 'Headlights at the back: the other three corners go round into place.',
      noHeadlights:
        'No headlights on any side: run it once from any angle and you will have some.',
      oneSide: 'The finished side at the back: the other three edges go round.',
      noSide: 'No side a solid colour: run it once from any angle and one will be.',
    },
  },
  trainer: {
    progress: { new: 'New', learning: 'Learning', known: 'Known' },
    progressLabel: 'How well you know it',
    progressKnown: (known: number, total: number) => `Known ${known} of ${total}`,
    progressLearning: (count: number) => `learning ${count}`,
    empty: 'No algorithm sets yet.',
    loading: 'Loading the cases…',
    twoLook: '2-Look',
    fullSet: 'Full',
    /* How far into F2L the screen is. Named for what the cases are, not for
       how good you are meant to be: the basic set is the one where every other
       slot is already built. */
    levelBasic: 'Basic',
    levelAdvanced: 'Advanced',
    levelExpert: 'Expert',
    play: 'Play',
    stop: 'Stop',
    loadingPlayer: 'Loading the cube…',
    variants: 'Algorithms',
    packAlg: 'built in',
    packAlgGrip: 'built in · turned',
    packAlgOther: 'built in · another way',
    /* Said as a cost rather than a warning: it is a real solution, often the
       shortest one, and it is only wrong if the slot it breaks was built. */
    packAlgSlot: 'built in · breaks another slot',
    /* Not a fault: orienting is all an OLL algorithm owes. Said because every
       other algorithm in the app hands back a solved cube and this one will
       not, which is a surprise worth heading off. */
    packAlgOrient: 'built in · orients only',
    /* What a dot on a card means, for whoever cannot see the dot. Written as a
       phrase that finishes the case's name, because that is where it lands. */
    markOwn: 'your own algorithm',
    markCostsSlot: 'breaks another slot',
    ownAlg: 'yours',
    ownAlgPlaceholder: "Your own algorithm, e.g. R U R' U'",
    addAlg: 'Add',
    invalidAlg: 'That is not a move sequence I can read.',
    editAlg: 'Edit',
    saveAlg: 'Save',
    cancelEdit: 'Cancel',
    /* Said while a built-in algorithm sits in the box, because saving it adds
       a new one rather than changing the pack's. */
    editPackHint: 'The built-in one stays as it is; your edit is added as your own.',
    notation: 'Notation',
    notationHint: 'Each picture is a solved cube after that one move.',
    triggers: 'Triggers',
    /* Said where the delete button would be, so its absence reads as a rule
       rather than as something missing. */
    triggerBuiltIn: 'Built in — switch it off with the tick rather than deleting it.',
    triggersHint:
      'Sequences highlighted inside an algorithm. Edit a built-in one and it becomes yours — updates leave it alone from then on.',
    triggerName: 'Name',
    triggerMoves: 'Moves',
    triggerEnabled: 'Highlight',
    triggerColour: 'Colour',
    addTrigger: 'Add trigger',
    chooseAlgorithm: 'Choosing the algorithm',
    removeAlgorithm: 'Removing the algorithm',
    addAlgorithm: 'Adding the algorithm',
    saveAlgorithm: 'Saving the algorithm',
    drillSet: 'Drill this set',
    caseStats: 'Your drills',
    rename: 'Your name for it',
    renamePlaceholder: 'e.g. Fat Antisune',
    renameHint:
      'Shown instead of the pack name everywhere in the trainer. Leave it empty to go back to the pack name — that one stays as it is, because it is the name every chart out there uses.',
    renameSave: 'Save',
    renaming: 'Renaming the case',
  },
  drill: {
    pool: 'Cases',
    poolAll: 'All',
    poolSlowest: 'Slowest 10',
    poolLearning: "What I'm learning",
    poolHint: 'Tick the cases to drill. Nothing ticked means the whole set.',
    poolDone: 'Done',
    caseHint: 'Perform it, then hold to start.',
    caseHintKeys: 'Perform it, then hold Space to start.',
    /*
     * The one instruction that has to be right, because the drill's whole
     * shape rests on it: what these moves are performed on is a cube whose
     * cross is solved, not one that is solved. That is the state every attempt
     * leaves behind, so the next one carries straight on from it and nobody
     * has to rebuild a cube between reps. Said in words as well as drawn,
     * because the picture beside it can be switched off in the settings.
     */
    crossHint:
      'Hold the cube cross face down, perform it, and hold to start. The cross never leaves the bottom.',
    crossHintKeys:
      'Hold the cube cross face down, perform it, and hold Space to start. The cross never leaves the bottom.',
    /* Shown once, where somebody arriving at the drill will read it. */
    crossFirst:
      'Solve the cross first — after that every scramble carries on from where the last one left you, so there is never a cube to rebuild.',
    crossSetup: 'The cross after the scramble, as you will hold it',
    showCase: 'Show me',
    /* A looked-up case is stored as a DNF and never timed: the clock locks
       the moment the answer appears. */
    gaveUp: 'Looked up, so it counts as a DNF.',
    next: 'Next case',
    empty: 'Nothing to drill in this set.',
    attempts: 'Attempts',
    /** The set's tally, where the number is read as part of the words. */
    attemptCount: (count: number) => `${count} ${count === 1 ? 'attempt' : 'attempts'}`,
    last: 'Last',
    noAttempts: 'First time on this case.',
    judging: 'Changing the penalty',
    discarding: 'Discarding the attempt',
    attemptsTitle: 'Attempts',
    deleteAll: 'Delete all',
    deleteAllConfirm: 'Delete them all?',
    noneYet: 'Nothing drilled here yet.',
    needsWork: 'Needs work',
    crossSolution: 'Shortest cross',
    crossMoves: (count: number) => `${count} ${count === 1 ? 'move' : 'moves'}`,
    crossSolved: 'The cross is already done.',
    crossWatch: 'Watch it',
    crossWatchAgain: 'Watch again',
    /* Names the list for a screen reader; on screen its place under the
       solution says what it is. */
    crossAlternatives: 'Other solutions of the same length',
    crossFront: 'In front:',
    crossFrontHint: 'Tap the side you keep towards you, cross face down.',
    /*
     * Named for the sides of a cube held cross down, which is how it is held
     * for the whole drill. Turning a standard cube cross-down swaps the poles'
     * neighbours, so red is on the left and orange on the right.
     */
    crossColours: { F: 'Green', R: 'Orange', B: 'Blue', L: 'Red' },
    modes: 'What to drill',
    modeSolve: 'Solve it',
    modeRecognise: 'Name it',
    nothingToName: 'The cross has no case to name',
    /* Named for what is behind the line, because the line itself is the answer. */
    setup: 'Change what is drilled',
    inspectionOn: 'Inspection on',
    inspectionOff: 'Inspection off',
  },
  recognition: {
    question: 'Which case is this?',
    /* Two words on a phone: the button sits under a picture that explains it. */
    turn: 'Turn round',
    turnBack: 'Turn back',
    turnedHint: 'Seen from the back left.',
    correct: 'Right',
    wrong: 'No — it was',
    next: 'Next case',
    tooFew: 'Tick at least two cases: with one there is nothing to tell apart.',
    empty: 'Nothing to recognise in this set.',
    caseStats: 'Your recognition',
    saving: 'Saving the attempt',
    forgetting: 'Clearing the recognition attempts',
    forget: 'Clear',
    hint: 'The top and two sides, as you would see them mid-solve.',
    aufHint: 'The turn this angle needs before the algorithm — not part of it.',
  },
  settings: {
    appearance: 'Appearance',
    /* Each language is named in itself, which is how somebody who cannot
       read the other one finds their own. */
    language: 'Language',
    languageCs: 'Čeština',
    languageEn: 'English',
    languageHint: 'Switching the language reloads the app. Nothing you have timed changes.',
    theme: 'Theme',
    themeSystem: 'System',
    themeLight: 'Light',
    themeDark: 'Dark',
    themeHint: 'System follows what the phone or the browser is set to.',
    font: 'Typeface',
    fontSans: 'Sans',
    fontMono: 'Mono',
    fontSystem: 'System',
    fontHint:
      'Inter and JetBrains Mono ship with the app, so they look the same on every device. System uses the one the device came with. Scrambles and algorithms stay monospaced either way.',
    textSize: 'Text size',
    clockSize: 'Clock size',
    clockSizeHint: 'The running time on the timer and the drill, which is read from further away.',
    clockFace: 'Clock face',
    clockFaceMatch: 'App',
    clockFaceMono: 'Mono',
    clockFaceDigital: 'Digital',
    clockFaceHint: 'Digital is the seven-segment face a stopwatch has.',
    sizeSmall: 'Small',
    sizeMedium: 'Medium',
    sizeLarge: 'Large',
    skin: 'Colours',
    skinHint: 'Colours for every case diagram in the app.',
    /* Named by id rather than in the skin itself: a palette is data, its name
       is copy, and only one of the two changes with the language. */
    skins: {
      classic: 'Classic',
      contrast: 'High contrast',
      pastel: 'Pastel',
      accessible: 'Colour-blind friendly',
    },
    twistyMode: 'Cube preview',
    previewFlat: 'Flat',
    preview3d: '3D',
    twistyModeHint:
      'Both are drawn here in your colours: flat as an unfolded net, 3D as a cube seen from a corner. Watching the scramble hands over to the animated cube from cubing.js, which paints its own colours.',
    timer: 'Timer',
    holdThreshold: 'Hold to start',
    holdOff: 'Off',
    showScramblePreview: 'Show the cube below the scramble',
    runningDisplay: 'Time while solving',
    runningHundredths: '0.00',
    runningTenths: '0.0',
    runningSeconds: '0',
    runningHidden: 'Hidden',
    runningDisplayHint:
      'Only what the clock shows while it runs. Every solve is still timed to the hundredth and shown in full when it stops.',
    splitMode: 'Time solves by phase (4 phases)',
    splitModeHint:
      'A tap ends the phase in progress and starts the next one; the last phase stops the clock. Hold a tap to finish a solve early when a phase was skipped.',
    trainer: 'Trainer',
    twoLookDefault: 'Open OLL and PLL on',
    showAlgs: 'Show algorithms on the case list',
    showLearn: "Show the beginner's guide",
    showLearnHint:
      'A walk through one whole solve, in the menu as Learn. Hiding it changes nothing else — the sets it points at stay where they are.',
  },
  data: {
    exportTitle: 'Backup',
    exportHint:
      'Writes every session, solve, tag and setting into one file. Settings that belong to this device, like the theme and the text size, stay here.',
    exportAction: 'Export data',
    exportFailed: 'Could not export the data',
    exportCsvAction: 'Solves as CSV',
    exportCsvHint:
      'One row per solve — time, penalty, scramble, phases — for a spreadsheet. Nothing reads it back, so it is a copy to look at, not a backup.',
    lastBackup: (day: string, size: string | null) =>
      `Last backup: ${day}${size === null ? '' : ` · ${size}`}.`,
    noBackup: 'No backup from this device yet.',
    changedSince: (count: number) =>
      count === 0
        ? 'Nothing has changed since.'
        : `${count} ${count === 1 ? 'solve' : 'solves'} added or changed since.`,
    onlyHere: (count: number) =>
      `${count} ${count === 1 ? 'solve exists' : 'solves exist'} only on this device.`,
    storageKept: 'The browser keeps this data even when the device runs low on space.',
    storageMayClear: 'The browser may clear this data when the device runs low on space.',
    keepStorage: 'Ask the browser to keep it',
    keepStorageRefused:
      'The browser said no. Browsers tend to agree once the app is installed — until then, a backup is the only sure copy.',
    shareBackup: 'Send it somewhere…',
    shareHint: 'Drive, Dropbox, an email to yourself — a copy off this device.',
    shareFailed: 'This device would not share the file. The downloaded copy is still there.',
    exported: 'Backup saved as',
    exportedCsv: 'Solves saved as',
    importTitle: 'Restore',
    importHint: 'Pick an exported file. Nothing is written before you confirm the preview.',
    chooseFile: 'Choose a file',
    fileFrom: 'File from',
    mode: 'Import mode',
    modeMerge: 'Merge',
    modeMergeHint: 'Keeps both sides. For each record the newer version wins, deletions included.',
    modeReplace: 'Replace',
    modeReplaceHint: 'Drops everything on this device and uses the file instead.',
    previewTitle: 'What will change',
    table: 'Table',
    added: 'New',
    updated: 'Updated',
    deleted: 'Deleted',
    nothingToDo: 'The file changes nothing here.',
    confirmImport: 'Import',
    importing: 'Importing…',
    cancel: 'Cancel',
    imported: 'Import finished.',
    importFailed: 'Could not import the file',
    tables: {
      sessions: 'Sessions',
      solves: 'Solves',
      tags: 'Tags',
      methods: 'Methods',
      algSets: 'Alg sets',
      algCases: 'Cases',
      algorithms: 'Algorithms',
      triggers: 'Triggers',
      settings: 'Settings',
      tombstones: 'Deletions',
    },
    problems: {
      notJson: 'That file is not JSON.',
      malformed: 'That file is not a Rubix export.',
      unknownFormat: 'That file is not a Rubix export.',
      unsupportedVersion: 'That file was written by a newer version of Rubix.',
      invalidRow: 'The file is damaged',
    },
    dangerTitle: 'Delete all data',
    dangerHint:
      'Removes every solve, session and setting from this device. There is no undo — export first.',
    deleteAll: 'Delete all data',
    deleteConfirm: 'Delete everything',
    deleteArmed: 'No undo. The button unlocks in a few seconds — export a backup while you wait.',
    deletedAll: 'All data deleted.',
    deleteFailed: 'Could not delete the data',
  },
  backupReminder: {
    sinceBackup: (count: number) => `${count} solves are not in your last backup.`,
    never: (count: number) => `${count} solves exist only on this device, with no backup.`,
    backUp: 'Back up',
    later: 'Not now',
  },
  cstimer: {
    title: 'From csTimer',
    hint: 'Takes a csTimer export: the JSON from Export/Import (csTimer names it .txt) or one session exported as CSV. Every csTimer session arrives as a session of its own — nothing is mixed into the one you are timing into.',
    chooseFile: 'Choose a csTimer file',
    reading: 'Reading the file…',
    /** A CSV holds neither of these, so the import has to decide them. */
    csvNote: (name: string) =>
      `A CSV says neither which puzzle nor which session it came from, so it arrives as a 3×3 session called “${name}”. Its times are only as precise as csTimer displayed them and a +2 is already added into them; the JSON export is the exact one.`,
    found: (solves: number, sessions: number) =>
      `${solves} ${solves === 1 ? 'solve' : 'solves'} in ${sessions} ${sessions === 1 ? 'session' : 'sessions'}`,
    withPhases: (count: number) => `${count} with phase times`,
    /** csTimer allows up to ten phases; this app's method has four. */
    phasesDropped: (count: number) =>
      `${count} timed in another number of phases, so those arrive without them`,
    duplicates: (count: number) => `${count} already here`,
    skippedRows: (count: number) => `${count} ${count === 1 ? 'row' : 'rows'} skipped`,
    nothingNew: 'Every solve in this file is already here.',
    unsupportedTitle: 'Sessions this app has no puzzle for',
    unsupported: (name: string, type: string, solves: number) =>
      `${name} — csTimer calls it ${type}, ${solves} ${solves === 1 ? 'solve' : 'solves'}`,
    session: 'Session',
    puzzle: 'Puzzle',
    newSolves: 'New',
    confirm: 'Import from csTimer',
    importing: (written: number, total: number) => `Importing… ${written} / ${total}`,
    imported: (count: number) =>
      `Imported ${count} ${count === 1 ? 'solve' : 'solves'} from csTimer.`,
    whereToFind:
      'Imported sessions are behind the session name at the top of the timer, the history and the stats — pick one there to see its solves.',
    skippedTitle: 'Rows that were skipped',
    reasons: {
      malformed: 'not a solve csTimer would write',
      unreadableTime: 'the time could not be read',
      unreadablePenalty: 'a penalty this app has no name for',
      unreadableDate: 'the date could not be read',
    },
    problems: {
      notJson: 'That file is neither csTimer JSON nor csTimer CSV.',
      notCsTimer: 'That file is JSON, but not a csTimer export.',
      notCsv: 'That file is not a csTimer CSV export.',
      empty: 'There are no solves in that file.',
      unreadable: 'That file could not be read. Pick it again.',
    },
    failed: 'Could not import the csTimer file',
    importedSession: 'csTimer',
  },
  unsupportedBrowser: {
    title: 'This browser is too old for Rubix',
    message:
      'Update the browser to its latest version and open the page again. On an iPhone or iPad that means iOS 17.5 or newer.',
  },
  share: {
    action: 'Share',
    busy: 'Drawing…',
    single: 'Single',
    failed: 'Could not make the picture',
  },
  errors: {
    saveSolve: 'Could not save the solve',
    drillScramble: 'Drill scramble fell back to the setup',
    noSession: 'No active session',
    database: 'Database unavailable',
    databaseStuck: 'the database stopped answering — reload the app',
    databaseBlocked: 'another window of the app is holding the database — close it and reload',
    notResponding: 'the database did not answer in time — reload the app',
    mainThreadBusy: 'the app was too busy to write it; it will land in a moment',
    databaseSurvey: 'What was stuck',
    seed: 'Could not load the algorithm packs',
    settings: 'Could not read the settings',
    dismiss: 'Dismiss',
    retry: 'Try again',
  },
  diagnostics: {
    title: 'Troubleshooting',
    hint: 'What to try when the app stops reacting to taps or a screen comes up empty.',
    databaseOpen: 'Database connected',
    databaseClosed: 'Database not connected',
    failures: (count: number) =>
      count === 0
        ? 'nothing has failed'
        : `${count} ${count === 1 ? 'failure' : 'failures'} logged`,
    reconnect: 'Reconnect the database',
    survey: 'Check what is stuck',
    reload: 'Reload the app',
    reconnected: 'Reconnected.',
    stillBroken: 'Still not connected — reload the app.',
    recent: 'Recent failures',
    none: 'Nothing has failed on this device.',
    clear: 'Clear the list',
  },
  crash: {
    message: 'Something went wrong — this usually happens after an update.',
    reload: 'Reload',
  },
  update: {
    available: 'A new version is available.',
    reload: 'Reload',
    dismiss: 'Later',
  },
  about: {
    title: 'Rubix',
    what: 'A timer and trainer for the 3×3 cube. It walks you through a first solve step by step, drills the F2L, OLL and PLL cases, and times solves phase by phase to show where the seconds go.',
    who: 'For anybody between their first solved cube and a fast average. No account, no ads, and once opened it works with no connection.',
    scope: 'Only the 3×3 for now — no other puzzles.',
    share: 'Share the app',
    shared: 'Shared.',
    copied: 'Link copied.',
    shareFailed: 'Could not share the link.',
    dataTitle: 'Your data',
    data: 'Solves, sessions and settings are kept on this device and never uploaded. The only copy anywhere else is a backup you make yourself.',
    toData: 'Go to backup',
    analytics:
      'The site counts page views with Cloudflare Web Analytics — no solves, no cookies, nothing that tells one device from another.',
    versionTitle: 'Version',
    version: (version: string) => `Rubix ${version}`,
    checkUpdates: 'Check for updates',
    checking: 'Checking…',
    updateCurrent: 'This is the latest version.',
    updateReady: 'A new version is ready — reload from the bar below.',
    updateOffline: 'The server could not be reached. Try again when online.',
    updateUnavailable: 'Nothing to update here: this browser loads the latest version every time.',
    contactTitle: 'Contact',
    contact: 'A question, a bug or an idea:',
    creditsTitle: 'Thanks',
    creditAlgs: 'Most of the algorithms come from J Perm —',
    creditMethod: 'The beginner method follows badmephisto —',
    creditCubing: 'Scrambles and the 3D cube are cubing.js —',
    creditClaude: 'Built together with Claude Code —',
    creditFonts: 'Set in Inter, JetBrains Mono and DSEG7, all under the SIL Open Font License.',
  },
  installNudge: {
    message:
      'Safari clears a site’s data after a week without a visit. Add Rubix to the Home Screen and your solves stay.',
    how: 'Show me how',
    dismiss: 'Got it',
  },
  install: {
    title: 'Install',
    hint: 'Installed, the app opens from the home screen without the browser around it, and it keeps working with no connection at all.',
    action: 'Install the app',
    iosTitle: 'Add to the Home Screen',
    iosSteps:
      'On iPhone and iPad this is done from the share sheet: tap Share at the bottom of Safari, then "Add to Home Screen". Safari gives a page no button to offer instead.',
    iosWhy:
      'Worth doing: an iPhone gives an installed app a far longer memory than a tab, and a tab left unopened can have its solves cleared after a week. Keep a backup either way.',
  },
} as const;

/**
 * What every other language has to fill in. The English object is the source
 * of the shape; `Translated` widens its literals so a translation is free to
 * say anything, in exactly the places English says something.
 */
export type Strings = Translated<typeof en>;
