import type { Face } from '../domain/cube/notation';
import { WORDMARK } from '../lib/wordmark';

interface WordmarkProps {
  /** The skin the stickers are coloured from, in the theme on screen. */
  faces: Readonly<Record<Face, string>>;
  className?: string;
}

/**
 * The app's name as five stickers. Hidden from a screen reader: the header
 * already says the name, and five letters read one by one say nothing more.
 */
export function Wordmark({ faces, className }: WordmarkProps) {
  return (
    <span className={className === undefined ? 'wordmark' : `wordmark ${className}`} aria-hidden="true">
      {WORDMARK.map(({ letter, face }) => (
        <span key={letter} className="wordmark__tile" style={{ background: faces[face] }}>
          {letter}
        </span>
      ))}
    </span>
  );
}
