/**
 * The 2×2's first guide, checked the way the others are: by doing what each
 * step says, over every cube it can be met on, and seeing whether the cube
 * agrees. The cube is the corners of the model, so nothing here looks at an
 * edge or a centre — the moves carry those wherever they like.
 */

import { describe, expect, it } from 'vitest';
import { parseAlg, type Move } from '../../domain/cube/notation';
import { FACELETS, applyAlg, solvedState, stateKey, type CubeState } from '../../domain/cube/state';
import {
  FOUR_MOVES,
  GUIDES,
  PLACE_PIECES,
  POCKET_LAYERS_GUIDE_ID,
  POCKET_STEPS,
  PUZZLE_GUIDES,
  figureState,
  holdState,
  situationPicture,
  wayOut,
  type LearnStep,
} from './steps';

function movesOf(text: string): Move[] {
  const parsed = parseAlg(text);
  if (!parsed.ok) throw new Error(`unparsable: ${text} (at ${parsed.token})`);
  return parsed.moves;
}

const turn = (state: CubeState, text: string): CubeState => applyAlg(state, movesOf(text));

type Slot = readonly [x: number, y: number, z: number];

/** The stickers of the corner in a slot. */
const stickersAt = ([x, y, z]: Slot): number[] =>
  FACELETS.flatMap((sticker, index) =>
    sticker.position[0] === x && sticker.position[1] === y && sticker.position[2] === z
      ? [index]
      : [],
  );

const SLOTS: readonly Slot[] = [-1, 1].flatMap((y) =>
  [-1, 1].flatMap((z) => [-1, 1].map((x): Slot => [x, y, z])),
);
const TOP = SLOTS.filter(([, y]) => y === 1);
const BOTTOM = SLOTS.filter(([, y]) => y === -1);
const FRONT_RIGHT_TOP: Slot = [1, 1, 1];
const FRONT_RIGHT_BOTTOM: Slot = [1, -1, 1];
const under = ([x, , z]: Slot): Slot => [x, -1, z];

const CORNER_STICKERS = SLOTS.flatMap(stickersAt);

/** The cube as a 2×2 is: what its corners show, and nothing of the rest. */
const corners = (state: CubeState): string => CORNER_STICKERS.map((index) => state[index]).join('');

/** The colours of the piece in a slot, apart from the one named. */
const coloursAt = (state: CubeState, slot: Slot, apart: string): string =>
  stickersAt(slot)
    .map((index) => state[index] ?? '?')
    .filter((colour) => colour !== apart)
    .sort()
    .join('');

/** Which face the piece in a slot shows that colour on. */
function facing(state: CubeState, slot: Slot, colour: string): string {
  const index = stickersAt(slot).find((candidate) => state[candidate] === colour);
  return index === undefined ? 'none' : (FACELETS[index]?.face ?? '?');
}

const isHome = (state: CubeState, slot: Slot, solved: CubeState): boolean =>
  stickersAt(slot).every((index) => state[index] === solved[index]);

const SOLVED = solvedState();
const step = (id: string): LearnStep => {
  const found = POCKET_STEPS.find((candidate) => candidate.id === id);
  if (!found) throw new Error(`no step ${id}`);
  return found;
};
const stateOf = (stepId: string, at: number): CubeState => {
  const entry = step(stepId);
  const situation = entry.situations[at];
  if (!situation) throw new Error(`${stepId} has no situation ${at}`);
  return holdState(situation, situationPicture(entry).standing);
};

