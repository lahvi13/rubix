import { useLiveQuery } from 'dexie-react-hooks';
import type { Tag } from '../../../db/types';
import { createTag, deleteTag, listTags, renameTag } from '../../../db/repositories/tag-repository';

export interface TagsView {
  tags: Tag[];
  byId: Map<string, Tag>;
  create: (name: string) => Promise<Tag>;
  rename: (id: string, name: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

export function useTags(): TagsView {
  const tags = useLiveQuery(() => listTags(), []) ?? [];

  return {
    tags,
    byId: new Map(tags.map((tag) => [tag.id, tag])),
    create: createTag,
    rename: renameTag,
    remove: deleteTag,
  };
}
