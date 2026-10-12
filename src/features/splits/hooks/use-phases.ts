import { useLiveQuery } from 'dexie-react-hooks';
import type { MethodPhase } from '../../../db/types';
import { getMethod, getMethodPhases } from '../../../db/repositories/method-repository';

const NONE: MethodPhase[] = [];

/**
 * The phases a session's method is made of, in order. Everything about splits
 * hangs off this: which phase a tap ends, which columns the stats table has,
 * which rows the editor offers.
 */
export function usePhases(methodId: string | null): MethodPhase[] {
  const phases = useLiveQuery(
    async () => (methodId === null ? NONE : getMethodPhases(methodId)),
    [methodId],
  );
  return phases ?? NONE;
}

/** What a method is called, for saying whose phases a table is about. */
export function useMethodName(methodId: string | null): string | null {
  const name = useLiveQuery(
    async () => (methodId === null ? null : ((await getMethod(methodId))?.name ?? null)),
    [methodId],
  );
  return name ?? null;
}
