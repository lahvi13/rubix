/**
 * What a case is called on screen.
 *
 * Two names, because they answer different questions. `name` is the pack's —
 * "OLL 43" — and it is what every chart, video and forum post out there uses,
 * so it can never be taken away. `label` is what the reader calls it, and for
 * most of OLL that is the only name worth training against: nobody recognises
 * a cube and thinks "forty-three".
 */

import type { AlgCase } from '../../db/types';

/** Only the parts of a case that have a bearing on its name. */
export type NamedCase = Pick<AlgCase, 'name' | 'label'>;

export function caseTitle(algCase: NamedCase): string {
  const label = algCase.label?.trim() ?? '';
  return label === '' ? algCase.name : label;
}

/**
 * The pack's name, but only where it is not already the title — a case the
 * user has not renamed must not be captioned with its own name twice.
 */
export function caseAlias(algCase: NamedCase): string | null {
  return caseTitle(algCase) === algCase.name ? null : algCase.name;
}
