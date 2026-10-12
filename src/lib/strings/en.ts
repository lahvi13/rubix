/**
 * All user-facing copy, in the language the rest of the repo is written in.
 * The Czech translation in `cs.ts` is typed against this object, so a key
 * added here and forgotten there fails the build; `index.ts` picks between
 * the two once, at startup.
 */

import { totalRecords, type RecordCounts } from '../../domain/transfer/backup-reminder';
import type { Translated } from './types';

/** The kinds there are, as one phrase: "120 solves and 45 drill attempts". */
function records(counts: RecordCounts): string {
  const parts = [
    counts.freestyle > 0 ? `${counts.freestyle} ${counts.freestyle === 1 ? 'solve' : 'solves'}` : null,
    counts.drill > 0 ? `${counts.drill} drill ${counts.drill === 1 ? 'attempt' : 'attempts'}` : null,
    counts.recognition > 0
      ? `${counts.recognition} recognition ${counts.recognition === 1 ? 'attempt' : 'attempts'}`
      : null,
    counts.algorithms > 0
      ? `${counts.algorithms} ${counts.algorithms === 1 ? 'algorithm' : 'algorithms'} of your own`
      : null,
  ].filter((part) => part !== null);
  return new Intl.ListFormat('en', { type: 'conjunction' }).format(parts);
}

