/**
 * The packs are algorithms typed in by hand, so they are checked by running
 * them, not by reading them. Every case must be the kind of case its set
 * claims — a typo almost always disturbs the layers below, and the typos that
 * do not are caught by two cases coming out identical.
 */

import { describe, expect, it } from 'vitest';
import { invertAlg, parseAlg, type Move } from '../../domain/cube/notation';
import { canonicalise } from '../../domain/cube/orientation';
import { FACELETS, applyAlg, isSolved, solvedState, stateKey } from '../../domain/cube/state';
import { PACKS, type AlgPack, type PackCase } from './packs';

function movesOf(text: string): Move[] {
  const parsed = parseAlg(text);
  if (!parsed.ok) throw new Error(`unparsable: ${text} (at ${parsed.token})`);
  return parsed.moves;
}

function setupOf(entry: PackCase): Move[] {
  return entry.setup === undefined ? invertAlg(movesOf(entry.alg)) : movesOf(entry.setup);
}

/** The state the case is shown and drilled in. */
function caseState(entry: PackCase): CubeStateOf {
  return applyAlg(solvedState(), setupOf(entry));
}

type CubeStateOf = ReturnType<typeof solvedState>;

const solved = solvedState();

const isTopLayer = (index: number): boolean => FACELETS[index]?.position[1] === 1;

/** Pieces of the front-right slot, the one every F2L case is drilled in. */
const isFrontRightSlot = (index: number): boolean => {
  const position = FACELETS[index]?.position;
  if (!position) return false;
  const [x, y, z] = position;
  return x === 1 && z === 1 && y !== 1;
};

function wrongOutside(state: CubeStateOf, allowed: (index: number) => boolean): number {
  return FACELETS.filter((_, index) => !allowed(index) && state[index] !== solved[index]).length;
}

const isOriented = (state: CubeStateOf): boolean =>
  FACELETS.every((sticker, index) => sticker.face !== 'U' || state[index] === 'U');

/** Stickers of a corner piece: a corner is the cubie with three of them. */
const CORNER_STICKERS = new Set(
  FACELETS.flatMap((sticker, index) => {
    const [x, y, z] = sticker.position;
    return x !== 0 && y !== 0 && z !== 0 ? [index] : [];
  }),
);

const isCornerSticker = (index: number): boolean => CORNER_STICKERS.has(index);

/** The cross on top: every top-layer edge showing its U colour upwards. */
const edgesOriented = (state: CubeStateOf): boolean =>
  FACELETS.every((sticker, index) => {
    if (sticker.face !== 'U' || isCornerSticker(index)) return true;
    return state[index] === 'U';
  });

/** The same case with a different U turn is the same case. */
function aufKey(state: CubeStateOf, project: (state: CubeStateOf) => string): string {
  const quarter = movesOf('U');
  const keys: string[] = [];
  let turned = state;
  for (let turn = 0; turn < 4; turn++) {
    keys.push(project(turned));
    turned = applyAlg(turned, quarter);
  }
  return keys.sort()[0] ?? '';
}

const fullKey = (state: CubeStateOf): string => stateKey(state);

/** Only which top-layer stickers are yellow — an OLL case is nothing else. */
const orientationKey = (state: CubeStateOf): string =>
  FACELETS.map((sticker, index) =>
    sticker.position[1] === 1 ? (state[index] === 'U' ? 'y' : '.') : '',
  ).join('');

function packById(id: string): AlgPack {
  const pack = PACKS.find((candidate) => candidate.set.id === id);
  if (!pack) throw new Error(`missing pack: ${id}`);
  return pack;
}

describe.each(PACKS.map((pack) => [pack.set.id, pack] as const))('%s pack', (_id, pack) => {
  it('has a unique id and name for every case', () => {
    expect(new Set(pack.cases.map((entry) => entry.id)).size).toBe(pack.cases.length);
    expect(new Set(pack.cases.map((entry) => entry.name)).size).toBe(pack.cases.length);
  });

  it.each(pack.cases.map((entry) => [entry.name, entry] as const))(
    '%s is solved by its own algorithm',
    (_name, entry) => {
      expect(isSolved(applyAlg(caseState(entry), movesOf(entry.alg)))).toBe(true);
    },
  );

  it.each(
    pack.cases
      .filter((entry) => entry.alt !== undefined)
      .map((entry) => [entry.name, entry] as const),
  )('%s has its pair inserted by the rotation variant too', (_name, entry) => {
    const after = canonicalise(applyAlg(caseState(entry), movesOf(entry.alt ?? '')));

    // An F2L algorithm owes nothing to the last layer — the job is the pair and
    // the two layers under it. The cube also ends up turned, hence the
    // canonical orientation before looking.
    expect(wrongOutside(after, isTopLayer)).toBe(0);
    expect(entry.alt).not.toBe(entry.alg);
  });

  it.each(pack.cases.map((entry) => [entry.name, entry] as const))(
    '%s leaves the cube upright',
    (_name, entry) => {
      // An algorithm that ends with the cube tilted would draw its case from
      // the wrong side and hand the next case over rotated. Rotations are
      // allowed inside an algorithm as long as they cancel out.
      const state = caseState(entry);
      expect(stateKey(canonicalise(state))).toBe(stateKey(state));
    },
  );
});

