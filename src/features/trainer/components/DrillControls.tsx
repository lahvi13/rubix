import { InHeader } from '../../../components/HeaderSlot';
import { useState, type ReactNode } from 'react';
import type { AlgSet } from '../../../db/types';
import type { DrillMode } from '../../../db/repositories/settings-repository';
import {
  BEGINNER_SET_ID,
  FULL_SETS,
  LEVEL_BASE_SETS,
  TWO_LOOK_SETS,
} from '../../../domain/alg/sets';
import { ChevronIcon } from '../../../components/Icons';
import { useSetting } from '../../../hooks/use-setting';
import { packLabel, strings } from '../../../lib/strings';
import { baseSetOf, entryOf, levelName, levelsOf, withLastLevel } from '../levels';

interface DrillSetsProps {
  sets: readonly AlgSet[];
  /** The set being drilled — a two-look set is one of these, not a mode. */
  setId: string;
  onSet: (setId: string) => void;
}

/** The set being drilled, out of the ones there is anything to drill in. */
function drillableSets(sets: readonly AlgSet[]): readonly AlgSet[] {
  // The guide's own set is not offered here: it is a route through one solve
  // rather than a set to work on, and it is drilled from there.
  return sets.filter(
    (set) =>
      !Object.hasOwn(FULL_SETS, set.id) &&
      !Object.hasOwn(LEVEL_BASE_SETS, set.id) &&
      set.id !== BEGINNER_SET_ID,
  );
}

/** Which set the drill draws from. The one row that is never folded away. */
export function DrillSets({ sets, setId, onSet }: DrillSetsProps) {
  const [twoLookDefault] = useSetting('trainer.twoLookDefault');
  const [lastLevels] = useSetting('trainer.lastLevels');
  const baseId = baseSetOf(FULL_SETS[setId] ?? setId);

  return (
    <div className="trainer__sets">
      {drillableSets(sets).map((set) => (
        <button
          key={set.id}
          type="button"
          className={set.id === baseId ? 'is-active' : ''}
          onClick={() => {
            // Same rule as the trainer: choosing a set is not a vote on how to
            // solve the last layer, so it opens on the look last chosen.
            // A set with levels goes back to the one last looked at, in the
            // trainer or here — the same row, the same person.
            const twoLook = TWO_LOOK_SETS[set.id];
            onSet(
              twoLookDefault && twoLook !== undefined ? twoLook : entryOf(set.id, lastLevels),
            );
          }}
        >
          {packLabel(set.name)}
        </button>
      ))}
    </div>
  );
}

/**
 * Which way through the last layer, for the sets that have two.
 *
 * Two-look OLL and PLL are sets in their own right (SPEC 3.5), so they could
 * simply sit in the row beside the full ones — but "OLL" and "2-Look OLL" as
 * neighbours reads as two subjects rather than two routes through one, and
 * hides that picking either is the same decision the trainer already asked.
 */
export function DrillLooks({ setId, onSet }: Omit<DrillSetsProps, 'sets'>) {
  // Chosen here, it is the look the trainer opens on too: one person, one
  // way through the last layer.
  const [, setTwoLook] = useSetting('trainer.twoLookDefault');
  const baseId = FULL_SETS[setId] ?? setId;
  const twoLookId = TWO_LOOK_SETS[baseId];
  if (twoLookId === undefined) return null;
  const isTwoLook = setId === twoLookId;

  return (
    <div className="trainer__looks">
      <button
        type="button"
        className={isTwoLook ? 'is-active' : ''}
        aria-pressed={isTwoLook}
        onClick={() => {
          setTwoLook(true);
          onSet(twoLookId);
        }}
      >
        {strings.trainer.twoLook}
      </button>
      <button
        type="button"
        className={isTwoLook ? '' : 'is-active'}
        aria-pressed={!isTwoLook}
        onClick={() => {
          setTwoLook(false);
          onSet(baseId);
        }}
      >
        {strings.trainer.fullSet}
      </button>
    </div>
  );
}

/**
 * How far into the set, for the sets that go further. Same switch the trainer
 * shows, so a set is drilled at the level it was being read at.
 */
export function DrillLevels({ setId, onSet }: Omit<DrillSetsProps, 'sets'>) {
  const [lastLevels, setLastLevels] = useSetting('trainer.lastLevels');
  const levels = levelsOf(baseSetOf(setId));
  if (levels.length === 0) return null;

  return (
    <div className="trainer__looks">
      {levels.map((id) => (
        <button
          key={id}
          type="button"
          className={id === setId ? 'is-active' : ''}
          aria-pressed={id === setId}
          onClick={() => {
            onSet(id);
            setLastLevels(withLastLevel(lastLevels, id));
          }}
        >
          {levelName(id)}
        </button>
      ))}
    </div>
  );
}

interface DrillModesProps {
  mode: DrillMode;
  onMode: (mode: DrillMode) => void;
  /** False for the cross, which has no case to name and so only one half. */
  canRecognise: boolean;
}

/**
 * The two halves of drilling a case: performing it against the clock, and
 * only saying which one it is. Same set and same ticked cases — what changes
 * is which half of the skill is being timed.
 *
 * Tabs at the very top rather than a switch among the settings: they are two
 * different screens, not two values of one, and the choice comes before the
 * set — first what you are doing, then on what. Folded into the settings line
 * as one word, it was the thing on the screen nobody found. The cross has
 * nothing to name, so its second tab is there but off: the row stays put when
 * the set changes under it.
 */
export function DrillModes({ mode, onMode, canRecognise }: DrillModesProps) {
  // In the header, beside "Drill": a row of their own cost the cards under the
  // cube their bottom row on a phone with large text.
  return (
    <InHeader>
    <div className="drill__tabs" role="group" aria-label={strings.drill.modes}>
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
        disabled={!canRecognise}
        title={canRecognise ? undefined : strings.drill.nothingToName}
        onClick={() => onMode('recognise')}
      >
        {strings.drill.modeRecognise}
      </button>
    </div>
    </InHeader>
  );
}

interface DrillSetupProps {
  /** What the folded controls are set to, so the line can be read instead. */
  summary: string;
  /** Handed the way to fold it again, for a button at the foot of a long list. */
  children: (close: () => void) => ReactNode;
}

/**
 * Everything except the set row, folded into the one line that says what it
 * is set to.
 *
 * Three rows of switches are worth a quarter of a phone screen and are touched
 * once a session, while what the screen is actually for — a scramble and a
 * clock, or a cube and six cards — has to be taken in without scrolling. It
 * is full width with a chevron rather than a button the eye can mistake for
 * one more option.
 */
export function DrillSetup({ summary, children }: DrillSetupProps) {
  const [isOpen, setOpen] = useState(false);

  return (
    <div className="drill__setup-fold">
      <button
        type="button"
        className="drill__pool-toggle"
        aria-expanded={isOpen}
        aria-label={`${strings.drill.setup}: ${summary}`}
        onClick={() => setOpen((open) => !open)}
      >
        <span>{summary}</span>
        <ChevronIcon up={isOpen} />
      </button>
      {isOpen ? <div className="drill__setup-panel">{children(() => setOpen(false))}</div> : null}
    </div>
  );
}
