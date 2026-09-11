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

  it('says nothing about a case that is only the last layer', () => {
    // A T perm leaves the layers below alone whatever is done to the top, so
    // there is no slot for anything to cost.
    const tPerm = caseFor("R U R' U' R' F R2 U' R' U' R U R' F'");

    expect(isFirstTwoLayersCase(tPerm)).toBe(false);
    expect(costsASlot(tPerm, moves('R U R'))).toBe(false);
  });
});
