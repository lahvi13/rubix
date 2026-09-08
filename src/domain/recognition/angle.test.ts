import { describe, expect, it } from 'vitest';
import { PACKS } from '../../db/seed/packs';
import { formatAlg, invertAlg, parseAlg, type Move } from '../cube/notation';
import { applyAlg, isSolvedIgnoringOrientation } from '../cube/state';
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

    // 142 cases, four rotations, four AUFs — a guard against the loop quietly
    // running over nothing.
    expect(checked).toBe(142 * 16);
  });

  it('takes an algorithm that carries its own AUF as it is', () => {
    // The user's own variant, with the AUF already written into it: the screen
    // must not put a second one in front of it.
    const alg = "R U R' U R U2 R'";
    const withAuf = `U' ${alg}`;
    const state = shown(alg, '', 'U');

    expect(aufForAngle(state, moves(withAuf))).toEqual([]);
  });
});
