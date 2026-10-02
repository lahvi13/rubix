import { CROSS_SET_ID, FULL_SETS, TWO_LOOK_SETS } from '../../domain/alg/sets';
import { strings } from '../../lib/strings';

/**
 * What the folded drill controls are set to: how much of the set, then the
 * route through the last layer where there is a choice.
 *
 * The cases lead, named. "2-Look · 7 / 10" read as one more setting of the set
 * rather than as the place the cases are picked, and that is what the line is
 * opened for.
 *
 * The set and the half being drilled are left out — their rows stay on screen
 * above the line, with the chosen ones already marked.
 *
 * The cross has none of those things: one case, no cases to tick, and only one
 * half to drill. What is behind its line is the inspection switch, so that is
 * what the line reports — a line that reads back the one setting you might
 * want to check is worth more than one naming a mode you cannot change.
 */
export function drillSummary(
  setId: string,
  caseIds: readonly string[],
  selectedIds: readonly string[],
  crossInspection = false,
): string {
  if (setId === CROSS_SET_ID) {
    return crossInspection ? strings.drill.inspectionOn : strings.drill.inspectionOff;
  }

  const baseId = FULL_SETS[setId] ?? setId;
  const twoLookId = TWO_LOOK_SETS[baseId];
  const parts: string[] = [];

  if (caseIds.length > 0) {
    const ticked = caseIds.filter((id) => selectedIds.includes(id));
    const count = ticked.length === 0 ? caseIds.length : ticked.length;
    parts.push(`${strings.drill.pool} ${count} / ${caseIds.length}`);
  }
  if (twoLookId !== undefined) {
    parts.push(setId === twoLookId ? strings.trainer.twoLook : strings.trainer.fullSet);
  }

  return parts.join(' · ');
}
