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
import { LEARN_STEPS, holdState, type LearnStep } from './steps';

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

const withHolds = LEARN_STEPS.filter((step) => step.holds.length > 0);

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

  it('draws the two situations the last-layer face has to be held in', () => {
    const step = LEARN_STEPS.find((candidate) => candidate.id === 'corner-orientation');
    const [two, none] = step?.holds ?? [];
    if (!two || !none) throw new Error('the face step lost its pictures');

    // Two corners already showing, and the sheet's rule for where to turn them:
    // the top colour of the front-left corner pointing at the reader.
    expect(orientedCorners(holdState(two))).toBe(2);
    expect(frontLeftFacing(holdState(two))).toBe('F');
    // None showing, and that same corner's top colour pointing left.
    expect(orientedCorners(holdState(none))).toBe(0);
    expect(frontLeftFacing(holdState(none))).toBe('L');
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
