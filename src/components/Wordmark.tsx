import type { Face } from '../domain/cube/notation';
import { WORDMARK } from '../lib/wordmark';

interface WordmarkProps {
  /** The skin the stickers are coloured from, in the theme on screen. */
  faces: Readonly<Record<Face, string>>;
  className?: string;
  /**
   * Given, the last sticker — the X — closes the panel the name sits in. It
   * stands where every other panel has its cross, and is one.
   */
  close?: { label: string; onClose: () => void };
}

/**
 * The app's name as five stickers. Hidden from a screen reader: the header
 * already says the name, and five letters read one by one say nothing more.
 * Only the X, when it closes something, is read out — as what it does.
 */
export function Wordmark({ faces, className, close }: WordmarkProps) {
  const last = WORDMARK.length - 1;
  return (
    <span
      className={className === undefined ? 'wordmark' : `wordmark ${className}`}
      aria-hidden={close === undefined ? 'true' : undefined}
    >
      {WORDMARK.map(({ letter, face }, index) =>
        close !== undefined && index === last ? (
          <button
            key={letter}
            type="button"
            className="wordmark__tile wordmark__close"
            style={{ background: faces[face] }}
            aria-label={close.label}
            onClick={close.onClose}
          >
            {letter}
          </button>
        ) : (
          <span
            key={letter}
            className="wordmark__tile"
            style={{ background: faces[face] }}
            aria-hidden={close === undefined ? undefined : 'true'}
          >
            {letter}
          </span>
        ),
      )}
    </span>
  );
}
