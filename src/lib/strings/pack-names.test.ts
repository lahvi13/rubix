/**
 * The packs carry English names, and every one of them reaches a screen. A
 * name that is neither translated nor deliberately left alone would show up in
 * English with nothing to say whether that was a decision — so here every name
 * in every pack has to be one or the other.
 */

import { describe, expect, it } from 'vitest';
import { CROSS_PACK, PACKS } from '../../db/seed/packs';
import { CS_PACK_NAMES, KEPT_IN_ENGLISH, czechName, packLabel } from './pack-names';

const ALL_PACKS = [...PACKS, CROSS_PACK];

/** Cases the packs number rather than name: "OLL 21", "F2L 3", "Expert 12". */
const NUMBERED = /^(F2L|OLL|PLL|Advanced|Expert) \d+$/;

/**
 * A second-block case, named the way SpeedCubeDB names it: the corner's state
 * and where the edge is, with an m for an edge the wrong way round. A code,
 * read the same in any language; the group's heading says what its first
 * half means.
 */
const SECOND_BLOCK = /^(U|Up|Um|D|Dp|Dm) (UB|UR|UF|UL|U|FR|DB|DF)m?$/;

/**
 * An EOLR case, named as its sheet names it: the shape of the bad edges in
 * the sheet's shorthand, then the two places the side edges are in. Codes and
 * positions, which read the same in any language.
 */
const EOLR = /^(Arrow|6|4\/0|2o\/2|2o\/0|0\/2|2a\/0|2a\/2|1\/1 [FB]) [UD][FLBR] [UD][FLBR]$/;

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
    const decided =
      name in CS_PACK_NAMES ||
      KEPT_IN_ENGLISH.includes(name) ||
      NUMBERED.test(name) ||
      SECOND_BLOCK.test(name) ||
      EOLR.test(name);
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

  /* The numbered cases: the word in front is a set name, so it follows the
     set. F2L, OLL and PLL stay; the levels this app named itself do not. */
  it.each([
    ['Advanced 1', 'Pokročilé 1'],
    ['Advanced 41', 'Pokročilé 41'],
    ['Expert 7', 'Expert 7'],
    ['Dp DBm', 'Dp DBm'],
    ['2a/2 UF UL', '2a/2 UF UL'],
    ['6 DF DB', '6 DF DB'],
    ['F2L 3', 'F2L 3'],
    ['OLL 21', 'OLL 21'],
    ['PLL 2', 'PLL 2'],
    ['Aa', 'Aa'],
    ['Fat Antisune', 'Fat Antisune'],
  ])('%s reads as %s in Czech', (name, expected) => {
    expect(czechName(name)).toBe(expected);
  });
});
