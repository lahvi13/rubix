import type { Flag } from '../../db/types';

export interface Activatable {
  id: string;
  isActive: Flag;
  updatedAt: number;
}

/**
 * The rows that claim to be the active one of their group beside another that
 * has the better claim, and so have to be switched off.
 *
 * Each device keeps its own active session per puzzle and mode, and its own
 * active algorithm per case, and a merge brings both. The one changed last is
 * the one somebody chose last, so it stays; an exact tie goes to the lower id,
 * so every device settles on the same row.
 */
export function supersededActives<T extends Activatable>(
  rows: readonly T[],
  groupOf: (row: T) => string,
): string[] {
  const kept = new Map<string, T>();
  const superseded: string[] = [];

  for (const row of rows) {
    if (row.isActive !== 1) continue;
    const group = groupOf(row);
    const other = kept.get(group);
    if (other === undefined) {
      kept.set(group, row);
      continue;
    }
    const isBetter =
      row.updatedAt > other.updatedAt || (row.updatedAt === other.updatedAt && row.id < other.id);
    superseded.push(isBetter ? other.id : row.id);
    if (isBetter) kept.set(group, row);
  }

  return superseded;
}
