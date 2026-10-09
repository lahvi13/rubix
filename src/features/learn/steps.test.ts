/**
 * The guide's own pictures, checked by running them.
 *
 * A step that says "hold it like this and run the same algorithm again" is
 * making a claim about the cube, and the claim is worth no more than the
 * picture printed beside it. These are the same checks the packs get: perform
 * what the page says, and see whether the cube agrees.
 */

import { describe, expect, it } from 'vitest';
import { PACKS } from '../../db/seed/packs';
import { formatAlg, parseAlg } from '../../domain/cube/notation';
import { FACELETS, isSolved, applyAlg, type CubeState } from '../../domain/cube/state';
import { isSolvedAsShown } from '../../domain/cube/views';
import {
  GUIDES,
  LEARN_STEPS,
  ROUX_STEPS,
  holdState,
  situationPicture,
  type LearnStep,
} from './steps';

function movesOf(text: string) {
  const parsed = parseAlg(text);
  if (!parsed.ok) throw new Error(`unparsable: ${text} (at ${parsed.token})`);
  return parsed.moves;
}

const cubies = new Map<string, number[]>();
for (const [index, sticker] of FACELETS.entries()) {
  const key = sticker.position.join(',');
  cubies.set(key, [...(cubies.get(key) ?? []), index]);
}

const sizeOf = (index: number): number =>
  cubies.get(FACELETS[index]?.position.join(',') ?? '')?.length ?? 0;

const isTopLayer = (index: number): boolean => FACELETS[index]?.position[1] === 1;

/** Top-layer pieces of that size sitting where they belong. */
function homeOnTop(state: CubeState, pieceSize: number): number {
  let home = 0;
  for (const [position, indices] of cubies) {
    if (indices.length !== pieceSize || position.split(',')[1] !== '1') continue;
    if (indices.every((index) => state[index] === FACELETS[index]?.face)) home++;
  }
  return home;
}

const orientedCorners = (state: CubeState): number =>
  FACELETS.filter(
    (sticker, index) => sticker.face === 'U' && sizeOf(index) === 3 && state[index] === 'U',
  ).length;

/** Which face the top colour of the front-left corner is showing on. */
function frontLeftFacing(state: CubeState): string {
  const indices = cubies.get('-1,1,1') ?? [];
  const carrying = indices.find((index) => state[index] === 'U');
  return carrying === undefined ? 'up' : (FACELETS[carrying]?.face ?? '?');
}

/** The algorithm a step opens with, out of the pack it comes from. */
function stepAlg(step: LearnStep): string {
  const pack = PACKS.find((candidate) => candidate.set.id === step.setId);
  if (!pack) throw new Error(`no pack for ${step.setId}`);
  const cases = pack.cases.filter(
    (entry) =>
      entry.group === step.group &&
      (step.caseIds.length === 0 || step.caseIds.includes(entry.id)),
  );
  if (cases.length !== 1) throw new Error(`${step.id} does not open on one algorithm`);
  // The moves, not how the pack brackets them: the repeats are drawn from the
  // moves alone.
  const parsed = parseAlg(cases[0]?.alg ?? '');
  return parsed.ok ? formatAlg(parsed.moves) : '';
}

const withHolds = Object.values(GUIDES).flatMap((steps) =>
  steps.filter((step) => step.holds.length > 0),
);