describe('the 2×2 guide', () => {
  it("is the 2×2's guide, and none of the 3×3's", () => {
    expect(PUZZLE_GUIDES['222']).toEqual([POCKET_LAYERS_GUIDE_ID]);
    expect(PUZZLE_GUIDES['333']).not.toContain(POCKET_LAYERS_GUIDE_ID);
    expect(GUIDES[POCKET_LAYERS_GUIDE_ID]).toBe(POCKET_STEPS);
    // Every guide belongs to exactly one cube.
    expect(Object.values(PUZZLE_GUIDES).flat().sort()).toEqual(Object.keys(GUIDES).sort());
  });

  it('has three steps, each with something to say and nothing out of a set', () => {
    expect(POCKET_STEPS.map((entry) => entry.id)).toEqual([
      'pocket-white-layer',
      'pocket-place',
      'pocket-turn',
    ]);
    for (const entry of POCKET_STEPS) {
      expect(entry.title).not.toBe('');
      expect(entry.points.length).toBeGreaterThan(0);
      expect(entry.setId).toBeNull();
      expect(entry.situations.length).toBeGreaterThan(0);
    }
  });

  it('prints the four moves once on a card that says how many times to run them', () => {
    const repeated = POCKET_STEPS.flatMap((entry) => entry.situations).filter(
      (situation) => situation.alg.length > FOUR_MOVES.length && situation.alg.startsWith(FOUR_MOVES),
    );
    expect(repeated).toHaveLength(4);
    for (const situation of repeated) expect(situation.shown).toBe(FOUR_MOVES);
  });

  it('uses nothing a 2×2 cannot do: no slice, no wide turn', () => {
    for (const entry of POCKET_STEPS) {
      for (const situation of entry.situations) {
        expect(wayOut(situation)).not.toMatch(/[MESrufldb]/);
      }
    }
  });
});

describe('the four moves', () => {
  it('come back to where they started after six rounds, and not before', () => {
    let state = SOLVED;
    for (let round = 1; round <= 6; round++) {
      state = turn(state, FOUR_MOVES);
      expect(corners(state) === corners(SOLVED)).toBe(round === 6);
    }
  });

  it('never touch the other three pieces of the bottom layer', () => {
    let state = SOLVED;
    for (let round = 1; round <= 6; round++) {
      state = turn(state, FOUR_MOVES);
      for (const slot of BOTTOM) {
        if (slot !== FRONT_RIGHT_BOTTOM && slot.join() !== FRONT_RIGHT_BOTTOM.join()) {
          expect(isHome(state, slot, SOLVED)).toBe(true);
        }
      }
    }
  });
});

describe('the white layer', () => {
  it.each([
    [0, 'R', 1],
    [1, 'U', 3],
    [2, 'F', 5],
  ])('draws card %i with white facing %s and puts the piece in after %i rounds', (at, face, rounds) => {
    const pictured = stateOf('pocket-white-layer', at);

    // The piece over the front right place is the one that belongs under it,
    // and the other three white pieces are already home.
    expect(coloursAt(pictured, FRONT_RIGHT_TOP, 'D')).toBe(coloursAt(SOLVED, FRONT_RIGHT_BOTTOM, 'D'));
    expect(facing(pictured, FRONT_RIGHT_TOP, 'D')).toBe(face);
    expect(BOTTOM.filter((slot) => isHome(pictured, slot, SOLVED))).toHaveLength(3);

    // "Repeat the four moves until the piece is in, white down."
    let state = pictured;
    let done = 0;
    while (!isHome(state, FRONT_RIGHT_BOTTOM, SOLVED)) {
      state = turn(state, FOUR_MOVES);
      done += 1;
      expect(done).toBeLessThanOrEqual(5);
    }
    expect(done).toBe(rounds);
    expect(BOTTOM.every((slot) => isHome(state, slot, SOLVED))).toBe(true);
  });

  it('brings a piece that is stuck at the bottom up with one round, as the tip says', () => {
    // Whatever stands in the front right place, turned any way.
    for (const rounds of [0, 2, 4]) {
      const stuck = turn(SOLVED, Array.from({ length: rounds }, () => FOUR_MOVES).join(' '));
      const piece = coloursAt(stuck, FRONT_RIGHT_BOTTOM, '');
      expect(coloursAt(turn(stuck, FOUR_MOVES), FRONT_RIGHT_TOP, '')).toBe(piece);
    }
  });

  it('shows the layer finished as its goal', () => {
    const goal = step('pocket-white-layer').goal;
    expect(goal?.picture.stickering).toBe('bottomLayer');
    expect(holdState({ alg: '', text: '' }, goal?.picture.standing)).toEqual(SOLVED);
  });
});

/** A top piece is in its place when its two other colours are those of the piece under it. */
const inPlace = (state: CubeState): Slot[] =>
  TOP.filter((slot) => coloursAt(state, slot, 'U') === coloursAt(state, under(slot), 'D'));

