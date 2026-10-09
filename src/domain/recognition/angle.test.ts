import { describe, expect, it } from 'vitest';
import { PACKS } from '../../db/seed/packs';
import { formatAlg, invertAlg, parseAlg, type Move } from '../cube/notation';
import { canonicalise } from '../cube/orientation';
import { applyAlg, isSolvedIgnoringOrientation, type CubeState } from '../cube/state';
import { isSolvedAsShown, type Stickering } from '../cube/views';
import { diagramFor } from '../../features/trainer/case-view';
import { DRILL_AUFS, DRILL_ROTATIONS, drillScramble } from '../drill/scramble';
import { aufForAngle } from './angle';

function moves(text: string): Move[] {
  const parsed = parseAlg(text);
  if (!parsed.ok) throw new Error(`test setup does not parse: ${text}`);
  return parsed.moves;
}

/**
 * The cube as a recognition question really draws it: the app's own scramble
 * builder, steered to one particular angle rather than a random one. Built
 * this way on purpose — a hand-rolled copy of the same construction would
 * only prove that two of my own readings of it agree.
 */
function shown(alg: string, rotation: string, auf: string) {
  const rotationIndex = DRILL_ROTATIONS.indexOf(rotation as (typeof DRILL_ROTATIONS)[number]);
  const aufIndex = DRILL_AUFS.indexOf(auf as (typeof DRILL_AUFS)[number]);
  if (rotationIndex === -1 || aufIndex === -1) throw new Error('no such angle');

  // drillScramble draws the rotation first and the AUF second; pickFrom takes
  // floor(random() * 4), so the midpoint of each quarter names an index.
  const picks = [(rotationIndex + 0.5) / 4, (aufIndex + 0.5) / 4];
  let next = 0;
  const setup = formatAlg(invertAlg(moves(alg)));
  const built = drillScramble(setup, () => picks[next++] ?? 0);
  if (built === null) throw new Error('scramble does not build');

  expect(built.rotation).toBe(rotation);
  expect(built.auf).toBe(auf);
  return built.state;
}

