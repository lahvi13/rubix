import { useLiveQuery } from 'dexie-react-hooks';
import type { Tag } from '../../../db/types';
import { createTag, listTags, renameTag } from '../../../db/repositories/tag-repository';

export interface TagsView {
  tags: Tag[];
  /** False until the first read is in: before it, no tags and no such tag look alike. */
  isLoaded: boolean;
  byId: Map<string, Tag>;
  create: (name: string) => Promise<Tag>;
  rename: (id: string, name: string) => Promise<void>;
}

export function useTags(): TagsView {
  const loaded = useLiveQuery(() => listTags(), []);
  const tags = loaded ?? [];

  return {
    tags,
    isLoaded: loaded !== undefined,
    byId: new Map(tags.map((tag) => [tag.id, tag])),
    create: createTag,
    rename: renameTag,
  };
}