const isAdjacent = (a: Slot, b: Slot): boolean => a[0] === b[0] || a[2] === b[2];

/** The whole cube turned until that top slot is at the front right. */
function heldAtFrontRight(state: CubeState, slot: Slot): CubeState {
  let held = state;
  let at = slot;
  for (let quarter = 0; quarter < 4; quarter++) {
    if (at[0] === 1 && at[2] === 1) return held;
    held = turn(held, 'y');
    // y carries the piece at the front right round to the front left.
    at = [-at[2], at[1], at[0]];
  }
  throw new Error('a slot that never comes to the front');
}

/** Every way the four top pieces can stand over a finished white layer. */
function everyTop(): CubeState[] {
  const seen = new Map<string, CubeState>([[corners(SOLVED), SOLVED]]);
  const queue = [SOLVED];
  while (queue.length > 0) {
    const state = queue.shift();
    if (!state) break;
    for (const alg of ['U', PLACE_PIECES, "R U R' U' R' F R2 U' R' U' R U R' F'", "R U R' U R U2 R'"]) {
      const next = turn(state, alg);
      if (seen.has(corners(next))) continue;
      seen.set(corners(next), next);
      queue.push(next);
    }
  }
  return [...seen.values()];
}

describe('placing the yellow pieces', () => {
  const every = everyTop();

  it('is run here over every cube the step can be met on', () => {
    // 24 ways round for the four pieces, 27 ways for them to be turned.
    expect(every).toHaveLength(24 * 27);
    for (const state of every) {
      expect(BOTTOM.every((slot) => isHome(state, slot, SOLVED))).toBe(true);
    }
  });

  it('draws the rule: a piece at home though turned, and one that is not', () => {
    const [home, away] = step('pocket-place').figures ?? [];
    if (!home || !away) throw new Error('the step has lost its two pictures');

    const turned = figureState(home);
    expect(inPlace(turned).map((slot) => slot.join())).toContain(FRONT_RIGHT_TOP.join());
    expect(facing(turned, FRONT_RIGHT_TOP, 'U')).toBe('F');

    const swapped = figureState(away);
    expect(inPlace(swapped).map((slot) => slot.join())).not.toContain(FRONT_RIGHT_TOP.join());
  });

  it('draws its algorithm from one piece in place, at the front right', () => {
    const pictured = stateOf('pocket-place', 0);

    expect(inPlace(pictured).map((slot) => slot.join())).toEqual([FRONT_RIGHT_TOP.join()]);
    expect(inPlace(turn(pictured, PLACE_PIECES))).toHaveLength(4);
  });

  it('can always be turned to at least one piece in place, and never to three', () => {
    for (const state of every) {
      const counts = [0, 1, 2, 3].map((quarters) => inPlace(turn(state, 'U '.repeat(quarters).trim())).length);
      expect(Math.max(...counts)).toBeGreaterThanOrEqual(1);
      expect(counts).not.toContain(3);
    }
  });

  /**
   * The step as it is worded, from one cube: how many times the algorithm is
   * run before all four are home, at the worst — "hold either of them" is a
   * choice, so both are followed.
   */
  function goesFrom(start: CubeState, sofar = 0): number {
    if (sofar > 6) throw new Error('the step goes round in circles');
    let state = start;

    // "Turn the top until at least one piece is in its place, and count them."
    let turns = 0;
    while (inPlace(state).length === 0) {
      state = turn(state, 'U');
      turns += 1;
      if (turns > 3) throw new Error('no turn of the top puts a piece in its place');
    }
    let home = inPlace(state);
    if (home.length === 4) return sofar;

    // "Two side by side: turn the top again until only one is in its place."
    const [first, second] = home;
    if (home.length === 2 && first && second && isAdjacent(first, second)) {
      turns = 0;
      while (inPlace(state).length !== 1) {
        state = turn(state, 'U');
        turns += 1;
        if (turns > 3) throw new Error('no turn of the top leaves one piece in its place');
      }
      home = inPlace(state);
    }

    // One: "hold it at the front right". Two across: "hold either of them".
    return Math.max(
      ...home.map((held) => goesFrom(turn(heldAtFrontRight(state, held), PLACE_PIECES), sofar + 1)),
    );
  }

  it('gets all four home by the step as it is worded, whichever piece is held', () => {
    const goes = every.map((state) => goesFrom(state));

    // Never more than the once more the step promises... and some cubes need it.
    expect(Math.max(...goes)).toBe(2);
    expect(goes.filter((count) => count === 0)).toHaveLength(27 * 4);
  });
});