describe('aufForAngle', () => {
  it('needs no turn when the case is met straight on', () => {
    const alg = "R U R' U R U2 R'";
    expect(aufForAngle(shown(alg, '', ''), moves(alg))).toEqual([]);
  });

  it.each(DRILL_AUFS.filter((auf) => auf !== ''))(
    'finds the turn that undoes a %s',
    (auf) => {
      const alg = "R U R' U R U2 R'";
      const found = aufForAngle(shown(alg, '', auf), moves(alg));
      expect(found).not.toBeNull();
      expect(found).not.toEqual([]);
    },
  );

  it('has nothing to offer for an algorithm that does not solve the case', () => {
    // A T perm against a Sune: no amount of AUF makes that come out.
    expect(aufForAngle(shown("R U R' U R U2 R'", '', ''), moves("R U R' U' R' F R2 U' R' U' R U R' F'"))).toBeNull();
  });

  it('has nothing to offer for an empty algorithm', () => {
    expect(aufForAngle(shown("R U R' U R U2 R'", '', ''), [])).toBeNull();
  });

  it('solves every pack case from every angle it can be shown at', () => {
    // The claim the screen makes after every answer, checked rather than
    // reasoned about: what it prints, performed on the cube it drew, solves it.
    let checked = 0;

    for (const pack of PACKS) {
      for (const entry of pack.cases) {
        const algMoves = moves(entry.alg);

        for (const rotation of DRILL_ROTATIONS) {
          for (const auf of DRILL_AUFS) {
            const state = shown(entry.alg, rotation, auf);
            const found = aufForAngle(state, algMoves);

            expect(found, `${entry.id} at ${rotation || 'no rotation'} ${auf || 'no AUF'}`).not.toBeNull();
            expect(
              isSolvedIgnoringOrientation(applyAlg(applyAlg(state, found ?? []), algMoves)),
              `${entry.id} at ${rotation || 'no rotation'} ${auf || 'no AUF'}`,
            ).toBe(true);
            checked++;
          }
        }
      }
    }

    // 246 cases, four rotations, four AUFs — a guard against the loop quietly
    // running over nothing.
    expect(checked).toBe(246 * 16);
  });

  it('finds the turn for an OLL of your own that orients and permutes its own way', () => {
    // Seen on a phone: H learned as F (R U R' U') x3 F'. It orients the layer
    // but leaves it permuted unlike the pack's H, so an outright solve never
    // came and no turn was shown at all.
    const pack = "(R U2 R') (U' R U R') (U' R U' R')";
    const mine = moves("F (R U R' U') (R U R' U') (R U R' U') F'");

    for (const auf of DRILL_AUFS) {
      const state = shown(pack, '', auf);
      expect(aufForAngle(state, mine), `${auf || 'no AUF'}, judged outright`).toBeNull();

      const found = aufForAngle(state, mine, { stickering: 'orientation' });
      expect(found, auf || 'no AUF').not.toBeNull();
      expect(solvesAsShown(applyAlg(applyAlg(state, found ?? []), mine), 'orientation')).toBe(true);
    }
  });

  it('gives every algorithm a case offers its turn, from every angle', () => {
    let checked = 0;

    for (const pack of PACKS) {
      for (const entry of pack.cases) {
        const { stickering } = diagramFor(pack.set.id, entry.group ?? '');
        const offered = [entry.alg, entry.alt, ...(entry.others ?? []), ...(entry.orientOnly ?? [])];

        for (const alg of offered) {
          if (alg === undefined) continue;
          const algMoves = moves(alg);

          for (const rotation of DRILL_ROTATIONS) {
            for (const auf of DRILL_AUFS) {
              const state = shown(entry.alg, rotation, auf);
              const found = aufForAngle(state, algMoves, { stickering, scrambleAuf: auf });
              const label = `${entry.id}: ${alg} at ${rotation || 'no rotation'} ${auf || 'no AUF'}`;

              expect(found, label).not.toBeNull();
              expect(solvesAsShown(applyAlg(applyAlg(state, found ?? []), algMoves), stickering), label).toBe(true);
              checked++;
            }
          }
        }
      }
    }

    expect(checked).toBeGreaterThan(195 * 16);
    // Thousands of cubes turned and judged: seconds, not the default five, once
    // the rest of the suite is running beside it.
  }, 30_000);

  it.each([
    ['', ''],
    ['U', "U'"],
    ["U'", 'U'],
    // A half turn leaves H looking exactly as the trainer draws it: nothing to undo.
    ['U2', ''],
  ])(
    'turns H back to how the trainer draws it after a %s scramble turn, with %s',
    (auf, expected) => {
      // H orients the same from two sides. This algorithm works from where the
      // trainer draws the case, so the answer is the shortest turn that makes
      // the layer look like that — not another that happens to work as well.
      const pack = "(R U2 R') (U' R U R') (U' R U' R')";
      const mine = moves("F (R U R' U') (R U R' U') (R U R' U') F'");

      const found = aufForAngle(shown(pack, '', auf), mine, {
        stickering: 'orientation',
        scrambleAuf: auf,
      });
      expect(formatAlg(found ?? [])).toBe(expected);
    },
  );

  it('takes an algorithm that carries its own AUF as it is', () => {
    // The user's own variant, with the AUF already written into it: the screen
    // must not put a second one in front of it.
    const alg = "R U R' U R U2 R'";
    const withAuf = `U' ${alg}`;
    const state = shown(alg, '', 'U');

    expect(aufForAngle(state, moves(withAuf))).toEqual([]);
  });
});

/** Solved as the set looks at the case, whichever way up, give or take a last U turn. */
function solvesAsShown(state: CubeState, stickering: Stickering): boolean {
  // Stood up as the drill stands it: a Roux case not at all, since CMLL may
  // leave the middle slice turned.
  const upright = stickering === 'blocksAndCorners' ? state : canonicalise(state);
  return DRILL_AUFS.some((end) => isSolvedAsShown(end === '' ? upright : applyAlg(upright, moves(end)), stickering));
}
