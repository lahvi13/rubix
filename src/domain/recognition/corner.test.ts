import { describe, expect, it } from 'vitest';
import { parseAlg } from '../cube/notation';
import { applyAlg, solvedState } from '../cube/state';
import { fromOtherCorner } from './corner';

function stateOf(alg: string) {
  const parsed = parseAlg(alg);
  if (!parsed.ok) throw new Error(`test setup does not parse: ${alg}`);
  return applyAlg(solvedState(), parsed.moves);
}

describe('fromOtherCorner', () => {
  it('turns the cube round rather than solving anything', () => {
    const sune = stateOf("R U R' U R U2 R'");
    const turned = fromOtherCorner(sune);

    // The stickers move; the case does not — turning it back gives it whole.
    expect(turned).not.toEqual(sune);
    expect(fromOtherCorner(turned)).toEqual(sune);
  });

  it('leaves a solved cube solved, in the colours of the far side', () => {
    // Not the same array: a state says which colour sits in which place, and
    // turning the cube round puts the red face where the orange one was.
    const turned = fromOtherCorner(solvedState());
    for (let face = 0; face < 6; face++) {
      const stickers = turned.slice(face * 9, face * 9 + 9);
      expect(new Set(stickers).size).toBe(1);
    }
  });

  it('brings the back face to the front', () => {
    // The front face after the turn is what the back face was before it.
    const scrambled = stateOf("R U R' F' U2 L");
    const turned = fromOtherCorner(scrambled);
    const before = stateOf("R U R' F' U2 L y2");

    expect(turned).toEqual(before);
  });
});