describe('turning the yellow pieces down', () => {
  const picture = situationPicture(step('pocket-turn'));
  const stood = turn(SOLVED, picture.standing);

  it('turns the cube over: white on top, the same side in front', () => {
    expect(coloursAt(stood, FRONT_RIGHT_TOP, '')).toContain('D');
    expect(facing(stood, FRONT_RIGHT_TOP, 'D')).toBe('U');
    expect(facing(stood, FRONT_RIGHT_BOTTOM, 'F')).toBe('F');
  });

  it.each([
    [0, 'R', 2],
    [1, 'F', 4],
  ])('draws card %i with yellow facing %s, done after %i rounds', (at, face, rounds) => {
    const pictured = stateOf('pocket-turn', at);

    // As the step is first met: the white layer on top still whole.
    expect(TOP.every((slot) => isHome(pictured, slot, stood))).toBe(true);
    expect(facing(pictured, FRONT_RIGHT_BOTTOM, 'U')).toBe(face);

    let state = pictured;
    let done = 0;
    while (facing(state, FRONT_RIGHT_BOTTOM, 'U') !== 'D') {
      state = turn(state, FOUR_MOVES);
      done += 1;
      expect(done).toBeLessThanOrEqual(5);
    }
    expect(done).toBe(rounds);
  });

  /** Every way the four yellow pieces can be turned where they stand. */
  function everyTwist(): CubeState[] {
    const rounds = [0, 2, 4];
    const states: CubeState[] = [];
    for (const a of rounds) {
      for (const b of rounds) {
        for (const c of rounds) {
          for (const d of rounds) {
            // Two rounds turn a piece a third one way and four the other; the
            // turns of a cube that can be solved add up to a whole number.
            if ((a / 2 + b / 2 + c / 2 + d / 2) % 3 !== 0) continue;
            const solving = [a, b, c, d]
              .map((count) => `${Array.from({ length: count }, () => FOUR_MOVES).join(' ')} D`)
              .join(' ');
            states.push(holdState({ alg: solving, text: '' }, picture.standing));
          }
        }
      }
    }
    return states;
  }

  it('solves every such cube by the step as it is worded, the top coming back by itself', () => {
    const every = everyTwist();
    expect(new Set(every.map(stateKey)).size).toBe(27);

    for (const start of every) {
      let state = start;
      for (let piece = 0; piece < 4; piece++) {
        // "Repeat the four moves until its yellow faces down."
        let done = 0;
        while (facing(state, FRONT_RIGHT_BOTTOM, 'U') !== 'D') {
          state = turn(state, FOUR_MOVES);
          done += 1;
          expect(done).toBeLessThanOrEqual(4);
        }
        expect([0, 2, 4]).toContain(done);
        // "Then turn only the bottom layer."
        state = turn(state, 'D');
      }
      expect(corners(state)).toBe(corners(stood));
    }
  });

  it('breaks the white layer on the way, as the warning says', () => {
    const afterOnePiece = turn(stateOf('pocket-turn', 0), `${FOUR_MOVES} ${FOUR_MOVES}`);
    expect(TOP.every((slot) => isHome(afterOnePiece, slot, stood))).toBe(false);
  });

  it('looks done after three of the four moves, which is the mistake the warning names', () => {
    // Twice, says the card: a move short of the second round, yellow already
    // faces down — and the cube is not the one the whole round leaves.
    const short = turn(stateOf('pocket-turn', 0), `${FOUR_MOVES} R U R'`);
    expect(facing(short, FRONT_RIGHT_BOTTOM, 'U')).toBe('D');

    const whole = turn(short, "U'");
    expect(facing(whole, FRONT_RIGHT_BOTTOM, 'U')).toBe('D');
    expect(corners(whole)).not.toBe(corners(short));
  });
});
