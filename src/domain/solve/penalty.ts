import type { Penalty } from '../../db/types';

/** WCA regulation A3: 15 seconds of inspection. */
export const INSPECTION_LIMIT_MS = 15_000;
/** Between 15 and 17 seconds it is +2; beyond 17 seconds it is a DNF. */
export const INSPECTION_DNF_LIMIT_MS = 17_000;

/**
 * Penalty implied by how long inspection took. Applied with
 * penaltySource: 'auto' so the UI can show it was not the user's doing.
 */
export function penaltyForInspection(inspectionMs: number | null): Penalty {
  if (inspectionMs === null) return 'none';
  if (inspectionMs > INSPECTION_DNF_LIMIT_MS) return 'dnf';
  if (inspectionMs > INSPECTION_LIMIT_MS) return 'plus2';
  return 'none';
}

/**
 * Clicking the penalty that is already set clears it — that is how every
 * cubing timer behaves, and it saves a separate "no penalty" button.
 */
export function togglePenalty(current: Penalty, pressed: Exclude<Penalty, 'none'>): Penalty {
  return current === pressed ? 'none' : pressed;
}
