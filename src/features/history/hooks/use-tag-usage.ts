import { useLiveQuery } from 'dexie-react-hooks';
import { countSolvesWithTag } from '../../../db/repositories/solve-repository';
import { listTags } from '../../../db/repositories/tag-repository';

/**
 * How many solves wear each tag, by tag id. Its own hook rather than part of
 * `useTags`: every history row reads the tag list to colour its dots, and
 * counting each tag's solves for that would be a scan per render. Only the
 * panel that offers to delete a tag needs the number, and it needs it because
 * deleting one strips it from every solve at once.
 */
export function useTagUsage(): Map<string, number> {
  const counts = useLiveQuery(async () => {
    const tags = await listTags();
    const pairs = await Promise.all(
      tags.map(async (tag) => [tag.id, await countSolvesWithTag(tag.id)] as const),
    );
    return new Map(pairs);
  }, []);

  return counts ?? new Map();
}
