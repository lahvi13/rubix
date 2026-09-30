import { CROSS_SET_ID } from '../../../domain/alg/sets';
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
 *
 * The cross is the exception that has only one half: it is drilled from a real
 * scramble and there is no case to name. Rather than offering the choice and
 * answering it with an apology, the switch goes away and the solve drill is
 * what the cross opens. The stored preference is left alone, so somebody who
 * was naming PLL cases is still naming them when they come back from the
 * cross.
 */
export function DrillScreen() {
  const [mode, setMode] = useSetting('trainer.drillMode');
  const [setId] = useSetting('trainer.drillSetId');
  const canRecognise = setId !== CROSS_SET_ID;

  return mode === 'recognise' && canRecognise ? (
    <RecognitionDrill mode={mode} onMode={setMode} />
  ) : (
    <SolveDrill mode={canRecognise ? mode : 'solve'} onMode={setMode} canRecognise={canRecognise} />
  );
}
