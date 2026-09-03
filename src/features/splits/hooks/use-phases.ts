import { useLiveQuery } from 'dexie-react-hooks';
import type { MethodPhase } from '../../../db/types';
import { getMethodPhases } from '../../../db/repositories/method-repository';

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