export const en = {
  appName: 'Rubix',
  common: {
    dismiss: 'Dismiss',
  },
  /* The buttons on every cube that turns: an algorithm, a scramble, a cross. */
  playback: {
    play: 'Play',
    pause: 'Pause',
    resume: 'Continue',
    step: 'Next move',
    back: 'Previous move',
  },
  scramble: {
    label: 'Scramble',
    loading: 'Generating scramble…',
    failed: 'Scramble failed — tap to retry',
    next: 'New scramble',
    replay: 'Watch the scramble',
    showPreview: 'Show preview',
    hidePreview: 'Hide preview',
    edit: (scramble: string) => `Change the scramble: ${scramble}`,
    field: 'Scramble to solve',
    hint: 'Type or paste your own — from a competition, say. It is used for one solve, then the scrambles are random again.',
    invalid: "Not a scramble — write moves like R U' F2.",
    use: 'Use it',
    /* Said beside a scramble the app did not draw, and kept with the solve. */
    sources: {
      own: 'Your own scramble',
      history: 'Scramble from the history',
      shared: 'Shared scramble',
    },
    /* One of the scrambles of a shared average, counted as they come. */
    sharedRun: (count: number, at: number) => `Shared ao${count} · ${at}/${count}`,
    toBeat: (time: string) => `${time} to beat`,
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
    locked: 'Answer shown — Next to go again',
    lockedDone: 'Done — Next to go again',
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
    /*
     * A shared scramble's time, against the one just done. Said whichever way
     * it went: the attempt was made to find out.
     */
    challengeBeaten: (target: string, margin: string) => `Beat ${target} by ${margin}`,
    challengeTied: (target: string) => `Tied ${target}`,
    challengeMissed: (target: string, margin: string) => `Missed ${target} by ${margin}`,
    challengeMissedDnf: (target: string) => `Missed ${target}`,
    /* A shared average's time, where a shared single's would stand. */
    challengeAverage: (count: number, time: string) => `ao${count} ${time}`,
    challengeTiedMark: '=',
    challengeMissedMark: '✗',
  },
  splits: {
    bestPhase: (phase: string) => `Best ${phase} of this session`,
    title: 'Phases',
    phaseAverages: 'Phase averages',
    shareBar: (n: number | 'all') =>
      n === 'all'
        ? 'How the mean of every phase-timed solve divides between the phases'
        : `How the current ao${n} divides between the phases`,
    phaseTrend: 'Phase trend',
    /** Counted among phase-timed solves only, so not the solve number elsewhere. */
    phaseTrendSolve: (index: number) => `Phase-timed solve ${index}`,
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
    more: 'More',
    screens: 'Screens',
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
    tagFilter: 'Only solves with this tag',
    tagLabel: 'Tag',
    withTag: (name: string) => `tagged ${name}`,
    emptyTag: 'No solves with this tag yet.',
    solveCount: (count: number) => `${count} ${count === 1 ? 'solve' : 'solves'}`,
    averages: 'Averages',
    current: 'Current',
    best: 'Best',
    pbSingle: 'PB single',
    sessionBest: 'Session best',
    mean: 'Mean',
    /** Under the timer's averages, before what the next solve needs. */
    nextRecord: 'For a session best:',
    nextRecordBelow: (n: number, time: string) => `ao${n} under ${time}`,
    median: 'Median',
    stdDev: 'Std dev',
    dnfRate: 'DNF rate',
    plusTwoRate: '+2 rate',
    distribution: 'Time distribution',
    trend: 'Trend',
    bySolve: 'By solve',
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
    longTrendSeries: 'ao50',
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
    trendAxesLong:
      'The green line is the average of the twelve solves ending at each point, the blue one of the fifty; the dots are the solves themselves, oldest first. Green under blue means you are faster than lately.',
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
    /** Over the choice a new session is timed in: CFOP, Roux or ZZ. */
    method: 'Method',
  },
  learn: {
    intro:
      "Seven steps from a scrambled cube to a solved one. The pictures have white on the bottom and yellow on top. The Notation button explains letters like R or U'.",
    explanations: 'Explanations',
    stepsNav: 'Steps',
    hide: 'Hide this guide from the menu',
    hideHint:
      'Once you can solve without reading, you can get faster: a quicker method joins the steps in pairs — 2 and 3 become F2L, 4 and 5 OLL, 6 and 7 PLL — all of them in the trainer. Then take this guide out of the menu; Settings puts it back.',
    source: 'The method and the order of its steps follow the beginner guide at',
    sourceLink: 'badmephisto.com',
    loading: 'Loading the cases…',
    crossCaption: 'A finished cross: an edge under every centre whose colour it shares.',
    crossCases: {
      whiteUp: 'White on top: turn the front face twice.',
      whiteFront: 'White facing you: the edge goes down the long way, round the right face.',
    },
    showCases: 'All cases',
    hideCases: 'Back to the one algorithm',
    warning: 'Watch out:',
    tip: 'Tip:',
    steps: {
      cross: {
        title: 'Cross',
        points: [
          'White centre facing down. Around it go the four edges with a white sticker, in a cross.',
          'Find a white edge in the top layer and turn the top (U) until its other colour is at the centre of the same colour.',
          'Turn the whole cube so the edge is at the front, and take it down by where the white points — both ways are in the pictures.',
        ],
        warning: 'the other colour of every white edge has to match the centre beside it.',
        tip: 'a white edge in the middle, or in the wrong place at the bottom? Bring it up first: turn the side it is in, move it aside with the top, and turn the side back.',
      },
      corners: {
        title: 'Bottom layer corners',
        points: [
          'Find a white corner on top and turn the top (U) until it is above its place — between the centres of its three colours.',
          'See where the white sticker points (right, front or up) and use the algorithm for that.',
        ],
        tip: 'a corner already at the bottom but wrong comes up with any of the three.',
      },
      middle: {
        title: 'Middle layer edges',
        points: [
          'Find an edge on top with no yellow on it.',
          'Turn the top (U) until it is on the right, its side colour matching the right centre.',
          'The colour on top says whether it goes to the front or the back — pick the algorithm by that.',
        ],
        tip: 'an edge already in the middle but wrong comes up too: turn the whole cube so it is at the front right and run Edge to the front.',
      },
      edgeOrientation: {
        title: 'Last layer cross',
        points: [
          'Now only the yellow on top matters, not where the pieces are.',
          'Find your shape — a line, an L or the dot — hold the cube as the picture shows and run the algorithm under it.',
          'For the dot, run both one after the other.',
        ],
        tip: 'the lower-case f turns the front face and the middle layer behind it together.',
      },
      cornerOrientation: {
        title: 'Last layer face',
        points: [
          'One algorithm does the whole yellow face: repeat it until the face is done. It never takes more than three goes.',
          'Before each go, hold the cube as the pictures show — by how many corners already have yellow on top.',
        ],
      },
      cornerPermutation: {
        title: 'Corners home',
        points: [
          'Look for headlights: two corners on one side showing the same colour.',
          'Turn the whole cube so they are at the back and run the algorithm. The edges stay put.',
        ],
      },
      edgePermutation: {
        title: 'Edges home',
        points: [
          'Turn the top (U) until one side is a solid colour.',
          'Turn the whole cube so that side is at the back and run the algorithm. The corners stay put.',
          'Once the last edge is in, the cube is solved.',
        ],
      },
    },
    holds: {
      oneOriented: 'One corner has yellow on top: turn the top until it is at the front left.',
      twoOriented:
        'Two have yellow on top: turn the top until the front-left corner has its yellow on the front.',
      noneOriented:
        'None has yellow on top: turn the top until the front-left corner has its yellow on the left.',
      headlights: 'Headlights at the back: the other three corners go round into place.',
      noHeadlights:
        'No headlights anywhere: run it from any side and some appear.',
      oneSide: 'The finished side at the back: the other three edges go round.',
      noSide: 'No side finished: run it from any side and one will be.',
    },
    /* Roux, beside CFOP on the same page: the switch, its own introduction
       and credit, and its seven steps. */
    method: 'Method',
    rouxIntro:
      "Roux is a step up from the CFOP guide beside it: fewer algorithms, more working things out yourself. Seven steps: a block on each side, the top corners with two algorithms, then the last six edges with nothing but M and U. The pictures have yellow on top, white on the bottom and the first block's blue on the left. The Notation button explains letters like M or r.",
    rouxSource: 'The steps follow the Roux guides by Kian Mansour and the Roux community, at',
    rouxSourceLink: "Kian's Roux site",
    /* What comes after the guide: the trainer's sets, under the abbreviations
       they go by there and everywhere else, each said once in full. */
    rouxNext: {
      lead: 'Once you can solve without reading, the sets in the trainer make each step quicker. They go by the abbreviations you will meet everywhere:',
      sets: [
        { name: 'SB', text: 'second block: the 65 places a pair can be in, each with an algorithm of its own. For step 2.' },
        { name: 'CMLL', text: 'corners of the last layer: steps 3 and 4 in one algorithm. 2-Look CMLL is the half-way stage, in two.' },
        { name: 'EO', text: 'edge orientation: every shape of bad edges solved outright, without going by way of the arrow. For step 5.' },
        { name: 'EOLR', text: 'EO and the left and right edges: steps 5 and 6 in one algorithm.' },
      ],
      more: 'In a session made as Roux the timer splits a solve into four phases (the Phase button): FB — first block, step 1; SB — second block, step 2; CMLL — the corners, steps 3 and 4; LSE — the last six edges, steps 5 to 7.',
      hide: 'After that, take this guide out of the menu; Settings puts it back.',
    },
    rouxBlockCaption: 'The finished left block, seen from the front left.',
    rouxSituations: {
      pairInFront: 'Pair at the front, corner on the left: lift the slot, put the pair in, bring it back.',
      pairColourUp: 'Pair at the back with green on top: roll it over, then in.',
      arrow: 'The arrow: three bad edges on top, its point over the fourth at the bottom front.',
      fourOnTop:
        'Four bad on top: swap the front one for the good edge under it. Three are left — an arrow.',
      twoAndTwo:
        'Two on top, two below: turn a good top edge to the front and swap it for the bad one under it.',
      twoBad:
        'Two bad: turn the top until exactly one of them is at the back, top or bottom. This makes four.',
      sixBad: 'All six bad: run it from anywhere, and two are left.',
      sideEdgesDown:
        "Both at the bottom, facing each other: corners of the back edge's colour over the front one, M2, then turn the top home.",
      sideTopOpposite:
        'Both on top, facing each other: turn them front and back, and M2 sends both down. Then the first algorithm.',
      sideOneDown:
        'One at the bottom front: turn the other to the top back, and this drops it down. Then the first algorithm.',
      sideTopAdjacent:
        'Both on top, side by side: turn them to the front and the right. This sends both down. Then the first algorithm.',
      dots: 'Dots: a stripe of one colour across the top, and at the front a centre between two edges of another colour.',
      threeCycle:
        'Three edges going round: at the top front the edge that matches neither centre, under it the one that fits.',
    },
    rouxHolds: {
      headlightsLeft:
        'Headlights — two corners showing one colour on a side: turn the top until they are on the left, over the blue block.',
    },
    rouxSteps: {
      firstBlock: {
        title: 'Left block',
        points: [
          'Blue centre on the left, white down. On the left goes a 1×2×3 block: the blue-white edge at the bottom, and a corner-edge pair in front of it and behind it — the picture shows it finished.',
          'No algorithm builds a block: it is done by feel. The rest of the cube is still free, so any face may turn — only look after what of the block already stands.',
          'First put the blue-white edge under the blue centre, white facing down.',
          "Then the two pairs: bring a pair's edge to the bottom front and its corner into the top layer without white on top, and join them with M' — or M2 when the colours do not meet. Turn the pair to the left with the top and set it down beside the edge, the back pair first.",
        ],
        tip: 'know F2L from CFOP? It is the same corner-edge pair, only without turning the whole cube: blue stays on the left, and what a rotation would have done, the middle slice (M) does.',
      },
      secondBlock: {
        title: 'Right block',
        points: [
          'The same block on the right, round the green centre — but now only U, R, r and M may turn: the left block holds the rest.',
          'The green-white edge first: bring it up with white on top, over the green centre, and R2 puts it down.',
          'Pair up as on the left, then put each pair in from the top with R or r — the pictures show both ways.',
        ],
      },
      cornerOrientation: {
        title: 'Top corners up',
        points: [
          'Now only the four top corners matter; the edges come last.',
          'One algorithm turns them all yellow up: repeat it until they are. Before each go, hold the cube by how many already have yellow on top.',
        ],
      },
      cornerPermutation: {
        title: 'Corners home',
        points: [
          'Look for headlights: two corners on one side showing the same colour.',
          'Turn the top until they are on the left and run the algorithm. Then turn the top until the corners match the blocks.',
        ],
      },
      edgeOrientation: {
        title: 'Edges up or down',
        points: [
          'Six edges are left: four on top, and two at the bottom front and back. First turn M until the centre on top is yellow or white.',
          'An edge is good when its yellow or white faces up or down, and bad when it faces sideways. Count the bad ones: there is always an even number — none, two, four or six. In the pictures a bad edge is purple on top.',
          "Four bad edges make the arrow: three on top and one below. Turn the top until the arrow's point — the middle one of the three — is over the bad edge below, and M' U M turns them all good.",
          'No arrow? Find your count in the pictures under it: each says how to hold the cube and what to turn, and leads to the arrow.',
        ],
        tip: "M' U M turns over four edges at once — front, left and right on top, and the front one below. With the bad edge at the bottom back, do it from the back: point to the back, then M U M'.",
      },
      sideEdges: {
        title: 'Side edges',
        points: [
          'The yellow-blue and yellow-green edges belong on top of the blocks. They go in from below: both have to be at the bottom facing each other, one at the front and one at the back.',
          'Then look at the colour of the front one. Turn the top until the two corners above it show the other colour — green corners over the blue edge. M2 lifts both edges to their corners, and a turn of the top makes the sides whole: that is the first picture.',
          "Not both at the bottom? The other pictures get them there from anywhere else — and then it is the first one's turn. None of those moves turns an edge over.",
        ],
        tip: "one at the bottom back and the other on top? The same from the other side: turn the top one to the front, then M' U2 M.",
      },
      middleSlice: {
        title: 'Middle slice',
        points: [
          'Only the middle slice is left: four edges and the centres. Turn nothing but M and U2 now.',
          'An edge fits when both its colours match the centres beside it. Count how many of the four fit.',
          'All four: only M is left to turn.',
          'None — dots: turn M until the stripe across the top is one colour, then U2 M2 U2 M2. No such stripe to be had? Run it once anyway, and there will be.',
          "One — three edges going round: beside the edge that fits is one that matches neither of its centres. Turn M until that one is on top with the fitting edge straight under it, then U2 M U2 M' at the front, or U2 M' U2 M at the back.",
          'Last, turn M until the centres are home: the cube is solved.',
        ],
      },
    },
    /* ZZ, the third guide: its introduction and credit, what comes after it,
       and the steps that are its own — the last two are CFOP's, word for word. */
    zzIntro:
      "ZZ pays at the start for an easy rest: before anything is built, every edge is turned so that the solve after it needs no turn of the front or back face and no turning the cube round. Seven steps: find the bad edges, turn them good, the cross, the four pairs with R, L and U alone, and a last layer whose yellow cross is already there. It is for a cube you can already solve. The pictures have yellow on top, white on the bottom and blue in front. The Notation button explains letters like R or U'.",
    zzSource: 'The steps follow the ZZ tutorial by crystalcuber and the ZZMethod.com team, at',
    zzSourceLink: 'zzmethod.com',
    zzNext: {
      lead: 'Once you can solve without reading, the last layer is where algorithms help first. The trainer keeps them under CFOP, which shares them:',
      sets: [
        { name: 'OCLL', text: 'orient the corners of the last layer: seven cases, each with an algorithm of its own — the second look of 2-Look OLL. For step 5.' },
        { name: 'PLL', text: 'permute the last layer: steps 6 and 7 in one algorithm. 2-Look PLL is the half-way stage, in two.' },
      ],
      more: 'In a session made as ZZ the timer splits a solve into three phases (the Phase button): EOCross — the edges and the cross, steps 1 to 3; F2L — the four pairs, step 4; LL — the last layer, steps 5 to 7.',
      hide: 'After that, take this guide out of the menu; Settings puts it back.',
    },
    /* The two rules of the first step, each beside the cube that draws it. */
    zzRules: {
      sideColours:
        'Red or orange — the colours of the left and right centres — on top, or beside the centre in front.',
      poleColours: 'Yellow or white on the side, or above or below the centre in front.',
    },
    zzFigures: {
      tryIt:
        'Try it: a solved cube, yellow on top and blue in front, and the moves under the picture. How many edges are bad?',
      answer: 'Six — the purple ones. Hold each against the two rules, in the picture above.',
    },
    zzSituations: {
      fourOnFront: 'Four bad on the front: one turn, and all four are good.',
      gather:
        "Three on the front, the fourth on top at the right: R' carries it down to them without turning it over. Then the turn.",
      twoBad:
        'Two bad: one on the front with three good edges, the other anywhere else. The turn makes four.',
      sixBad: 'Six bad: three on the front with one good edge. The turn leaves four.',
      crossTop: 'White on top, over the centre of its other colour: a half turn of that side.',
      crossMiddle: 'White facing you in the middle layer: bottom aside, the edge down, bottom back.',
      joined: "Joined, and off the slot's side: lift the slot, bring the pair over it, put it back.",
      split:
        'Split, the corner over its slot: lifting the slot joins them. Bring the pair back over it and down.',
      stuck:
        'A piece in a slot: lift the slot, turn the top until neither piece is on that side, put the slot back.',
      touching: 'Touching, not joined: corner over the slot, lift it, turn the top half way, put it back.',
      whiteUp:
        'White on top of the corner: turn the edge over the centre of its side colour. Lift the slot, bring the corner over the edge, put it back. Joined.',
      topsMatch:
        'Same colour on top of both: corner to the back right. Lift the slot and it drops out of the way; bring the edge to the back, beside where it was, and put the slot back. Joined.',
      topsDiffer:
        'Different colours on top: corner to the back right, lift the slot, but send the edge to the left, away from it. Split.',
    },
    /* The rest of the pairs, behind a button: what it is called, and what the
       five pictures under it are. */
    zzPairsMore: {
      lead: 'In this order: a piece out of a slot, two that touch apart, and then by the colour on top of the corner — white, the same as on top of the edge, or the other one.',
      show: 'How to get to them',
      hide: 'Just the two shapes',
    },
    zzSteps: {
      badEdges: {
        title: 'Bad edges',
        points: [
          'Yellow centre on top, blue in front — and the cube stays that way round until the first two layers are done.',
          'Look at the edges only. A bad one shows a colour where that colour must not be: the two pictures.',
          'The bottom is read like the top, the back like the front, the left like the right.',
          'Count the bad ones: there is always an even number, from none to twelve. Try it on the cube under the pictures.',
        ],
        tip: 'more bad than good? Keep track of the good ones instead.',
      },
      edgesGood: {
        title: 'Edges good',
        points: [
          'Only a quarter turn of the front or back face turns edges over — all four on that face at once, bad to good and good to bad. Every other turn only carries them about: R, L, U, D, and the half turns F2 and B2.',
          'So carry bad edges onto the front or the back, and turn it. How many to put there depends on how many are bad:',
          'Four: all four on one face. One turn and they are good. Eight or twelve are four at a time.',
          'Two: one of them on a face, with three good edges. The turn makes four bad.',
          'Six or ten: three on a face, with one good edge. The turn leaves four, or eight.',
        ],
        tip: 'start with the face that already has the most bad edges on it. Everything the pictures do at the front works at the back, with B.',
      },
      cross: {
        title: 'Cross',
        points: [
          'The four white edges go round the white centre at the bottom, each matching the centre beside it — the same cross as in CFOP.',
          'Only R, L, U, D, F2 and B2 may turn now. With every edge good that is enough: white never faces the awkward way. On top it faces up, in the middle layer it faces the front or the back.',
          'On top: turn the top until the edge is over the centre of its other colour, then give that side a half turn.',
          'In the middle layer: one turn of the side it is on takes it down. Turn the bottom first, so that its place is under it, and back afterwards.',
        ],
        warning: 'a quarter turn of F or B, or turning the cube round, and the edges have to be counted again.',
        tip: 'steps 1 to 3 together are called EOCross. With practice they are planned as one, before the first turn.',
      },
      pairs: {
        title: 'First two layers',
        points: [
          'Four pairs into four slots, as in CFOP — but the cube never turns round, and F and B stay still. A slot is lifted by its own side, R for the two on the right and L for the two on the left, and the top does the rest.',
          'A pair goes in from one of two shapes, joined or split: the two pictures.',
          'Whatever you would solve with F, B or a turn of the cube has a way to one of the two shapes instead. The button under the pictures walks it.',
        ],
        tip: "the pictures are the front right slot. Front left is its mirror image, L' where they say R. The back slots lift the other way: R' on the right, L on the left.",
      },
      cornersUp: {
        title: 'Last layer face',
        points: [
          'The yellow cross is already there — that is what turning the edges at the start paid for. Only the four corners are left to turn up, and from here on the cube may be turned round again.',
          'One algorithm does it: repeat it until the face is yellow. It never takes more than three goes.',
          'Before each go, hold the cube as the pictures show — by how many corners already have yellow on top.',
        ],
      },
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
    loadingPlayer: 'Loading the cube…',
    variants: 'Algorithms',
    packAlg: 'built in',
    packAlgGrip: 'built in · turned',
    packAlgOther: 'built in · another way',
    /* Another way too, but the reason it is on offer is the hand: a reader
       who turns with the right one can pass it by without trying it. */
    packAlgLeft: 'built in · left-handed',
    /* Said as a cost rather than a warning: it is a real solution, often the
       shortest one, and it is only wrong if the slot it breaks was built. */
    packAlgSlot: 'built in · breaks another slot',
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
    poolSlowest: 'Slowest',
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
    next: 'Next',
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
    /* One word each: the buttons sit either side of the cube, in the room it leaves. */
    turn: 'Turn',
    turnedHint: 'Seen from the back left.',
    correct: 'Right',
    wrong: 'No — it was',
    next: 'Next',
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
    fontHint: "System uses the device's own font. Scrambles and algorithms are always monospaced.",
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
    twistyModeHint: 'Flat as an unfolded net, 3D as a cube seen from a corner.',
    caseLayout: 'Trainer cases',
    caseLayoutSmall: 'Small',
    caseLayoutLarge: 'Large',
    caseLayoutList: 'List',
    caseLayoutHint:
      'Small fits the most cases on screen, the list writes the algorithms largest. Kept for this device only.',
    timer: 'Timer',
    holdThreshold: 'Hold to start',
    holdOff: 'Off',
    showScramblePreview: 'Show the cube below the scramble',
    showNextRecord: 'Show what the next solve needs for a best',
    showNextRecordHint:
      'Under the averages on the timer, and only while a best ao5 or ao12 of the session is still in reach.',
    haptics: 'Vibrate when ready and when stopped',
    runningDisplay: 'Time while solving',
    runningHundredths: '0.00',
    runningTenths: '0.0',
    runningSeconds: '0',
    runningHidden: 'Hidden',
    runningDisplayHint:
      'Only what the clock shows while it runs. Every solve is timed to the millisecond and shown to the hundredth when it stops.',
    splitMode: 'Time solves by phase (4 phases)',
    splitModeHint:
      'A tap ends a phase; the last one stops the clock. Hold to finish early if you skip a phase.',
    showLearn: "Show the beginner's guide",
    showLearnHint: 'In the menu as Learn. Hiding it changes nothing else.',
  },
  /* The voice trial: the microphone listens alongside the phase taps. */
  voice: {
    title: 'Phases by voice (trial)',
    toggle: 'Listen alongside the taps',
    hint:
      'When you time by phase, say a short word like “hop” as each phase ends. Taps still set the times; after the solve you see what the voice would have timed. Sound is only measured, on this device: nothing is recorded or sent.',
    needsPhases: 'It listens only while solves are timed by phase — switch that on above.',
    test: 'Test the microphone',
    stopTest: 'Stop',
    opening: 'Opening the microphone…',
    failed: {
      denied:
        'The microphone is blocked for this app. Allow it in the browser’s settings for this site, then try again.',
      unavailable: 'This device has no microphone the app can use.',
    },
    meter: 'Loudness, and the line a voice has to cross',
    heard: (voices: number, others: number) =>
      `Say “hop” — heard ${voices} ${voices === 1 ? 'time' : 'times'}; ${others} other ${others === 1 ? 'sound' : 'sounds'} ignored.`,
    uncalibrated:
      'Not calibrated yet, so any short voice close to the phone counts. Calibrate to have only yours count.',
    calibrated: (loudnessDb: number) =>
      `Calibrated to your voice: your “hop” is about ${loudnessDb} dB above the room, and a word has to come close to that.`,
    calibrate: 'Calibrate',
    recalibrate: 'Calibrate again',
    cancelCalibration: 'Cancel calibrating',
    calibrateHint:
      'Put the phone where it lies while you solve, and say “hop” five times, the way you will say it then.',
    calibrating: (count: number, of: number) => `“Hop” ${count} of ${of}`,
    soundsLegend:
      'Each sound it judged, newest first: what it took it for · length · pitch · how clearly it repeats · loudness above the room.',
    verdicts: {
      voice: 'hop',
      long: 'too long',
      short: 'too short',
      quiet: 'too quiet',
      unclear: 'not a voice',
      repeat: 'repeat',
    },
    traits: (durationMs: number, pitchHz: number, periodicity: number, loudnessDb: number) =>
      `${durationMs} ms · ${pitchHz} Hz · ${Math.round(periodicity * 100)} % · +${loudnessDb} dB`,
    copySounds: 'Copy these sounds',
    summaryEmpty: 'No solve has been timed with the trial yet.',
    summary: (solves: number, heard: number, boundaries: number, extra: number) =>
      `${solves} ${solves === 1 ? 'solve' : 'solves'}: heard ${heard} of ${boundaries} phase ends, ${extra} false ${extra === 1 ? 'alarm' : 'alarms'}.`,
    offset: (medianMs: number, spreadMs: number) =>
      medianMs === 0
        ? `Your voice lands right on the tap, give or take ${spreadMs} ms.`
        : `Your voice comes ${Math.abs(medianMs)} ms ${medianMs > 0 ? 'after' : 'before'} the tap, give or take ${spreadMs} ms.`,
    copy: 'Copy the details',
    copied: 'Copied.',
    clear: 'Clear the results',
    noteHeard: (heard: number, boundaries: number) => `Voice ${heard}/${boundaries}`,
    noteExtra: (extra: number) => `${extra} false ${extra === 1 ? 'alarm' : 'alarms'}`,
    noteFailed: {
      denied: 'Voice: the microphone is blocked',
      unavailable: 'Voice: no microphone',
    },
  },
  data: {
    exportTitle: 'Backup',
    exportHint:
      'Every session, solve, tag and setting in one file. Theme and text size stay on this device.',
    exportAction: 'Export data',
    exportFailed: 'Could not export the data',
    exportCsvAction: 'Solves as CSV',
    exportCsvHint:
      'CSV: one row per solve — time, penalty, scramble, phases — for a spreadsheet. The app cannot read it back; it is not a backup.',
    lastBackup: (day: string, size: string | null) =>
      `Last backup: ${day}${size === null ? '' : ` · ${size}`}.`,
    noBackup: 'No backup from this device yet.',
    changedSince: (counts: RecordCounts) =>
      totalRecords(counts) === 0
        ? 'Nothing has changed since.'
        : `Added or changed since: ${records(counts)}.`,
    onlyHere: (counts: RecordCounts) => `Only on this device: ${records(counts)}.`,
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
    importTitle: 'Restore and import',
    importHint: 'Choose a file. Nothing is written until you confirm the preview.',
    chooseFile: 'Rubix backup',
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
    sinceBackup: (counts: RecordCounts) => `Not in your last backup: ${records(counts)}.`,
    never: (counts: RecordCounts) => `Only on this device, with no backup: ${records(counts)}.`,
    backUp: 'Back up',
    later: 'Not now',
  },
  cstimer: {
    hint:
      'From csTimer: the Export/Import file (.txt) or one session as CSV. Every session arrives as a new one.',
    chooseFile: 'csTimer file',
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
    /** The puzzle a csTimer session was timed on, by its WCA name. */
    puzzles: {
      '333': '3×3',
      '222': '2×2',
      '444': '4×4',
      '555': '5×5',
      pyram: 'Pyraminx',
      skewb: 'Skewb',
      sq1: 'Square-1',
      clock: 'Clock',
      minx: 'Megaminx',
    },
    switchTo: (name: string) => `Switch to “${name}”`,
    switchedTo: (name: string) => `The timer, history and stats now show “${name}”.`,
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
    /* Sent along with the picture, carrying the link that opens the scramble on a timer. */
    challenge: (time: string, link: string) => `Can you beat ${time}? ${link}`,
    tryScramble: (link: string) => `Try this scramble: ${link}`,
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
    contactIssue: 'With a GitHub account you can also report a bug in public:',
    issueLink: 'open an issue',
    source: 'The source code is open, under the GPL-3.0:',
    creditsTitle: 'Thanks',
    creditAlgs: 'Most of the algorithms come from J Perm —',
    creditRoux: 'The Roux sets come from the sheets of Kian Mansour and the Roux community —',
    creditSpeedcubedb: 'The second-block cases those sheets leave out are from SpeedCubeDB —',
    creditZz: 'The ZZ guide follows the tutorial by the ZZMethod.com team —',
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
