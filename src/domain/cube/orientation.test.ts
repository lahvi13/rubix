import { describe, expect, it } from 'vitest';
import { parseAlg, type Move } from './notation';
import { CUBE_ROTATIONS, canonicalise } from './orientation';
import { applyAlg, isSolved, solvedState, stateKey } from './state';

function alg(text: string): Move[] {
  const parsed = parseAlg(text);
  if (!parsed.ok) throw new Error(`bad test alg: ${text}`);
  return parsed.moves;
}

describe('cube rotations', () => {
  it('lists all 24 orientations, each of them different', () => {
    const keys = CUBE_ROTATIONS.map((rotation) => stateKey(applyAlg(solvedState(), rotation)));

    expect(CUBE_ROTATIONS).toHaveLength(24);
    expect(new Set(keys).size).toBe(24);
  });

  it('puts a rotated cube back the way it was', () => {
    for (const rotation of CUBE_ROTATIONS) {
      expect(isSolved(canonicalise(applyAlg(solvedState(), rotation)))).toBe(true);
    }
  });

  it('leaves the pattern alone, only the way it is held', () => {
    const scrambled = applyAlg(solvedState(), alg("R U R' U' F2 L"));

    for (const rotation of CUBE_ROTATIONS) {
      expect(stateKey(canonicalise(applyAlg(scrambled, rotation)))).toBe(stateKey(scrambled));
    }
  });
});
