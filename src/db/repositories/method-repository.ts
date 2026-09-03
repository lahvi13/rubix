import { db } from '../schema';
import type { Method, MethodPhase } from '../types';

/**
 * The methods table has been in the schema since v1 but nothing read it until
 * phase splits arrived. Phases come from here, never from an enum in the
 * code: a split's phase is a free string pointing at Method.phases[].key
 * (SPEC 3.6), so adding Roux later is data, not a migration.
 */
export async function getMethod(id: string): Promise<Method | undefined> {
  return db.methods.get(id);
}

/** Phase keys in method order — the order splits are assigned in. */
export async function getMethodPhases(id: string): Promise<MethodPhase[]> {
  const method = await db.methods.get(id);
  return [...(method?.phases ?? [])].sort((a, b) => a.order - b.order);
}
