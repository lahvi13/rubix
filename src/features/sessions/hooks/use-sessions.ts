import { useLiveQuery } from 'dexie-react-hooks';
import type { Method, Puzzle, Session, SolveMode } from '../../../db/types';
import { listMethods } from '../../../db/repositories/method-repository';
import {
  activateSession,
  createSession,
  DEFAULT_METHOD_ID,
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
  /** The methods a new session can be timed in. */
  methods: Method[];
  /** What a new session is timed in unless told otherwise: the active one's method. */
  newMethodId: string;
  isLoading: boolean;
  create: (name: string, puzzle: Puzzle, mode: SolveMode, methodId: string) => Promise<void>;
  rename: (id: string, name: string) => Promise<void>;
  activate: (id: string) => Promise<void>;
  setArchived: (id: string, archived: boolean) => Promise<void>;
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
  const methods = useLiveQuery(listMethods, []);

  return {
    sessions: sessions ?? [],
    methods: methods ?? [],
    newMethodId:
      sessions?.find((session) => session.isActive === 1)?.methodId ?? DEFAULT_METHOD_ID,
    isLoading: sessions === undefined,
    create: async (name, puzzle, mode, methodId) => {
      await createSession(name, puzzle, mode, methodId);
    },
    rename: renameSession,
    activate: activateSession,
    setArchived: async (id, archived) => setSessionArchived(id, archived),
  };
}
