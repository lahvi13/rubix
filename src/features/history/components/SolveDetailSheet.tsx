import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import type { MethodPhase } from '../../../db/types';
import { getSession } from '../../../db/repositories/session-repository';
import { getSolve, updateSolve, type SolvePatch } from '../../../db/repositories/solve-repository';
import { useMoveSolves } from '../../../hooks/use-move-solves';
import { useSessionRecords } from '../../../hooks/use-session-records';
import { useRemoveSolves } from '../../../hooks/use-remove-solves';
import { watchWrite } from '../../../lib/errors';
import { strings } from '../../../lib/strings';
import { SessionPicker } from '../../sessions';
import { useTags } from '../hooks/use-tags';
import { SolveDetail } from './SolveDetail';

interface SolveDetailSheetProps {
  solveId: string;
  phases: readonly MethodPhase[];
  /** The solves this one is among, in the order they are shown. */
  solveIds: readonly string[];
  /** Opens another of them — how the sheet steps through the list. */
  onOpen: (id: string) => void;
  onClose: () => void;
}

/**
 * The solve detail, opened from anywhere by id. The history has the solve in
 * hand already, but the timer's own list does not, and a second copy of this
 * wiring is how the two screens would start to differ.
 */
export function SolveDetailSheet({
  solveId,
  phases,
  solveIds,
  onOpen,
  onClose,
}: SolveDetailSheetProps) {
  const solve = useLiveQuery(() => getSolve(solveId), [solveId]);
  // Read from the solve's own session, which is not always the one on screen:
  // the stats offer the all-time best, and that may have been set elsewhere.
  const phaseKeys = useMemo(() => phases.map((phase) => phase.key), [phases]);
  const { bests, globalPbMs } = useSessionRecords(
    solve?.sessionId ?? null,
    solve?.puzzle ?? '333',
    phaseKeys,
  );
  const session = useLiveQuery(
    async () => (solve ? ((await getSession(solve.sessionId)) ?? null) : null),
    [solve?.sessionId],
  );
  const tags = useTags();
  const removeSolves = useRemoveSolves();
  const moveSolves = useMoveSolves();
  const [isMoving, setMoving] = useState(false);

  if (!solve) return null;

  // Counted from the solve on screen rather than the one asked for: the query
  // holds the previous row for a tick after the id changes, and reading the
  // id would have the count say "2 of 2" over the first one's numbers.
  //
  // Stepping stops at the end of what the screen has loaded rather than
  // fetching more: a list that grows under a swipe has no end to reach.
  const at = solveIds.indexOf(solve.id);
  const paging =
    at < 0
      ? undefined
      : {
          position: at + 1,
          total: solveIds.length,
          onPrevious: at > 0 ? () => onOpen(solveIds[at - 1] ?? solve.id) : null,
          onNext:
            at < solveIds.length - 1 ? () => onOpen(solveIds[at + 1] ?? solve.id) : null,
        };

  // The sheet turns into the choice rather than stacking one on top of it: two
  // panels deep, the one underneath is covered anyway and only the way back out
  // gets harder. Once the solve is filed elsewhere this detail is showing a
  // solve from a session nobody is looking at, so the move closes it.
  if (isMoving) {
    return (
      <SessionPicker
        title={strings.history.moveTitle}
        onPick={(sessionId, name) => {
          void moveSolves([solve.id], sessionId, name);
          onClose();
        }}
        onClose={() => setMoving(false)}
      />
    );
  }

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
      onMove={() => setMoving(true)}
      paging={paging}
      bests={bests}
      globalPbMs={globalPbMs}
      sessionName={session?.name ?? null}
      onClose={onClose}
    />
  );
}
