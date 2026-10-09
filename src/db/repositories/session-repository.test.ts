import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../schema';
import { addSolve } from './solve-repository';
import {
  activateSession,
  createSession,
  deleteSession,
  restoreSession,
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

  it('times a session in CFOP unless it is given another method', async () => {
    expect((await createSession('Evening', '333', 'freestyle')).methodId).toBe('cfop');
    const roux = await createSession('Roux', '333', 'freestyle', 'roux');
    expect((await db.sessions.get(roux.id))?.methodId).toBe('roux');
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
describe('what stays active when the active session goes away', () => {
  beforeEach(async () => {
    await Promise.all(db.tables.map((table) => table.clear()));
  });

  it('adopts a session that is already there rather than making another', async () => {
    const first = await getOrCreateActiveSession('333', 'freestyle');
    const evening = await createSession('Evening', '333', 'freestyle');
    await activateSession(first.id);

    await deleteSession(first.id);

    expect((await getOrCreateActiveSession('333', 'freestyle')).id).toBe(evening.id);
    expect(await db.sessions.count()).toBe(1);
  });

  // Archiving clears isActive too, and used to leave the same hole.
  it('adopts one when the active session is archived instead of deleted', async () => {
    const first = await getOrCreateActiveSession('333', 'freestyle');
    const evening = await createSession('Evening', '333', 'freestyle');
    await activateSession(first.id);

    await setSessionArchived(first.id, true);

    expect((await getOrCreateActiveSession('333', 'freestyle')).id).toBe(evening.id);
    expect((await listSessions()).filter((s) => s.name === 'Default')).toHaveLength(0);
  });

  it('will not adopt an archived session, and makes one when there is nothing else', async () => {
    const only = await getOrCreateActiveSession('333', 'freestyle');
    const old = await createSession('Old', '333', 'freestyle');
    await setSessionArchived(old.id, true);
    await activateSession(only.id);

    await deleteSession(only.id);
    const fresh = await getOrCreateActiveSession('333', 'freestyle');

    expect(fresh.id).not.toBe(old.id);
    expect(fresh.name).toBe('Default');
  });

  // A drill session is not a freestyle session to fall back on.
  it('does not adopt across modes', async () => {
    const drill = await getOrCreateActiveSession('333', 'drill');
    const freestyle = await getOrCreateActiveSession('333', 'freestyle');

    await deleteSession(freestyle.id);
    const fresh = await getOrCreateActiveSession('333', 'freestyle');

    expect(fresh.id).not.toBe(drill.id);
    expect(fresh.mode).toBe('freestyle');
  });
});
describe('putting a deleted session back', () => {
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

  it('brings back the session, its solves and no graves', async () => {
    const session = await getOrCreateActiveSession('333', 'freestyle');
    const solve = await seedSolve(session.id);

    const deleted = await deleteSession(session.id);
    await restoreSession(deleted!);

    expect(await db.sessions.get(session.id)).toBeDefined();
    expect(await db.solves.get(solve.id)).toBeDefined();
    // A row back with its grave still standing is deleted again on import.
    expect(await db.tombstones.get(session.id)).toBeUndefined();
    expect(await db.tombstones.get(solve.id)).toBeUndefined();
  });

  // Two active sessions for one puzzle and mode is a state nothing can read.
  it('stands down whatever was adopted while it was gone', async () => {
    const session = await getOrCreateActiveSession('333', 'freestyle');
    const spare = await createSession('Evening', '333', 'freestyle');
    await activateSession(session.id);

    const deleted = await deleteSession(session.id);
    // The app adopts the spare the moment something asks for an active session.
    expect((await getOrCreateActiveSession('333', 'freestyle')).id).toBe(spare.id);

    await restoreSession(deleted!);

    expect((await getActiveSession('333', 'freestyle'))?.id).toBe(session.id);
    expect(await db.sessions.where('[puzzle+mode+isActive]').equals(['333', 'freestyle', 1]).count())
      .toBe(1);
  });

  it('reports nothing for a session that is not there', async () => {
    expect(await deleteSession('missing')).toBeNull();
  });
});
