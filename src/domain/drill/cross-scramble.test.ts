import { describe, expect, it } from 'vitest';
import { CROSS_SCRAMBLE_LENGTH, crossScramble } from './cross-scramble';
import { solveCross, warmCrossSolver } from '../cube/cross-solver';
import { applyAlg } from '../cube/state';
import { formatAlg } from '../cube/notation';
import { systemRandom } from '../../lib/random';

/** A source that hands back exactly what a test asked for, then repeats. */
function sequence(values: readonly number[]) {
  let index = 0;
  return () => values[index++ % values.length] ?? 0;
}

describe('crossScramble', () => {
  it('is the measured length, whatever the draw', () => {
    for (let seed = 0; seed < 50; seed++) {
      const scramble = crossScramble(systemRandom);
      expect(scramble.moves).toHaveLength(CROSS_SCRAMBLE_LENGTH);
      expect(scramble.text.split(' ')).toHaveLength(CROSS_SCRAMBLE_LENGTH);
    }
  });

  it('never turns the same face twice running, nor an axis three times', () => {
    const axis: Record<string, string> = { U: 'y', D: 'y', L: 'x', R: 'x', F: 'z', B: 'z' };

    for (let draw = 0; draw < 200; draw++) {
      const faces = crossScramble(systemRandom)
        .text.split(' ')
        .map((move) => move[0] ?? '');

      for (let i = 1; i < faces.length; i++) {
        // Two turns of one face are one turn written twice.
        expect(faces[i]).not.toBe(faces[i - 1]);
        if (i < 2) continue;
        // And a third turn on an axis already turned twice is the same again.
        const three = [faces[i], faces[i - 1], faces[i - 2]].map((face) => axis[face ?? '']);
        expect(new Set(three).size).toBeGreaterThan(1);
      }
    }
  });

  it('leaves a cross there is a way to solve', () => {
    warmCrossSolver();

    for (let draw = 0; draw < 100; draw++) {
      const scramble = crossScramble(systemRandom);
      const solution = solveCross(scramble.state);

      expect(solution).not.toBeNull();
      if (solution === null) continue;
      // And solving it really does put the cross home, on the face the drill
      // holds down throughout.
      expect(solveCross(applyAlg(scramble.state, solution))).toHaveLength(0);
    }
  });

  it('takes its randomness from the caller, so a draw can be replayed', () => {
    // Faces are drawn from U D L R F B and suffixes from '' ′ 2, in that
    // order; 0 picks the first of each.
    const first = crossScramble(sequence([0]));
    const same = crossScramble(sequence([0]));

    expect(first.text).toBe(same.text);
    // U, then anything but U — the walk refuses to repeat a face, so a source
    // that only ever says "the first one" still has to move on.
    expect(first.text.startsWith('U ')).toBe(true);
    expect(first.text.split(' ')[1]).not.toBe('U');
  });

  it('is the same cube as performing its own text', () => {
    const scramble = crossScramble(systemRandom);
    expect(formatAlg(scramble.moves)).toBe(scramble.text);
  });
});
