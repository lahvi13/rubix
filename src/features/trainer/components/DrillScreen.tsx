import { useSetting } from '../../../hooks/use-setting';
import { RecognitionDrill } from './RecognitionDrill';
import { SolveDrill } from './SolveDrill';

/**
 * Drilling a case, one of two ways: against the clock with a cube in your
 * hands, or by naming it with no cube at all.
 *
 * Only one of them is mounted at a time, and deliberately so — the solve drill
 * owns a timer that listens for a key being held, and a timer running behind a
 * screen that has no clock on it would be storing attempts nobody made.
 */
export function DrillScreen() {
  const [mode, setMode] = useSetting('trainer.drillMode');

  return mode === 'recognise' ? (
    <RecognitionDrill mode={mode} onMode={setMode} />
  ) : (
    <SolveDrill mode={mode} onMode={setMode} />
  );
}
