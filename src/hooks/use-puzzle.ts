import { setSetting } from '../db/repositories/settings-repository';
import { supportedPuzzle, type SupportedPuzzle } from '../domain/puzzle/puzzles';
import { watchWrite } from '../lib/errors';
import { unpinScramble } from './use-pinned-scramble';
import { useSetting } from './use-setting';

/**
 * Which cube the app is switched to. One choice for every screen: the timer,
 * the history and the stats show that cube's sessions, the guide and the
 * trainer its methods. Each cube keeps its own active session, so switching
 * back lands where the reader left off.
 */
/**
 * The switch, for what happens outside a component: a link or an import that
 * is about another cube takes the app to it.
 */
export function switchPuzzle(puzzle: SupportedPuzzle): void {
  watchWrite(() => setSetting('ui.puzzle', puzzle), 'ui.puzzle');
}

export function usePuzzle(): [SupportedPuzzle, (puzzle: SupportedPuzzle) => void] {
  const [stored, setStored] = useSetting('ui.puzzle');
  const puzzle = supportedPuzzle(stored);

  return [
    puzzle,
    (next) => {
      if (next === puzzle) return;
      // A scramble typed in or taken from the history was for the other cube.
      unpinScramble();
      setStored(next);
    },
  ];
}
