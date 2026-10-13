import { ChevronIcon } from '../components/Icons';
import { Sheet } from '../components/Sheet';
import { SUPPORTED_PUZZLES, type SupportedPuzzle } from '../domain/puzzle/puzzles';
import { strings } from '../lib/strings';

interface PuzzleSwitchProps {
  puzzle: SupportedPuzzle;
  onOpen: () => void;
}

/**
 * Which cube the app is on, written in the header's corner, and the way to
 * another. In the header because the answer belongs to every screen at once —
 * the sessions, the guide and the trainer all follow it — and because written
 * there it needs saying nowhere else. A button that opens a list rather than
 * a row of cubes: the row stops fitting at the third.
 */
export function PuzzleSwitch({ puzzle, onOpen }: PuzzleSwitchProps) {
  const name = strings.puzzle.names[puzzle];
  return (
    <button
      type="button"
      className="puzzle-switch"
      aria-haspopup="dialog"
      aria-label={strings.puzzle.switch(name)}
      onClick={onOpen}
    >
      {name}
      <ChevronIcon up={false} />
    </button>
  );
}

interface PuzzleSheetProps {
  puzzle: SupportedPuzzle;
  onPick: (puzzle: SupportedPuzzle) => void;
  onClose: () => void;
}

/**
 * The cubes to switch between. Up from the bottom like every other sheet, so
 * the reach to the header's corner is made once and the choice is under the
 * thumb.
 */
export function PuzzleSheet({ puzzle, onPick, onClose }: PuzzleSheetProps) {
  return (
    <Sheet label={strings.puzzle.title} className="puzzle-sheet" onClose={onClose}>
      <h2 className="puzzle-sheet__title">{strings.puzzle.title}</h2>
      <div className="puzzle-sheet__list" role="group" aria-label={strings.puzzle.title}>
        {SUPPORTED_PUZZLES.map((candidate) => (
          <button
            key={candidate}
            type="button"
            className={candidate === puzzle ? 'is-active' : ''}
            aria-pressed={candidate === puzzle}
            onClick={() => {
              onPick(candidate);
              onClose();
            }}
          >
            {strings.puzzle.names[candidate]}
          </button>
        ))}
      </div>
    </Sheet>
  );
}