describe('PLL', () => {
  const pll = packById('pll');

  it('covers all 21 cases', () => {
    expect(pll.cases).toHaveLength(21);
  });

  it.each(pll.cases.map((entry) => [entry.name, entry] as const))(
    '%s only permutes the last layer',
    (_name, entry) => {
      const state = caseState(entry);

      expect(wrongOutside(state, isTopLayer)).toBe(0);
      expect(isOriented(state)).toBe(true);
      expect(isSolved(state)).toBe(false);
    },
  );

  it('holds 21 different cases, not the same one written 21 ways', () => {
    const keys = pll.cases.map((entry) => aufKey(caseState(entry), fullKey));

    expect(new Set(keys).size).toBe(21);
  });
});

describe('OLL', () => {
  const oll = PACKS.find((pack) => pack.set.id === 'oll');
  if (!oll) return;

  it('covers all 57 cases', () => {
    expect(oll.cases).toHaveLength(57);
  });

  it.each(oll.cases.map((entry) => [entry.name, entry] as const))(
    '%s only misorients the last layer',
    (_name, entry) => {
      const state = caseState(entry);

      expect(wrongOutside(state, isTopLayer)).toBe(0);
      expect(isOriented(state)).toBe(false);
    },
  );

  it('holds 57 different orientations', () => {
    const keys = oll.cases.map((entry) => aufKey(caseState(entry), orientationKey));

    expect(new Set(keys).size).toBe(57);
  });
});

describe('two-look OLL', () => {
  const pack = packById('2look-oll');
  const edges = pack.cases.filter((entry) => entry.group?.includes('Edges'));
  const corners = pack.cases.filter((entry) => entry.group?.includes('Corners'));

  it('is the ten cases of the short route', () => {
    expect(pack.cases).toHaveLength(10);
    expect(edges).toHaveLength(3);
    expect(corners).toHaveLength(7);
  });

  it.each(edges.map((entry) => [entry.name, entry] as const))(
    '%s is an edge shape and nothing below the top layer',
    (_name, entry) => {
      const state = caseState(entry);

      expect(wrongOutside(state, isTopLayer)).toBe(0);
      expect(edgesOriented(state)).toBe(false);
    },
  );

  it.each(corners.map((entry) => [entry.name, entry] as const))(
    '%s has the cross already made, so only corners are left',
    (_name, entry) => {
      const state = caseState(entry);

      expect(wrongOutside(state, isTopLayer)).toBe(0);
      expect(edgesOriented(state)).toBe(true);
      expect(isOriented(state)).toBe(false);
    },
  );

  it('holds ten different cases', () => {
    const keys = pack.cases.map((entry) => aufKey(caseState(entry), orientationKey));

    expect(new Set(keys).size).toBe(10);
  });
});

describe('two-look PLL', () => {
  const pack = packById('2look-pll');
  const cornerStep = pack.cases.filter((entry) => entry.group?.includes('Corners'));
  const edgeStep = pack.cases.filter((entry) => entry.group?.includes('Edges'));

  it('is the six cases of the short route', () => {
    expect(pack.cases).toHaveLength(6);
    expect(cornerStep).toHaveLength(2);
    expect(edgeStep).toHaveLength(4);
  });

  it.each(pack.cases.map((entry) => [entry.name, entry] as const))(
    '%s only permutes the last layer',
    (_name, entry) => {
      const state = caseState(entry);

      expect(wrongOutside(state, isTopLayer)).toBe(0);
      expect(isOriented(state)).toBe(true);
    },
  );

  it.each(edgeStep.map((entry) => [entry.name, entry] as const))(
    '%s leaves the corners where they belong — they were the first look',
    (_name, entry) => {
      const state = caseState(entry);

      expect(wrongOutside(state, (index) => !isCornerSticker(index))).toBe(0);
    },
  );

  it.each(cornerStep.map((entry) => [entry.name, entry] as const))(
    '%s has corners out of place, which is what the first look fixes',
    (_name, entry) => {
      expect(wrongOutside(caseState(entry), (index) => !isCornerSticker(index))).toBeGreaterThan(0);
    },
  );
});

describe('F2L', () => {
  const f2l = PACKS.find((pack) => pack.set.id === 'f2l');
  if (!f2l) return;

  it('covers all 41 cases', () => {
    expect(f2l.cases).toHaveLength(41);
  });

  it.each(f2l.cases.map((entry) => [entry.name, entry] as const))(
    '%s disturbs nothing but the top layer and its own slot',
    (_name, entry) => {
      const state = caseState(entry);

      expect(wrongOutside(state, (index) => isTopLayer(index) || isFrontRightSlot(index))).toBe(0);
      expect(isSolved(state)).toBe(false);
    },
  );

  it('holds 41 different cases', () => {
    const keys = f2l.cases.map((entry) => aufKey(caseState(entry), fullKey));

    expect(new Set(keys).size).toBe(41);
  });
});
