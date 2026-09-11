import { useLiveQuery } from 'dexie-react-hooks';
import type { AlgCase, Algorithm } from '../../../db/types';
import {
  addUserAlgorithm,
  deleteUserAlgorithm,
  getCase,
  listAlgorithms,
  setActiveAlgorithm,
  setCaseLabel,
} from '../../../db/repositories/alg-repository';
import { deleteCaseRecognitions } from '../../../db/repositories/recognition-repository';
import { parseAlg, type Move, type MoveGroup } from '../../../domain/cube/notation';

export interface CaseDetailView {
  algCase: AlgCase | null;
  algorithms: Algorithm[];
  active: Algorithm | null;
  /** The active algorithm's moves, or an empty list while it loads. */
  moves: Move[];
  /** The brackets it was written with, for the same reason. */
  groups: MoveGroup[];
  isLoading: boolean;
  choose: (algorithmId: string) => Promise<void>;
  addVariant: (moves: string) => Promise<void>;
  removeVariant: (algorithmId: string) => Promise<void>;
  /** What the reader calls this case; empty puts the pack name back. */
  rename: (label: string) => Promise<void>;
  /** Throw away the recognition attempts, leaving the timed ones alone. */
  forgetRecognition: () => Promise<void>;
}

export function useCaseDetail(caseId: string | null): CaseDetailView {
  const data = useLiveQuery(async () => {
    if (caseId === null) return null;
    const [algCase, algorithms] = await Promise.all([getCase(caseId), listAlgorithms(caseId)]);
    return { algCase: algCase ?? null, algorithms };
  }, [caseId]);

  const algorithms = data?.algorithms ?? [];
  const active = algorithms.find((algorithm) => algorithm.isActive === 1) ?? null;
  const parsed = active === null ? null : parseAlg(active.moves);

  return {
    algCase: data?.algCase ?? null,
    algorithms,
    active,
    moves: parsed?.ok ? parsed.moves : [],
    groups: parsed?.ok ? parsed.groups : [],
    isLoading: caseId !== null && data === undefined,
    choose: setActiveAlgorithm,
    addVariant: async (moves) => {
      if (caseId === null) return;
      await addUserAlgorithm(caseId, moves);
    },
    removeVariant: deleteUserAlgorithm,
    rename: async (label) => {
      if (caseId === null) return;
      await setCaseLabel(caseId, label);
    },
    forgetRecognition: async () => {
      if (caseId === null) return;
      await deleteCaseRecognitions(caseId);
    },
  };
}
