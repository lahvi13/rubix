import { db } from '../schema';
import type { Puzzle, Session, SolveMode } from '../types';
import { now } from '../../lib/clock';
import { createId } from '../../lib/uuid';

export const DEFAULT_METHOD_ID = 'cfop';
const DEFAULT_SESSION_NAME = 'Default';

/**
 * Returns the active session for the given puzzle/mode, creating one on first
 * run. Wrapped in a transaction so two concurrent callers cannot both insert.
 */
export async function getOrCreateActiveSession(
  puzzle: Puzzle,
  mode: SolveMode,
): Promise<Session> {
  return db.transaction('rw', db.sessions, async () => {
    const existing = await db.sessions
      .where('[puzzle+mode+isActive]')
      .equals([puzzle, mode, 1])
      .first();
    if (existing) return existing;

    const session = buildSession(DEFAULT_SESSION_NAME, puzzle, mode);
    await db.sessions.add(session);
    return session;
  });
}

export async function getSession(id: string): Promise<Session | undefined> {
  return db.sessions.get(id);
}

/** Read-only counterpart used by live queries; null means there is none yet. */
export async function getActiveSession(
  puzzle: Puzzle,
  mode: SolveMode,
): Promise<Session | null> {
  const session = await db.sessions.where('[puzzle+mode+isActive]').equals([puzzle, mode, 1]).first();
  return session ?? null;
}

/**
 * Newest first. The mode is worth passing: the drill keeps a session of its
 * own, and offering it in a picker would be offering a session that changes
 * nothing — the timer and the history are about freestyle solves.
 */
export async function listSessions(
  includeArchived = false,
  mode?: SolveMode,
): Promise<Session[]> {
  const sessions = await db.sessions.toArray();
  return sessions
    .filter((session) => includeArchived || session.isArchived === 0)
    .filter((session) => mode === undefined || session.mode === mode)
    .sort((a, b) => b.createdAt - a.createdAt);
}

/** Creating a session also makes it the active one — that is why you create it. */
export async function createSession(
  name: string,
  puzzle: Puzzle,
  mode: SolveMode,
): Promise<Session> {
  return db.transaction('rw', db.sessions, async () => {
    const session = buildSession(name, puzzle, mode);
    await clearActive(puzzle, mode);
    await db.sessions.add(session);
    return session;
  });
}

export async function renameSession(id: string, name: string): Promise<void> {
  await db.sessions.update(id, { name, updatedAt: now() });
}

export async function activateSession(id: string): Promise<void> {
  await db.transaction('rw', db.sessions, async () => {
    const session = await db.sessions.get(id);
    if (!session) return;

    await clearActive(session.puzzle, session.mode);
    await db.sessions.update(id, { isActive: 1, isArchived: 0, updatedAt: now() });
  });
}

/**
 * Archiving hides a session from the pickers. An archived session can never
 * stay active, otherwise new solves would land somewhere invisible.
 */
export async function setSessionArchived(id: string, archived: boolean): Promise<void> {
  await db.transaction('rw', db.sessions, async () => {
    const session = await db.sessions.get(id);
    if (!session) return;

    await db.sessions.update(id, {
      isArchived: archived ? 1 : 0,
      isActive: archived ? 0 : session.isActive,
      updatedAt: now(),
    });
  });
}

function buildSession(name: string, puzzle: Puzzle, mode: SolveMode): Session {
  const timestamp = now();
  return {
    id: createId(),
    name,
    puzzle,
    mode,
    methodId: DEFAULT_METHOD_ID,
    isArchived: 0,
    isActive: 1,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

async function clearActive(puzzle: Puzzle, mode: SolveMode): Promise<void> {
  await db.sessions
    .where('[puzzle+mode+isActive]')
    .equals([puzzle, mode, 1])
    .modify({ isActive: 0, updatedAt: now() });
}
