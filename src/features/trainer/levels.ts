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

/**
 * Where picking a set in the row lands: the level last looked at in it, or the
 * set itself when it has no levels or none has been looked at yet.
 */
export function entryOf(setId: string, lastLevels: readonly string[]): string {
  return lastLevels.find((id) => baseSetOf(id) === setId) ?? setId;
}

/** The list with this level recorded as its set's last one, and no other of that set. */
export function withLastLevel(lastLevels: readonly string[], levelId: string): string[] {
  const base = baseSetOf(levelId);
  return [...lastLevels.filter((id) => baseSetOf(id) !== base), levelId];
}

export function levelName(setId: string): string {
  return LABELS[setId] ?? setId;
}
