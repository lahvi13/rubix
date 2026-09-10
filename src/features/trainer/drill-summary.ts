import type { DrillMode } from '../../db/repositories/settings-repository';
import { FULL_SETS, TWO_LOOK_SETS } from '../../db/seed/packs';
import { strings } from '../../lib/strings';

/**
 * What the folded drill controls are set to: the route through the last layer
 * where there is a choice, which half is being drilled, and how much of the
 * set.
 *
 * The set itself is left out — its row stays on screen above the line, with
 * the chosen one already marked.
 */
export function drillSummary(
  setId: string,
  mode: DrillMode,
  caseIds: readonly string[],
  selectedIds: readonly string[],
): string {
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
