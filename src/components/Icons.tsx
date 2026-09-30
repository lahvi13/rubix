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
