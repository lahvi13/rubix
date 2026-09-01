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

/**
 * Deleting a tag also strips it from every solve. Dangling tag ids would
 * otherwise survive an export and reappear as invisible filters.
 */
export async function deleteTag(id: string): Promise<void> {
  const deletedAt = now();

  await db.transaction('rw', db.tags, db.solves, db.tombstones, async () => {
    await db.tags.delete(id);
    await db.tombstones.put({ id, table: 'tags', deletedAt });

    const affected = await db.solves.where('tagIds').equals(id).toArray();
    await Promise.all(
      affected.map((solve) =>
        db.solves.update(solve.id, {
          tagIds: solve.tagIds.filter((tagId) => tagId !== id),
          updatedAt: deletedAt,
        }),
      ),
    );
  });
}
