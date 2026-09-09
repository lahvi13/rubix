/**
 * The few shapes that stand in for a word. They live together so that the
 * trainer's play button is the same play button as the timer's, and so their
 * size and weight come from one rule (`.icon` in index.css) instead of from
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

export function StopIcon() {
  return (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
      <rect x="7" y="7" width="10" height="10" rx="1.5" />
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
