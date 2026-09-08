import type { AlgSet } from '../../../db/types';
import type { DrillMode } from '../../../db/repositories/settings-repository';
import { FULL_SETS, TWO_LOOK_SETS } from '../../../db/seed/packs';
import { useSetting } from '../../../hooks/use-setting';
import { strings } from '../../../lib/strings';

interface DrillSetsProps {
  sets: readonly AlgSet[];
  /** The set being drilled — a two-look set is one of these, not a mode. */
  setId: string;
  onSet: (setId: string) => void;
}

/**
 * Which set is being drilled, in two tiers like the trainer's own list: the
 * sets, and then which way through the last layer.
 *
 * Two-look OLL and PLL are sets in their own right (SPEC 3.5), so they could
 * simply sit in the row beside the full ones — but "OLL" and "2-Look OLL" as
 * neighbours reads as two subjects rather than two routes through one, and
 * hides that picking either is the same decision the trainer already asked.
 */
export function DrillSets({ sets, setId, onSet }: DrillSetsProps) {
  const [twoLookDefault] = useSetting('trainer.twoLookDefault');

  const baseId = FULL_SETS[setId] ?? setId;
  const twoLookId = TWO_LOOK_SETS[baseId];
  const isTwoLook = twoLookId !== undefined && setId === twoLookId;

  return (
    <>
      <div className="trainer__sets">
        {sets
          .filter((set) => !Object.hasOwn(FULL_SETS, set.id))
          .map((set) => (
            <button
              key={set.id}
              type="button"
              className={set.id === baseId ? 'is-active' : ''}
              onClick={() => {
                // Same rule as the trainer: choosing a set is not a vote on
                // how to solve the last layer, so it falls back to the setting.
                const twoLook = TWO_LOOK_SETS[set.id];
                onSet(twoLookDefault && twoLook !== undefined ? twoLook : set.id);
              }}
            >
              {set.name}
            </button>
          ))}
      </div>

      {twoLookId === undefined ? null : (
        <div className="trainer__looks">
          <button
            type="button"
            className={isTwoLook ? 'is-active' : ''}
            aria-pressed={isTwoLook}
            onClick={() => onSet(twoLookId)}
          >
            {strings.trainer.twoLook}
          </button>
          <button
            type="button"
            className={isTwoLook ? '' : 'is-active'}
            aria-pressed={!isTwoLook}
            onClick={() => onSet(baseId)}
          >
            {strings.trainer.fullSet}
          </button>
        </div>
      )}
    </>
  );
}

interface DrillModesProps {
  mode: DrillMode;
  onMode: (mode: DrillMode) => void;
}

/**
 * The two halves of drilling a case: performing it against the clock, and
 * only saying which one it is. Same set and same ticked cases — what changes
 * is which half of the skill is being timed.
 *
 * It sits inside each mode's own header rather than above both, so that it
 * goes away with everything else while a solve is running.
 */
export function DrillModes({ mode, onMode }: DrillModesProps) {
  return (
    <div className="trainer__looks">
      <button
        type="button"
        className={mode === 'solve' ? 'is-active' : ''}
        aria-pressed={mode === 'solve'}
        onClick={() => onMode('solve')}
      >
        {strings.drill.modeSolve}
      </button>
      <button
        type="button"
        className={mode === 'recognise' ? 'is-active' : ''}
        aria-pressed={mode === 'recognise'}
        onClick={() => onMode('recognise')}
      >
        {strings.drill.modeRecognise}
      </button>
    </div>
  );
}
