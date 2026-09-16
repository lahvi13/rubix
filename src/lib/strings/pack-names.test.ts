/**
 * The packs carry English names, and every one of them reaches a screen. A
 * name that is neither translated nor deliberately left alone would show up in
 * English with nothing to say whether that was a decision — so here every name
 * in every pack has to be one or the other.
 */

import { describe, expect, it } from 'vitest';
import { CROSS_PACK, PACKS } from '../../db/seed/packs';
import { CS_PACK_NAMES, KEPT_IN_ENGLISH, packLabel } from './pack-names';

const ALL_PACKS = [...PACKS, CROSS_PACK];

/** Cases the packs number rather than name: "OLL 21", "F2L 3", "Expert 12". */
const NUMBERED = /^(F2L|OLL|PLL|Advanced|Expert) \d+$/;

function namesOf(): string[] {
  const names = new Set<string>();
  for (const pack of ALL_PACKS) {
    names.add(pack.set.name);
    for (const entry of pack.cases) {
      names.add(entry.name);
      if (entry.group !== null) names.add(entry.group);
    }
  }
  return [...names];
}

describe('pack names', () => {
  it.each(namesOf())('%s is either translated or knowingly kept', (name) => {
    const decided = name in CS_PACK_NAMES || KEPT_IN_ENGLISH.includes(name) || NUMBERED.test(name);
    expect(decided).toBe(true);
  });

  it('translates nothing it was not asked to', () => {
    const seen = new Set(namesOf());
    for (const name of Object.keys(CS_PACK_NAMES)) expect(seen.has(name)).toBe(true);
    for (const name of KEPT_IN_ENGLISH) expect(seen.has(name)).toBe(true);
  });

  it('never decides a name twice', () => {
    for (const name of KEPT_IN_ENGLISH) expect(CS_PACK_NAMES[name]).toBeUndefined();
  });

  /* The tests run in English, where the lookup is meant to be a pass-through. */
  it('hands a name back untouched in English', () => {
    expect(packLabel('Bottom layer corners')).toBe('Bottom layer corners');
    expect(packLabel('a name the reader gave it')).toBe('a name the reader gave it');
  });
});
