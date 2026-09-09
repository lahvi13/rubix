import { db } from '../schema';
import type { Tag } from '../types';
import { now } from '../../lib/clock';
import { createId } from '../../lib/uuid';

/** Fixed palette so tags stay distinguishable without a colour picker. */
export const TAG_COLORS = [
  '#4ade80',
  '#60a5fa',
  '#fbbf24',
  '#f87171',
  '#c084fc',
  '#22d3ee',
] as const;

export async function listTags(): Promise<Tag[]> {
  const tags = await db.tags.toArray();
  return tags.sort((a, b) => a.name.localeCompare(b.name));
}

export async function createTag(name: string): Promise<Tag> {
  const timestamp = now();
  const used = await db.tags.count();
  const tag: Tag = {
    id: createId(),
    name: name.trim(),
    color: TAG_COLORS[used % TAG_COLORS.length] ?? TAG_COLORS[0],
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  await db.tags.add(tag);
  return tag;
}

export async function renameTag(id: string, name: string): Promise<void> {
  await db.tags.update(id, { name: name.trim(), updatedAt: now() });
}

/** A deleted tag and the solves it came off, enough to put both back. */
export interface DeletedTag {
  tag: Tag;
  solveIds: string[];
}

/**
 * Deleting a tag also strips it from every solve. Dangling tag ids would
 * otherwise survive an export and reappear as invisible filters.
 *
 * Reports what it took so the delete can be undone: the tag on its own is not
 * enough, because putting it back without the solves that wore it would leave
 * a tag nothing is tagged with.
 */
export async function deleteTag(id: string): Promise<DeletedTag | null> {
  const deletedAt = now();

  return db.transaction('rw', db.tags, db.solves, db.tombstones, async () => {
    const tag = await db.tags.get(id);
    if (!tag) return null;

    const affected = await db.solves.where('tagIds').equals(id).toArray();
    await db.tags.delete(id);
    await db.tombstones.put({ id, table: 'tags', deletedAt });
    await db.solves.bulkPut(
      affected.map((solve) => ({
        ...solve,
        tagIds: solve.tagIds.filter((tagId) => tagId !== id),
        updatedAt: deletedAt,
      })),
    );

    return { tag, solveIds: affected.map((solve) => solve.id) };
  });
}

/**
 * Puts a deleted tag back on the solves it was taken from, grave and all — a
 * row that returns while its tombstone stays behind is deleted again by the
 * next import.
 */
export async function restoreTag({ tag, solveIds }: DeletedTag): Promise<void> {
  const updatedAt = now();

  await db.transaction('rw', db.tags, db.solves, db.tombstones, async () => {
    await db.tags.put(tag);
    const grave = await db.tombstones.get(tag.id);
    if (grave?.table === 'tags') await db.tombstones.delete(tag.id);

    const solves = (await db.solves.bulkGet(solveIds)).filter((solve) => solve !== undefined);
    await db.solves.bulkPut(
      // Solves deleted in the meantime are simply not there to put it back on.
      solves.map((solve) => ({
        ...solve,
        tagIds: solve.tagIds.includes(tag.id) ? solve.tagIds : [...solve.tagIds, tag.id],
        updatedAt,
      })),
    );
  });
}
