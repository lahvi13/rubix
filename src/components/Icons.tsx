/**
 * The few shapes that stand in for a word. They live together so that the
 * trainer's play button is the same play button as the timer's, and so their
 * size and weight come from one rule (`.icon` in styles/base.css) instead of from
 * whichever screen drew them.
 *
 * All of them are decorative: the button around an icon carries the label.
 */

export function PlayIcon() {
  return (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M9 6.5v11l9-5.5z" />
    </svg>
  );
}

export function CloseIcon() {
  return (
    <svg className="icon icon--stroke" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 7l10 10M17 7L7 17" />
    </svg>
  );
}

export function PreviousIcon() {
  return (
    <svg className="icon icon--stroke" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M14.5 6L8.5 12l6 6" />
    </svg>
  );
}

export function NextIcon() {
  return (
    <svg className="icon icon--stroke" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M9.5 6l6 6-6 6" />
    </svg>
  );
}

/** The mark on a line that folds a panel away; `up` is the open state. */
export function ChevronIcon({ up }: { up: boolean }) {
  return (
    <svg className="icon icon--stroke" viewBox="0 0 24 24" aria-hidden="true">
      <path d={up ? 'M7 14l5-5 5 5' : 'M7 10l5 5 5-5'} />
    </svg>
  );
}

export function PauseIcon() {
  return (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
      <rect x="7" y="6.5" width="3.5" height="11" rx="1" />
      <rect x="13.5" y="6.5" width="3.5" height="11" rx="1" />
    </svg>
  );
}

/** One move on: play up to a bar, the way a player's "next" is drawn. */
export function StepIcon() {
  return (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6.5 6.5v11l8.5-5.5z" />
      <rect x="15.5" y="6.5" width="2.5" height="11" rx="1" />
    </svg>
  );
}

/** One move back: the step, mirrored. */
export function BackIcon() {
  return (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M17.5 6.5v11L9 12z" />
      <rect x="6" y="6.5" width="2.5" height="11" rx="1" />
    </svg>
  );
}

/*
 * The bottom bar's screens. Drawn as outlines, like the cross and the
 * chevrons, so the bar reads as one set with them rather than as clip art.
 */

/** A stopwatch: the crown, the hand, the dial. */
export function TimerIcon() {
  return (
    <svg className="icon icon--stroke" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="13.5" r="7.5" />
      <path d="M12 13.5v-4M10 2.5h4M12 2.5V6M18.5 6.5L20 5" />
    </svg>
  );
}

/** An open book: the beginner's guide. */
export function LearnIcon() {
  return (
    <svg className="icon icon--stroke" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 6.5C10 5 7 4.5 4 5v13c3-.5 6 0 8 1.5 2-1.5 5-2 8-1.5V5c-3-.5-6 0-8 1.5zM12 6.5v13" />
    </svg>
  );
}

/** A target: the drill is practice at hitting one case after another. */
export function DrillIcon() {
  return (
    <svg className="icon icon--stroke" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="4" />
      <path d="M12 12h.01" />
    </svg>
  );
}

/** One face of the cube, which is what the trainer is a catalogue of. */
export function TrainerIcon() {
  return (
    <svg className="icon icon--stroke" viewBox="0 0 24 24" aria-hidden="true">
      <rect x="4" y="4" width="16" height="16" rx="2.5" />
      <path d="M9.33 4v16M14.67 4v16M4 9.33h16M4 14.67h16" />
    </svg>
  );
}

/** A list of times. */
export function HistoryIcon() {
  return (
    <svg className="icon icon--stroke" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M9 6.5h11M9 12h11M9 17.5h11M4.5 6.5h.5M4.5 12h.5M4.5 17.5h.5" />
    </svg>
  );
}

/** Bars on a baseline. */
export function StatsIcon() {
  return (
    <svg className="icon icon--stroke" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 20h16M7 20v-6M12 20V7M17 20v-9" />
    </svg>
  );
}

/** Everything else: the three lines a menu is drawn with. */
export function MoreIcon() {
  return (
    <svg className="icon icon--stroke" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}
