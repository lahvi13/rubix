import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../schema';
import { addSolve } from './solve-repository';
import {
  activateSession,
  createSession,
  deleteSession,
  getActiveSession,
  getOrCreateActiveSession,
  listSessions,
  renameSession,
  setSessionArchived,
} from './session-repository';

describe('session repository', () => {
  beforeEach(async () => {
    await Promise.all(db.tables.map((table) => table.clear()));
  });

  it('creates the default session once and reuses it afterwards', async () => {
    const first = await getOrCreateActiveSession('333', 'freestyle');
    const second = await getOrCreateActiveSession('333', 'freestyle');

    expect(second.id).toBe(first.id);
    expect(await db.sessions.count()).toBe(1);
  });

  it('keeps drill and freestyle sessions apart', async () => {
    await getOrCreateActiveSession('333', 'freestyle');
    await getOrCreateActiveSession('333', 'drill');

    expect(await db.sessions.count()).toBe(2);
  });

  it('leaves exactly one active session per puzzle and mode', async () => {
    const first = await getOrCreateActiveSession('333', 'freestyle');
    const second = await createSession('Evening', '333', 'freestyle');

    const active = await getActiveSession('333', 'freestyle');
    expect(active?.id).toBe(second.id);
    expect((await db.sessions.get(first.id))?.isActive).toBe(0);
  });

  it('does not deactivate a session of another mode', async () => {
    const drill = await getOrCreateActiveSession('333', 'drill');
    await createSession('Evening', '333', 'freestyle');

    expect((await db.sessions.get(drill.id))?.isActive).toBe(1);
  });

  it('switches the active session back', async () => {
    const first = await getOrCreateActiveSession('333', 'freestyle');
    await createSession('Evening', '333', 'freestyle');
    await activateSession(first.id);

    expect((await getActiveSession('333', 'freestyle'))?.id).toBe(first.id);
    const all = await db.sessions.toArray();
    expect(all.filter((session) => session.isActive === 1)).toHaveLength(1);
  });

  it('never leaves an archived session active, so solves cannot land out of sight', async () => {
    const session = await getOrCreateActiveSession('333', 'freestyle');
    await setSessionArchived(session.id, true);

    const stored = await db.sessions.get(session.id);
    expect(stored?.isArchived).toBe(1);
    expect(stored?.isActive).toBe(0);
    expect(await getActiveSession('333', 'freestyle')).toBeNull();
  });

  it('unarchives a session when it is activated again', async () => {
    const session = await getOrCreateActiveSession('333', 'freestyle');
    await setSessionArchived(session.id, true);
    await activateSession(session.id);

    const stored = await db.sessions.get(session.id);
    expect(stored?.isArchived).toBe(0);
    expect(stored?.isActive).toBe(1);
  });

  it('hides archived sessions from the default listing', async () => {
    const session = await getOrCreateActiveSession('333', 'freestyle');
    await createSession('Evening', '333', 'freestyle');
    await setSessionArchived(session.id, true);

    expect(await listSessions()).toHaveLength(1);
    expect(await listSessions(true)).toHaveLength(2);
  });

  it('renames without touching anything else', async () => {
    const session = await getOrCreateActiveSession('333', 'freestyle');
    await renameSession(session.id, 'One-handed');

    const stored = await db.sessions.get(session.id);
    expect(stored?.name).toBe('One-handed');
    expect(stored?.isActive).toBe(1);
    expect(stored?.createdAt).toBe(session.createdAt);
  });
  it('leaves drill sessions out when a mode is asked for', async () => {
    await getOrCreateActiveSession('333', 'freestyle');
    await getOrCreateActiveSession('333', 'drill');

    expect(await listSessions()).toHaveLength(2);
    expect((await listSessions(false, 'freestyle')).every((s) => s.mode === 'freestyle')).toBe(true);
    expect(await listSessions(false, 'freestyle')).toHaveLength(1);
  });
});
describe('deleting a session', () => {
  beforeEach(async () => {
    await Promise.all(db.tables.map((table) => table.clear()));
  });

  async function seedSolve(sessionId: string) {
    return addSolve({
      sessionId,
      puzzle: '333',
      mode: 'freestyle',
      scramble: "R U R' U'",
      rawMs: 12_340,
      penalty: 'none',
      penaltySource: 'auto',
      inspectionMs: null,
      startedAt: Date.now(),
    });
  }

  it('takes the solves timed into it with it', async () => {
    const session = await getOrCreateActiveSession('333', 'freestyle');
    const keeper = await createSession('Evening', '333', 'freestyle');
    const doomed = await seedSolve(session.id);
    const kept = await seedSolve(keeper.id);

    await deleteSession(session.id);

    expect(await db.sessions.get(session.id)).toBeUndefined();
    expect(await db.solves.get(doomed.id)).toBeUndefined();
    // Only its own: another session's solves are not in the blast radius.
    expect(await db.solves.get(kept.id)).toBeDefined();
  });

  it('leaves a grave for the session and for every solve', async () => {
    const session = await getOrCreateActiveSession('333', 'freestyle');
    const solve = await seedSolve(session.id);

    await deleteSession(session.id);

    const graves = await db.tombstones.toArray();
    expect(graves).toContainEqual(
      expect.objectContaining({ id: session.id, table: 'sessions' }),
    );
    expect(graves).toContainEqual(expect.objectContaining({ id: solve.id, table: 'solves' }));
  });

  // Otherwise the next solve lands in a session that is not there any more.
  it('leaves nothing active when the active session goes', async () => {
    const session = await getOrCreateActiveSession('333', 'freestyle');

    await deleteSession(session.id);

    expect(await getActiveSession('333', 'freestyle')).toBeNull();
    expect((await getOrCreateActiveSession('333', 'freestyle')).id).not.toBe(session.id);
  });
});
