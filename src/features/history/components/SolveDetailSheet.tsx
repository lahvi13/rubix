import { useLiveQuery } from 'dexie-react-hooks';
import type { MethodPhase } from '../../../db/types';
import { getSolve, updateSolve, type SolvePatch } from '../../../db/repositories/solve-repository';
import { useRemoveSolves } from '../../../hooks/use-remove-solves';
import { watchWrite } from '../../../lib/errors';
import { strings } from '../../../lib/strings';
import { useTags } from '../hooks/use-tags';
import { SolveDetail } from './SolveDetail';

interface SolveDetailSheetProps {
  solveId: string;
  phases: readonly MethodPhase[];
  onClose: () => void;
}

/**
 * The solve detail, opened from anywhere by id. The history has the solve in
 * hand already, but the timer's own list does not, and a second copy of this
 * wiring is how the two screens would start to differ.
 */
export function SolveDetailSheet({ solveId, phases, onClose }: SolveDetailSheetProps) {
  const solve = useLiveQuery(() => getSolve(solveId), [solveId]);
  const tags = useTags();
  const removeSolves = useRemoveSolves();

  if (!solve) return null;

  return (
    <SolveDetail
      // Keyed by solve id so opening another solve starts with fresh drafts
      // instead of syncing state in an effect.
      key={solve.id}
      solve={solve}
      phases={phases}
      tags={tags.tags}
      onEdit={(id: string, patch: SolvePatch) => {
        watchWrite(() => updateSolve(id, patch), strings.history.detailTitle);
      }}
      onCreateTag={tags.create}
      onDelete={(id: string) => {
        void removeSolves([id]);
        onClose();
      }}
      onClose={onClose}
    />
  );
}
