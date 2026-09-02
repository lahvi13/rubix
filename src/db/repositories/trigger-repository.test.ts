import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../schema';
import { seedPacks } from '../seed/seed';
import {
  createTrigger,
  deleteTrigger,
  listEnabledTriggers,
  listTriggers,
  setTriggerEnabled,
  updateTrigger,
} from './trigger-repository';

describe('trigger repository', () => {
  beforeEach(async () => {
    await Promise.all(db.tables.map((table) => table.clear()));
    await seedPacks();
  });

  it('lists longer triggers first, so the longest match can win', async () => {
    const lengths = (await listTriggers()).map((trigger) => trigger.moves.split(' ').length);

    expect(lengths).toEqual([...lengths].sort((a, b) => b - a));
  });

  it('leaves a switched-off trigger in place but out of the way', async () => {
    await setTriggerEnabled('trigger-sexy', false);

    expect(await db.triggers.get('trigger-sexy')).toBeDefined();
    expect((await listEnabledTriggers()).some((trigger) => trigger.id === 'trigger-sexy')).toBe(
      false,
    );
  });

  it('takes ownership of a built-in trigger that gets edited', async () => {
    await updateTrigger('trigger-sexy', { name: 'Sexy' });

    expect((await db.triggers.get('trigger-sexy'))?.source).toBe('user');
  });

  it('stores a trigger of the user own', async () => {
    const trigger = await createTrigger('  Double sexy  ', "  R U R' U' R U R' U'  ");

    expect(trigger.name).toBe('Double sexy');
    expect(trigger.moves).toBe("R U R' U' R U R' U'");
    expect(trigger.source).toBe('user');
  });

  it('leaves a tombstone when a trigger goes', async () => {
    await deleteTrigger('trigger-sune');

    expect(await db.triggers.get('trigger-sune')).toBeUndefined();
    expect((await db.tombstones.get('trigger-sune'))?.table).toBe('triggers');
  });
});
