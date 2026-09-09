import { useLiveQuery } from 'dexie-react-hooks';
import type { Puzzle, Session, SolveMode } from '../../../db/types';
import {
  activateSession,
  createSession,
  deleteSession,
  listSessions,
  renameSession,
  setSessionArchived,
} from '../../../db/repositories/session-repository';
import { countSolves } from '../../../db/repositories/solve-repository';

export interface SessionWithCount extends Session {
  solveCount: number;
}

export interface SessionsView {
  sessions: SessionWithCount[];
  isLoading: boolean;
  create: (name: string, puzzle: Puzzle, mode: SolveMode) => Promise<void>;
  rename: (id: string, name: string) => Promise<void>;
  activate: (id: string) => Promise<void>;
  setArchived: (id: string, archived: boolean) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

/**
 * The sessions worth switching between. Freestyle only: the drill has an
 * active session of its own, and putting it in this list would offer a switch
 * that changes nothing anybody can see.
 */
export function useSessions(includeArchived: boolean): SessionsView {
  const sessions = useLiveQuery(async () => {
    const rows = await listSessions(includeArchived, 'freestyle');
    return Promise.all(
      rows.map(async (session) => ({
        ...session,
        solveCount: await countSolves(session.id),
      })),
    );
  }, [includeArchived]);

  return {
    sessions: sessions ?? [],
    isLoading: sessions === undefined,
    create: async (name, puzzle, mode) => {
      await createSession(name, puzzle, mode);
    },
    rename: renameSession,
    activate: activateSession,
    setArchived: async (id, archived) => setSessionArchived(id, archived),
    remove: deleteSession,
  };
}
