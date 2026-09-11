import { db } from '../schema';
import type { Trigger } from '../types';
import { now } from '../../lib/clock';
import { createId } from '../../lib/uuid';

/** Highlight colours a trigger can be given. Distinct at a glance, dark-friendly. */
/**
 * What a trigger can be highlighted in. Twelve rather than eight, because a
 * reader with a dozen triggers wants a dozen colours — two of them sharing one
 * is two things that look like the same thing inside an algorithm, which is
 * the one job the colour has.
 *
 * One per step round the colour circle, and within each step the shade that
 * sits furthest from its neighbours. Chosen by measuring rather than by eye,
 * and measured on what the highlight actually paints — the colour at 26% over
 * the panel, which is where two triggers have to be told apart — rather than
 * on the swatch, where everything looks distinct. The closest pair came out
 * twice as far apart as the set this replaced, which had an amber and a
 * yellow that were the same colour to look at.
 *
 * All of them are light enough to read as text on the dark theme, where the
 * name is drawn in the colour itself, and saturated enough not to read as the
 * muted grey that means no trigger is here.
 */
export const TRIGGER_COLOURS = [
  '#f87171',
  '#fb923c',
  '#fbbf24',
  '#a3e635',
  '#4ade80',
  '#2dd4bf',
  '#67e8f9',
  '#38bdf8',
  '#818cf8',
  '#c084fc',
  '#f0abfc',
  '#f472b6',
] as const;

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
