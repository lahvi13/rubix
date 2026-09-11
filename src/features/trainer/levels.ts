import { LEVEL_BASE_SETS, SET_LEVELS } from '../../db/seed/packs';
import { strings } from '../../lib/strings';

/**
 * How far into a set the screen is.
 *
 * A level is a set of its own in the database — its cases are not the base
 * set's cases seen differently, they are cases the base set does not have —
 * but it is not a subject of its own, so it is offered as a switch under the
 * set it belongs to rather than as a fourth name in the row.
 *
 * The names live here rather than in the pack, because the base set is called
 * F2L in its row and Basic on its switch, and only one of those is its name.
 */
const LABELS: Readonly<Record<string, string>> = {
  f2l: strings.trainer.levelBasic,
  'f2l-advanced': strings.trainer.levelAdvanced,
  'f2l-expert': strings.trainer.levelExpert,
};

/** The set a level hangs off; a set with no levels is its own base. */
export function baseSetOf(setId: string): string {
  return LEVEL_BASE_SETS[setId] ?? setId;
}

/** The levels of a set, base set first, or none where a set has no levels. */
export function levelsOf(setId: string | null): readonly string[] {
  return setId === null ? [] : (SET_LEVELS[setId] ?? []);
}

export function levelName(setId: string): string {
  return LABELS[setId] ?? setId;
}
