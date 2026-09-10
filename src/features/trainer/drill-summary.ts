import type { DrillMode } from '../../db/repositories/settings-repository';
import { CROSS_SET_ID, FULL_SETS, TWO_LOOK_SETS } from '../../db/seed/packs';
import { strings } from '../../lib/strings';

/**
 * What the folded drill controls are set to: the route through the last layer
 * where there is a choice, which half is being drilled, and how much of the
 * set.
 *
 * The set itself is left out — its row stays on screen above the line, with
 * the chosen one already marked.
 *
 * The cross has none of those things: one case, no cases to tick, and only one
 * half to drill. What is behind its line is the inspection switch, so that is
 * what the line reports — a line that reads back the one setting you might
 * want to check is worth more than one naming a mode you cannot change.
 */
export function drillSummary(
  setId: string,
  mode: DrillMode,
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

  if (twoLookId !== undefined) {
    parts.push(setId === twoLookId ? strings.trainer.twoLook : strings.trainer.fullSet);
  }
  parts.push(mode === 'recognise' ? strings.drill.modeRecognise : strings.drill.modeSolve);
  if (caseIds.length > 0) {
    const ticked = caseIds.filter((id) => selectedIds.includes(id));
    parts.push(`${ticked.length === 0 ? caseIds.length : ticked.length} / ${caseIds.length}`);
  }

  return parts.join(' · ');
}
