import { describe, expect, it } from 'vitest';
import { FACES, formatAlg, invertAlg, parseAlg, type Face, type Move } from './notation';
import { FACELETS, applyAlg, isSolved, solvedState, stateKey, type CubeState } from './state';

function alg(text: string): Move[] {
  const parsed = parseAlg(text);
  if (!parsed.ok) throw new Error(`bad test alg: ${text}`);
  return parsed.moves;
}

function after(text: string) {
  return applyAlg(solvedState(), alg(text));
}

/** Colours of one face, read row by row. */
function face(state: CubeState, name: Face): string {
  return FACELETS.map((sticker, index) => (sticker.face === name ? state[index] : null))
    .filter((colour) => colour !== null)
    .join('');
}

const SEXY = "R U R' U'";
const T_PERM = "R U R' U' R' F R2 U' R' U' R U R' F'";
const SUNE = "R U R' U R U2 R'";

describe('cube state', () => {
  it('starts solved with nine stickers of each colour', () => {
    const state = solvedState();

    expect(isSolved(state)).toBe(true);
    for (const name of FACES) {
      expect(state.filter((colour) => colour === name)).toHaveLength(9);
    }
  });

  it.each(['U', 'D', 'L', 'R', 'F', 'B', 'Rw', 'Uw', 'M', 'E', 'S', 'x', 'y', 'z'])(
    '%s four times is where it started',
    (family) => {
      expect(isSolved(after(`${family} ${family} ${family} ${family}`))).toBe(true);
    },
  );

  it.each(['U', 'R', 'F', 'Rw', 'M', 'x'])('%s and %s′ cancel', (family) => {
    expect(isSolved(after(`${family} ${family}'`))).toBe(true);
    expect(isSolved(after(`${family}2 ${family}2`))).toBe(true);
  });

  it('brings the cube back after six sexy moves', () => {
    expect(isSolved(after(Array.from({ length: 6 }, () => SEXY).join(' ')))).toBe(true);
  });

  it.each<[string, string, number]>([
    ['T perm', T_PERM, 2],
    ['sune', SUNE, 6],
    ['J perm', "R U R' F' R U R' U' R' F R2 U' R' U'", 2],
  ])('%s has order %i', (_name, moves, order) => {
    const repeated = Array.from({ length: order }, () => moves).join(' ');

    expect(isSolved(after(repeated))).toBe(true);
    expect(isSolved(after(moves))).toBe(false);
  });

  it('undoes any algorithm with its inverse', () => {
    const moves = alg("R U2 D' B D'");

    expect(isSolved(applyAlg(applyAlg(solvedState(), moves), invertAlg(moves)))).toBe(true);
  });

  it('turns only the layers a move touches', () => {
    // R never moves a sticker of the L face, and M never moves a corner.
    const turned = after('R');
    expect(face(turned, 'L')).toBe('LLLLLLLLL');

    const sliced = after('M');
    expect(face(sliced, 'R')).toBe('RRRRRRRRR');
    expect(face(sliced, 'L')).toBe('LLLLLLLLL');
  });

  it('rotates the whole cube with x, so the front colour ends up on top', () => {
    const turned = after('x');

    expect(face(turned, 'U')).toBe('FFFFFFFFF');
    expect(face(turned, 'B')).toBe('UUUUUUUUU');
    expect(face(turned, 'R')).toBe('RRRRRRRRR');
  });

  it('agrees that a wide turn is the outer face plus the slice', () => {
    expect(stateKey(after('Rw'))).toBe(stateKey(after("R M'")));
    expect(stateKey(after('Uw'))).toBe(stateKey(after("U E'")));
    expect(stateKey(after('Fw'))).toBe(stateKey(after('F S')));
    expect(stateKey(after('x'))).toBe(stateKey(after("R M' L'")));
    expect(stateKey(after('y'))).toBe(stateKey(after("U E' D'")));
    expect(stateKey(after('z'))).toBe(stateKey(after("F S B'")));
  });

  it('reads lowercase wide moves as the same turn', () => {
    expect(stateKey(after("r U r'"))).toBe(stateKey(after("Rw U Rw'")));
    expect(formatAlg(alg("r U' u2"))).toBe("Rw U' Uw2");
  });
});
