import { describe, expect, it } from 'vitest';
import { costsASlot, isFirstTwoLayersCase } from './cost';
import { invertAlg, parseAlg, type Move } from '../cube/notation';
import { applyAlg, solvedState } from '../cube/state';

function moves(text: string): Move[] {
  const parsed = parseAlg(text);
  if (!parsed.ok) throw new Error(`unparsable: ${text}`);
  return parsed.moves;
}

/** The cube as a case is met: its own algorithm, undone. */
function caseFor(alg: string) {
  return applyAlg(solvedState(), invertAlg(moves(alg)));
}

describe('costsASlot', () => {
  it.each([
    // The pack's own answer to F2L 7 and the three the sheet offers beside it.
    ["U2 F2 U2 F U F' U F2", false],
    ["y' U2 R2 U2 R U R' U R2", false],
    ["U' R U R2 F R F' R U' R'", false],
    // The one the sheet prints highlighted: the pair goes in, and the back
    // slot comes out to let it.
    ["y2 U2 L' U L U S' L S", true],
  ])('%s costs a slot: %s', (alg, expected) => {
    const state = caseFor("U2 F2 U2 F U F' U F2");

    expect(costsASlot(state, moves(alg))).toBe(expected);
  });

  it('answers about the slot the algorithm is written for', () => {
    // The same case stood a quarter turn round, which is how the trainer draws
    // it. The pieces are in the same places and the colours are not, so a
    // solution judged on this cube would be answering about the slot next
    // door — which is why the caller hands over the plain case, and why this
    // one comes out differently.
    const turned = applyAlg(solvedState(), [
      ...moves("y'"),
      ...invertAlg(moves("U2 F2 U2 F U F' U F2")),
    ]);

    expect(costsASlot(turned, moves("y2 U2 L' U L U S' L S"))).toBe(false);
  });

  it('says nothing about an algorithm that does not work at all', () => {
    const state = caseFor("U2 F2 U2 F U F' U F2");

    // A sexy move leaves this case in pieces, but it is not costing a slot to
    // insert the pair — it is not inserting the pair. Saying it breaks a slot
    // would be true of the cube and wrong about the algorithm.
    expect(costsASlot(state, moves("R U R' U'"))).toBe(false);
  });

  /**
   * Roux. A second-block algorithm may leave the middle slice and the top
   * layer however it likes, so pieces out of place down there are no cost;
   * the one slot it can take apart is the back pair of the right block.
   */
  it.each([
    // SB 7 on the sheet: its own answer, another of the same, and the one
    // the sheet marks "free slot".
    ["M U r U' r'", false],
    ["F' U F U2 R U R'", false],
    ["U' R' U R U' R U R'", true],
  ])('on a second-block case, %s costs the back pair: %s', (alg, expected) => {
    const state = caseFor("M U r U' r'");

    expect(costsASlot(state, moves(alg), 'blocks')).toBe(expected);
  });

  it('says nothing about a second-block algorithm that does not put the pair in', () => {
    const state = caseFor("M U r U' r'");

    expect(costsASlot(state, moves("R U R' U'"), 'blocks')).toBe(false);
  });

  it.each([
    // The arrow, which leaves the slice where it found it and two side edges
    // down in it — seen on a phone as a dot on the card.
    ['eolr', "U M2 U' M' U' M", "M' U M"],
    ['lseOrientation', "M U' M'", 'M U M'],
    ['blocksAndCorners', "R U2 R' U' R U' R'", "R U R' U R U2 R'"],
  ] as const)('never marks a step after the blocks: %s', (stickering, setup, alg) => {
    const state = applyAlg(solvedState(), moves(setup));

    expect(costsASlot(state, moves(alg), stickering)).toBe(false);
  });

  it('says nothing about a case that is only the last layer', () => {
    // A T perm leaves the layers below alone whatever is done to the top, so
    // there is no slot for anything to cost.
    const tPerm = caseFor("R U R' U' R' F R2 U' R' U' R U R' F'");

    expect(isFirstTwoLayersCase(tPerm)).toBe(false);
    expect(costsASlot(tPerm, moves('R U R'))).toBe(false);
  });
});
