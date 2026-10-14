import { CubeDiagram } from '../components/CubeDiagram';
import { parseAlg } from '../domain/cube/notation';
import { applyAlg, solvedState, type CubeState } from '../domain/cube/state';
import {
  CUBE_ORDER,
  SUPPORTED_PUZZLES,
  type SupportedPuzzle,
} from '../domain/puzzle/puzzles';
import { useBackToClose } from '../hooks/use-back-to-close';
import { useCubeSkin } from '../hooks/use-cube-skin';
import { useKeyCapture } from '../hooks/use-key-capture';
import { strings } from '../lib/strings';

/**
 * Each cube on its tile, scrambled: a solved one shows the same three faces
 * on both tiles, and read as a dull row of yellow, green and orange. Always
 * the same scramble, so a tile looks the same every time it is opened.
 */
const TILE_SCRAMBLE: Readonly<Record<SupportedPuzzle, string>> = {
  '333': "R U2 F' L D2 B R' U F2 L'",
  '222': "R U' F2 R' U F' R2",
};

function tileState(puzzle: SupportedPuzzle): CubeState {
  const parsed = parseAlg(TILE_SCRAMBLE[puzzle]);
  return parsed.ok ? applyAlg(solvedState(), parsed.moves) : solvedState();
}

interface PuzzleSwitchProps {
  puzzle: SupportedPuzzle;
  isOpen: boolean;
  onToggle: () => void;
}

/**
 * Which cube the app is on, in the header's corner, and the way to another.
 * In the header because the answer belongs to every screen at once — the
 * sessions, the guide and the trainer all follow it — and written there it
 * needs saying nowhere else.
 *
 * A face of the cube rather than its name: two or three squares a side say
 * which cube as plainly as "2×2" does, and on a phone with large text the
 * name took the room the screen's own title needed.
 */
export function PuzzleSwitch({ puzzle, isOpen, onToggle }: PuzzleSwitchProps) {
  const name = strings.puzzle.names[puzzle];
  return (
    <button
      type="button"
      className={isOpen ? 'puzzle-switch is-active' : 'puzzle-switch'}
      aria-haspopup="true"
      aria-expanded={isOpen}
      aria-label={strings.puzzle.switch(name)}
      title={strings.puzzle.switch(name)}
      onClick={onToggle}
    >
      <FaceIcon order={CUBE_ORDER[puzzle]} />
    </button>
  );
}

/** One face of the cube, as many squares a side as the cube has layers. */
function FaceIcon({ order }: { order: number }) {
  const gap = 2;
  const size = (24 - gap * (order - 1)) / order;
  const squares = Array.from({ length: order * order }, (_, index) => (
    <rect
      key={index}
      x={(index % order) * (size + gap)}
      y={Math.floor(index / order) * (size + gap)}
      width={size}
      height={size}
      rx={1.5}
    />
  ));
  return (
    <svg className="icon puzzle-switch__icon" viewBox="0 0 24 24" aria-hidden="true">
      {squares}
    </svg>
  );
}

interface PuzzleMenuProps {
  puzzle: SupportedPuzzle;
  onPick: (puzzle: SupportedPuzzle) => void;
  onClose: () => void;
}

/**
 * The cubes to switch between, as a card under the button that opened it:
 * the hand is up in that corner already, and a list rising from the bottom
 * of the screen was the far end of it. Each cube is drawn as it is, in the
 * reader's colours.
 */
export function PuzzleMenu({ puzzle, onPick, onClose }: PuzzleMenuProps) {
  const skin = useCubeSkin();
  useKeyCapture(true, onClose);
  useBackToClose(onClose);

  return (
    <>
      <button
        type="button"
        className="app__scrim"
        aria-label={strings.nav.closeMenu}
        onClick={onClose}
      />
      <div className="puzzle-menu" role="group" aria-label={strings.puzzle.title}>
        {SUPPORTED_PUZZLES.map((candidate) => (
          <button
            key={candidate}
            type="button"
            className={candidate === puzzle ? 'puzzle-menu__cube is-active' : 'puzzle-menu__cube'}
            aria-pressed={candidate === puzzle}
            onClick={() => {
              onPick(candidate);
              onClose();
            }}
          >
            <CubeDiagram
              className="puzzle-menu__picture"
              state={tileState(candidate)}
              view="isometric"
              skin={skin}
              order={CUBE_ORDER[candidate]}
              label={null}
              isEager
            />
            {strings.puzzle.names[candidate]}
          </button>
        ))}
      </div>
    </>
  );
}