describe('the guide', () => {
  it('has something to say at every step', () => {
    expect(LEARN_STEPS).toHaveLength(7);
    for (const step of LEARN_STEPS) {
      expect(step.title).not.toBe('');
      expect(step.points.length).toBeGreaterThan(0);
    }
  });

  it('only ever names one algorithm on a step that shows how to repeat it', () => {
    // The claim the page makes: this is the same algorithm again, not another
    // one. Anything left over between the repeats can only be a U turn.
    for (const step of withHolds) {
      const alg = stepAlg(step);

      for (const hold of step.holds) {
        expect(hold.alg, step.id).toContain(alg);
        for (const between of hold.alg.split(alg)) {
          expect(between.trim(), `${step.id}: ${between}`).toMatch(/^(U[2']?)?$/);
        }
      }
    }
  });

  it.each(withHolds.flatMap((step) => step.holds.map((hold) => [step.id, hold] as const)))(
    '%s: the picture is undone by what it says to do',
    (_id, hold) => {
      expect(isSolved(applyAlg(holdState(hold), movesOf(hold.alg)))).toBe(true);
    },
  );

  it.each(withHolds.flatMap((step) => step.holds.map((hold) => [step.id, hold] as const)))(
    '%s: the picture disturbs nothing below the last layer',
    (_id, hold) => {
      const state = holdState(hold);
      const wrong = FACELETS.filter(
        (sticker, index) => !isTopLayer(index) && state[index] !== sticker.face,
      );

      expect(wrong).toHaveLength(0);
    },
  );

  it.each(['corner-orientation', 'roux-corner-orientation'])(
    '%s draws the two situations the corners have to be held in',
    (id) => {
      const step = [...LEARN_STEPS, ...ROUX_STEPS].find((candidate) => candidate.id === id);
      const [two, none] = step?.holds ?? [];
      if (!two || !none) throw new Error('the face step lost its pictures');

      // Two corners already showing, and the sheet's rule for where to turn them:
      // the top colour of the front-left corner pointing at the reader.
      expect(orientedCorners(holdState(two))).toBe(2);
      expect(frontLeftFacing(holdState(two))).toBe('F');
      // None showing, and that same corner's top colour pointing left.
      expect(orientedCorners(holdState(none))).toBe(0);
      expect(frontLeftFacing(holdState(none))).toBe('L');
    },
  );

  it('draws Roux corners with no headlights anywhere', () => {
    const step = ROUX_STEPS.find((candidate) => candidate.id === 'roux-corner-permutation');
    const hold = step?.holds[0];
    if (!hold) throw new Error('the corner step lost its picture');
    const state = holdState(hold);

    // Headlights are two top corners on one side showing that side the same
    // colour; the picture is the case with none, so none may be drawn.
    const sides = (['F', 'R', 'B', 'L'] as const).filter((face) => {
      const [left, right] = FACELETS.flatMap((sticker, index) =>
        sticker.face === face && sticker.row === 0 && sticker.column !== 1 ? [index] : [],
      );
      return left !== undefined && right !== undefined && state[left] === state[right];
    });
    expect(sides).toHaveLength(0);
    expect(homeOnTop(state, 3)).toBe(0);
  });

  it('draws corners with no headlights, and leaves the edges out of it', () => {
    const step = LEARN_STEPS.find((candidate) => candidate.id === 'corner-permutation');
    const hold = step?.holds[0];
    if (!hold) throw new Error('the corner step lost its picture');
    const state = holdState(hold);

    expect(homeOnTop(state, 3)).toBe(0);
    expect(homeOnTop(state, 2)).toBe(4);
  });

  it('draws edges with no side finished, and leaves the corners alone', () => {
    const step = LEARN_STEPS.find((candidate) => candidate.id === 'edge-permutation');
    const hold = step?.holds[0];
    if (!hold) throw new Error('the edge step lost its picture');
    const state = holdState(hold);

    expect(homeOnTop(state, 2)).toBe(0);
    expect(homeOnTop(state, 3)).toBe(4);
  });

  /**
   * The cross is taught by pictures, so the pictures carry the claim: the
   * white edge is up in the top layer, white where the caption says, and the
   * moves under it are what finishes the cross.
   */
  it.each([
    [0, 'U'],
    [1, 'F'],
  ])('draws cross situation %i with the white sticker on %s', (index, face) => {
    const step = LEARN_STEPS.find((candidate) => candidate.id === 'cross');
    const situation = step?.situations[index];
    if (!situation) throw new Error('the cross lost a picture');
    const state = holdState(situation);

    const white = FACELETS.flatMap((sticker, at) =>
      state[at] === 'D' && sticker.face === face && sticker.row === (face === 'U' ? 2 : 0) && sticker.column === 1
        ? [at]
        : [],
    );
    expect(white).toHaveLength(1);
    expect(isSolvedAsShown(state, 'cross')).toBe(false);
    expect(isSolvedAsShown(applyAlg(state, movesOf(situation.alg)), 'cross')).toBe(true);
  });
});

describe('the Roux guide', () => {
  const step = (id: string): LearnStep => {
    const found = ROUX_STEPS.find((candidate) => candidate.id === id);
    if (!found) throw new Error(`no step ${id}`);
    return found;
  };

  /** Which faces and slices a situation turns, as the step's warning names them. */
  const familiesOf = (alg: string): string[] => movesOf(alg).map((move) => move.family);

  it('has seven steps, each with something to say', () => {
    expect(ROUX_STEPS).toHaveLength(7);
    for (const entry of ROUX_STEPS) {
      expect(entry.title).not.toBe('');
      expect(entry.points.length).toBeGreaterThan(0);
    }
  });

  it.each(
    ROUX_STEPS.flatMap((entry) =>
      entry.situations.map((situation) => [entry.id, entry, situation] as const),
    ),
  )(
    '%s: the situation is undone by its moves',
    (_id, entry, situation) => {
      const picture = situationPicture(entry);
      const state = holdState(situation, picture.standing);
      expect(isSolvedAsShown(state, picture.stickering)).toBe(false);
      const stood = holdState({ alg: '', text: '' }, picture.standing);
      expect(applyAlg(state, movesOf(situation.alg))).toEqual(stood);
    },
  );

  it('builds the left block without turning L or D', () => {
    for (const situation of step('roux-first-block').situations) {
      expect(familiesOf(situation.alg)).not.toContain('L');
      expect(familiesOf(situation.alg)).not.toContain('D');
    }
  });

  it('builds the right block with U, R, r and M only', () => {
    for (const situation of step('roux-second-block').situations) {
      for (const family of familiesOf(situation.alg)) {
        expect(['U', 'R', 'Rw', 'M']).toContain(family);
      }
    }
  });

  it.each(['roux-side-edges', 'roux-middle-slice'])('%s turns nothing but M and U', (id) => {
    for (const situation of step(id).situations) {
      for (const family of familiesOf(situation.alg)) expect(['M', 'U']).toContain(family);
    }
  });

  /** The case a step opens on, out of its pack. */
  const openingCase = (entry: LearnStep) => {
    const pack = PACKS.find((candidate) => candidate.set.id === entry.setId);
    const found = pack?.cases.find((candidate) => entry.caseIds.includes(candidate.id));
    if (!found) throw new Error(`${entry.id} lost its case`);
    return found;
  };

  it('opens the corner swap on headlights on the left, where the step says to put them', () => {
    const setId = step('roux-corner-permutation').setId;
    const pack = PACKS.find((candidate) => candidate.set.id === setId);
    const jb = pack?.cases.find((entry) => entry.id === '2cmll-jb');
    if (!jb) throw new Error('the corner step lost its case');
    const state = holdState({ alg: jb.alg, text: '' });

    const sides = (['F', 'R', 'B', 'L'] as const).filter((face) => {
      const [left, right] = FACELETS.flatMap((sticker, index) =>
        sticker.face === face && sticker.row === 0 && sticker.column !== 1 ? [index] : [],
      );
      return left !== undefined && right !== undefined && state[left] === state[right];
    });
    expect(sides).toEqual(['L']);
  });

  it('draws the arrow: three bad edges on top and its point over the fourth below', () => {
    const arrow = openingCase(step('roux-edge-orientation'));
    // The arrow the guide teaches, with the moves it names: M', U, M.
    expect(arrow.alg).toBe("M' U M");
    const state = holdState({ alg: arrow.alg, text: '' });

    // An edge is good when its top or bottom colour faces up or down.
    const badAt = (position: string): boolean => {
      const stickers = FACELETS.flatMap((sticker, index) =>
        sticker.position.join(',') === position ? [index] : [],
      );
      const pole = stickers.find((index) => state[index] === 'U' || state[index] === 'D');
      const face = pole === undefined ? undefined : FACELETS[pole]?.face;
      return face !== 'U' && face !== 'D';
    };
    const top = ['0,1,1', '-1,1,0', '1,1,0', '0,1,-1'];
    expect(top.filter(badAt)).toEqual(['0,1,1', '-1,1,0', '1,1,0']);
    expect(['0,-1,1', '0,-1,-1'].filter(badAt)).toEqual(['0,-1,1']);
  });
});
