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
    const existing = await db.sessions.where('[puzzle+mode+isActive]').equals([puzzle, mode, 1]).first();
    if (existing) return existing;

    const timestamp = now();
    const session: Session = {
      id: createId(),
      name: DEFAULT_SESSION_NAME,
      puzzle,
      mode,
      methodId: DEFAULT_METHOD_ID,
      isArchived: 0,
      isActive: 1,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    await db.sessions.add(session);
    return session;
  });
}

export async function getSession(id: string): Promise<Session | undefined> {
  return db.sessions.get(id);
}
