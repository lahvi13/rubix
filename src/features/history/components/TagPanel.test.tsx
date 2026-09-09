import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../../../db/schema';
import { getOrCreateActiveSession } from '../../../db/repositories/session-repository';
import { addSolve, updateSolve } from '../../../db/repositories/solve-repository';
import { createTag, listTags } from '../../../db/repositories/tag-repository';
import { TagPanel } from './TagPanel';

// Tags go on afterwards: a solve is timed before it is labelled, so that
// is the only way the app puts one on.
async function seedTaggedSolve(sessionId: string, tagIds: string[]) {
  const solve = await addSolve({
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
  await updateSolve(solve.id, { tagIds });
  return solve;
}

describe('TagPanel', () => {
  let sessionId: string;

  beforeEach(async () => {
    await Promise.all(db.tables.map((table) => table.clear()));
    sessionId = (await getOrCreateActiveSession('333', 'freestyle')).id;
  });

  it('renames a tag as it is typed', async () => {
    await createTag('warmup');
    const user = userEvent.setup();

    render(<TagPanel onClose={vi.fn()} />);

    const field = await screen.findByLabelText('Tag name: warmup');
    await user.type(field, 's');

    await waitFor(async () => {
      expect((await listTags())[0]?.name).toBe('warmups');
    });
  });

  it('says how many solves a tag would be stripped from', async () => {
    const tag = await createTag('warmup');
    await seedTaggedSolve(sessionId, [tag.id]);
    await seedTaggedSolve(sessionId, [tag.id]);

    render(<TagPanel onClose={vi.fn()} />);

    expect(await screen.findByText('on 2 solves')).toBeInTheDocument();
  });

  it('deletes only after the offer is taken twice', async () => {
    const tag = await createTag('warmup');
    const solve = await seedTaggedSolve(sessionId, [tag.id]);
    const user = userEvent.setup();

    render(<TagPanel onClose={vi.fn()} />);

    await user.click(await screen.findByRole('button', { name: 'Delete' }));
    // Still there: the first press only arms the second.
    expect(await listTags()).toHaveLength(1);

    await user.click(screen.getByRole('button', { name: 'Delete?' }));

    await waitFor(async () => {
      expect(await listTags()).toHaveLength(0);
    });
    // The tag goes off the solves wearing it, not just out of the list.
    expect((await db.solves.get(solve.id))?.tagIds).toEqual([]);
  });

  it('creates a tag without a solve to hang it on', async () => {
    const user = userEvent.setup();

    render(<TagPanel onClose={vi.fn()} />);

    await user.type(screen.getByLabelText('New tag'), 'one-handed');
    await user.click(screen.getByRole('button', { name: 'Create' }));

    await waitFor(async () => {
      expect((await listTags()).map((tag) => tag.name)).toEqual(['one-handed']);
    });
  });
});
