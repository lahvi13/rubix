import { db } from '../schema';
import type { Trigger } from '../types';
import { TRIGGER_COLOURS } from '../../domain/alg/triggers';
import { TRIGGER_PACK } from '../seed/triggers';
import { now } from '../../lib/clock';
import { createId } from '../../lib/uuid';

const PACK_TRIGGER_IDS = new Set(TRIGGER_PACK.map((trigger) => trigger.id));

/**
 * Whether this trigger shipped with the app.
 *
 * Asked of the id rather than of `source`, which says something else: editing
 * a built-in trigger makes it the reader's from then on, so that the app stops
 * updating it. That is about who owns the wording, not about where it came
 * from — and a built-in one that has been recoloured is still not theirs to
 * lose.
 */
export function isPackTrigger(id: string): boolean {
  return PACK_TRIGGER_IDS.has(id);
}

/**
 * Triggers are matched longest first, so the order they come back in decides
 * what an algorithm looks like: a longer sequence must get the chance to claim
 * its moves before a shorter one takes the first two.
 */
export async function listTriggers(): Promise<Trigger[]> {
  const triggers = await db.triggers.toArray();
  return triggers.sort((a, b) => {
    const byLength = b.moves.split(/\s+/).length - a.moves.split(/\s+/).length;
    return byLength !== 0 ? byLength : a.name.localeCompare(b.name);
  });
}

export async function listEnabledTriggers(): Promise<Trigger[]> {
  const triggers = await listTriggers();
  return triggers.filter((trigger) => trigger.isEnabled === 1);
}

export async function createTrigger(
  name: string,
  moves: string,
  colour: string = TRIGGER_COLOURS[0],
): Promise<Trigger> {
  const timestamp = now();
  const trigger: Trigger = {
    id: createId(),
    name: name.trim(),
    moves: moves.trim(),
    source: 'user',
    colour,
    isEnabled: 1,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  await db.triggers.add(trigger);
  return trigger;
}

/**
 * Editing a built-in trigger takes it over: the pack must not overwrite it on
 * the next start, and the only way to say that is to stop calling it a pack
 * row.
 */
export async function updateTrigger(
  id: string,
  changes: { name?: string; moves?: string; colour?: string },
): Promise<void> {
  const patch: Partial<Trigger> = { updatedAt: now(), source: 'user' };
  if (changes.name !== undefined) patch.name = changes.name.trim();
  if (changes.moves !== undefined) patch.moves = changes.moves.trim();
  if (changes.colour !== undefined) patch.colour = changes.colour;

  await db.triggers.update(id, patch);
}

/** Switching a trigger off leaves it in place; the pack keeps that choice. */
export async function setTriggerEnabled(id: string, enabled: boolean): Promise<void> {
  await db.triggers.update(id, { isEnabled: enabled ? 1 : 0, updatedAt: now() });
}

export async function deleteTrigger(id: string): Promise<void> {
  const deletedAt = now();

  await db.transaction('rw', db.triggers, db.tombstones, async () => {
    await db.triggers.delete(id);
    await db.tombstones.put({ id, table: 'triggers', deletedAt });
  });
}
