import { describe, expect, it } from 'vitest';
import { DRILL_AUFS, DRILL_ROTATIONS, drillScramble } from './scramble';
import { parseAlg } from '../cube/notation';
import { applyAlg, solvedState, type CubeState } from '../cube/state';
import type { Random } from '../../lib/random';

function sequence(...values: number[]): Random {
  let index = 0;
  return () => values[index++] ?? 0;
}

/** Middle of the slot for a list of four, so a test names an index, not a fraction. */
function choose(rotationIndex: number, aufIndex: number): Random {
  return sequence((rotationIndex + 0.5) / 4, (aufIndex + 0.5) / 4);
}

const T_PERM = "R U R' U' R' F R2 U' R' U' R U R' F'";

/**
 * The first two layers, as a last-layer case leaves them. Faces sit in blocks
 * of nine in FACELETS order (U, D, L, R, F, B), row-major with the top row
 * first, so the lower two layers of a side face are the last six stickers of
 * its block.
 */
function firstTwoLayersSolved(state: CubeState): boolean {
  const blocks = { D: 9, L: 18, R: 27, F: 36, B: 45 };
  const down = state.slice(blocks.D, blocks.D + 9);
  if (down.some((sticker) => sticker !== down[0])) return false;

  for (const start of [blocks.L, blocks.R, blocks.F, blocks.B]) {
    const lower = state.slice(start + 3, start + 9);
    if (lower.some((sticker) => sticker !== state[start + 4])) return false;
  }
  return true;
}

describe('drillScramble', () => {
  it('refuses a setup it cannot read', () => {
    expect(drillScramble('R U spin', () => 0)).toBeNull();
  });

  it('is the bare setup when both draws come up empty', () => {
    const scramble = drillScramble("R U R'", choose(0, 0));
    expect(scramble?.text).toBe("R U R'");
    expect(scramble?.rotation).toBe('');
    expect(scramble?.auf).toBe('');
  });

  it('draws the rotation first and the AUF second', () => {
    const scramble = drillScramble("R U R'", choose(1, 3));
    expect(scramble?.rotation).toBe('y');
    expect(scramble?.auf).toBe("U'");
    expect(scramble?.text).toBe("y R U R' U'");
  });

  it('writes wide moves the way the rest of the app does', () => {
    expect(drillScramble('Rw U Fw2', choose(0, 0))?.text).toBe('r U f2');
  });

  it('leaves the cube where performing the scramble leaves it', () => {
    const scramble = drillScramble(T_PERM, choose(2, 1));
    const parsed = parseAlg(scramble?.text ?? '');
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(scramble?.state).toEqual(applyAlg(solvedState(), parsed.moves));
  });

  it('keeps the first two layers solved in every presentation of a last-layer case', () => {
    for (let rotation = 0; rotation < DRILL_ROTATIONS.length; rotation += 1) {
      for (let auf = 0; auf < DRILL_AUFS.length; auf += 1) {
        const scramble = drillScramble(T_PERM, choose(rotation, auf));
        expect(scramble).not.toBeNull();
        if (scramble === null) continue;
        // Named in the assertion so a failure says which presentation broke.
        expect([scramble.rotation, scramble.auf, firstTwoLayersSolved(scramble.state)]).toEqual([
          DRILL_ROTATIONS[rotation],
          DRILL_AUFS[auf],
          true,
        ]);
      }
    }
  });

  it('reaches every presentation and never the same state twice', () => {
    const states = new Set<string>();
    for (let rotation = 0; rotation < DRILL_ROTATIONS.length; rotation += 1) {
      for (let auf = 0; auf < DRILL_AUFS.length; auf += 1) {
        const scramble = drillScramble(T_PERM, choose(rotation, auf));
        states.add(scramble?.state.join('') ?? '');
      }
    }
    expect(states.size).toBe(DRILL_ROTATIONS.length * DRILL_AUFS.length);
  });
});
