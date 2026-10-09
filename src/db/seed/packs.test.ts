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
import { isSolvedAsShown, lastLayerView, type Stickering } from '../../domain/cube/views';
import { PACKS, type AlgPack, type PackCase } from './packs';
import { BEGINNER_GROUPS, CASE_TWINS } from '../../domain/alg/sets';

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

/** The stickers of each cubie, so a piece can be found by the colours it wears. */
const CUBIES = new Map<string, number[]>();
for (const [index, sticker] of FACELETS.entries()) {
  const key = sticker.position.join(',');
  CUBIES.set(key, [...(CUBIES.get(key) ?? []), index]);
}

const isTopLayer = (index: number): boolean => FACELETS[index]?.position[1] === 1;

/** Pieces of the front-right slot, the one every F2L case is drilled in. */
const isFrontRightSlot = (index: number): boolean => {
  const position = FACELETS[index]?.position;
  if (!position) return false;
  const [x, y, z] = position;
  return x === 1 && z === 1 && y !== 1;
};

/** How many pieces of that size are sitting where they belong. */
function homePieces(state: CubeStateOf, pieceSize: number): number {
  let home = 0;
  for (const [, indices] of CUBIES) {
    if (indices.length === pieceSize && indices.every((index) => state[index] === solved[index])) {
      home++;
    }
  }
  return home;
}

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

/**
 * Whether an algorithm really answers the case it is offered on.
 *
 * Two standards, because two kinds of case are in these packs. A last-layer
 * case is only answered by a solved cube. A case in the layers below — F2L,
 * and the guide's first two steps — owes nothing to the last layer: the job is
 * the pair and the layers under it, and what the top is left looking like is
 * the next step's problem. Either way the cube is stood up first, because an
 * algorithm is allowed to turn it.
 *
 * CMLL is a third: its job is the four corners against the two blocks, and
 * Kian's sheet says outright that half its algorithms flip the edges on the
 * way. Those six edges and the middle slice are the next step's, so the cube
 * is judged as it lies, with any final turn of the top.
 */
function answers(entry: PackCase, moves: Move[], setId = ''): boolean {
  const before = caseState(entry);
  if (setId === 'cmll') {
    const after = applyAlg(before, moves);
    return ['', 'U', 'U2', "U'"].some((end) =>
      isSolvedAsShown(applyAlg(after, movesOf(end)), 'blocksAndCorners'),
    );
  }
  const after = canonicalise(applyAlg(before, moves));
  const isLastLayerCase = wrongOutside(before, isTopLayer) === 0;
  return isLastLayerCase ? isSolved(after) : wrongOutside(after, isTopLayer) === 0;
}

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
    '%s is answered by its own algorithm',
    (_name, entry) => {
      expect(answers(entry, movesOf(entry.alg), pack.set.id)).toBe(true);
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

  it.each(
    pack.cases.flatMap((entry) =>
      (entry.others ?? []).map(
        (moves, index) => [`${entry.name} #${index + 1}`, entry, moves] as const,
      ),
    ),
  )('%s is another way through the same case', (_name, entry, moves) => {
    // The point of an extra is that it is a different solution, not a differently
    // written one — and that it really does solve the case it is offered on.
    expect(answers(entry, movesOf(moves), pack.set.id)).toBe(true);
    expect(moves).not.toBe(entry.alg);
  });

  it.each(
    pack.cases.flatMap((entry) =>
      (entry.multiSlot ?? []).map(
        (moves, index) => [`${entry.name} slot #${index + 1}`, entry, moves] as const,
      ),
    ),
  )('%s inserts the pair and costs a slot to do it', (_name, entry, moves) => {
    const after = canonicalise(applyAlg(caseState(entry), movesOf(moves)));

    // Both halves matter. It has to work — the pair goes in — and it has to
    // really cost something, or it is being warned about for nothing and the
    // warning stops meaning anything.
    expect(wrongOutside(after, (index) => !isFrontRightSlot(index))).toBe(0);
    expect(wrongOutside(after, isTopLayer)).toBeGreaterThan(0);
  });

  it.each(
    pack.cases.flatMap((entry) =>
      (entry.orientOnly ?? []).map(
        (moves, index) => [`${entry.name} orient #${index + 1}`, entry, moves] as const,
      ),
    ),
  )('%s orients the last layer and stops there', (_name, entry, moves) => {
    const after = canonicalise(applyAlg(caseState(entry), movesOf(moves)));

    // All three matter. The top comes up in one colour, nothing under it is
    // disturbed, and it does not go on to solve — one that solves is a
    // different offer and belongs in the list above, not behind a warning.
    expect(isOriented(after)).toBe(true);
    expect(wrongOutside(after, isTopLayer)).toBe(0);
    expect(isSolved(after)).toBe(false);
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

describe('two-look CMLL', () => {
  const pack = packById('2look-cmll');
  const orientation = pack.cases.filter((entry) => entry.group === '1 / Orientation');
  const permutation = pack.cases.filter((entry) => entry.group === '2 / Permutation');

  /** Roux's two blocks: everything but the top layer and the middle slice. */
  const isLastSixOrCorner = (index: number): boolean => {
    const position = FACELETS[index]?.position;
    return position !== undefined && (position[1] === 1 || position[0] === 0);
  };

  const cornersOriented = (state: CubeStateOf): boolean =>
    FACELETS.every(
      (sticker, index) => sticker.face !== 'U' || !isCornerSticker(index) || state[index] === 'U',
    );

  /** Only which way the top corners face — the edges are Roux's last step. */
  const cornerOrientationKey = (state: CubeStateOf): string =>
    FACELETS.map((sticker, index) =>
      sticker.position[1] === 1 && isCornerSticker(index) ? (state[index] === 'U' ? 'y' : '.') : '',
    ).join('');

  it('is the seven shapes and the two swaps of the short route', () => {
    expect(pack.set.method).toBe('roux');
    expect(orientation).toHaveLength(7);
    expect(permutation).toHaveLength(2);
  });

  it.each(pack.cases.map((entry) => [entry.name, entry] as const))(
    '%s leaves both blocks standing',
    (_name, entry) => {
      expect(wrongOutside(caseState(entry), isLastSixOrCorner)).toBe(0);
    },
  );

  it.each(orientation.map((entry) => [entry.name, entry] as const))(
    '%s starts with corners to turn up',
    (_name, entry) => {
      expect(cornersOriented(caseState(entry))).toBe(false);
    },
  );

  it.each(permutation.map((entry) => [entry.name, entry] as const))(
    '%s starts with the corners up and out of place',
    (_name, entry) => {
      const state = caseState(entry);
      expect(cornersOriented(state)).toBe(true);
      expect(wrongOutside(state, (index) => !isCornerSticker(index))).toBeGreaterThan(0);
    },
  );

  it('holds seven different corner shapes', () => {
    const keys = orientation.map((entry) => aufKey(caseState(entry), cornerOrientationKey));
    expect(new Set(keys).size).toBe(7);
  });
});

describe('CMLL', () => {
  const pack = packById('cmll');
  const twoLook = packById('2look-cmll');

  /** Roux's two blocks: everything but the top layer and the middle slice. */
  const isLastSixOrCorner = (index: number): boolean => {
    const position = FACELETS[index]?.position;
    return position !== undefined && (position[1] === 1 || position[0] === 0);
  };

  /** Only which way the top corners face. */
  const cornerShape = (state: CubeStateOf): string =>
    FACELETS.map((sticker, index) =>
      sticker.position[1] === 1 && isCornerSticker(index) ? (state[index] === 'U' ? 'y' : '.') : '',
    ).join('');

  /** The corners as the trainer draws them: shape and side colours, edges grey. */
  const cornerCase = (state: CubeStateOf): string =>
    JSON.stringify(lastLayerView(state, 'blocksAndCorners'));

  /** Each CMLL group is the corner shape a 2-Look case of the same name orients. */
  const SHAPE_OF: Record<string, string> = {
    H: '2cmll-h',
    Pi: '2cmll-pi',
    U: '2cmll-u',
    T: '2cmll-t',
    S: '2cmll-sune',
    As: '2cmll-antisune',
    L: '2cmll-l',
  };

  it('is the forty-two cases of the sheet, in its eight shapes', () => {
    expect(pack.set.method).toBe('roux');
    const counts = Object.fromEntries(
      ['O', 'H', 'Pi', 'U', 'T', 'S', 'As', 'L'].map((group) => [
        group,
        pack.cases.filter((entry) => entry.group === group).length,
      ]),
    );
    expect(counts).toEqual({ O: 2, H: 4, Pi: 6, U: 6, T: 6, S: 6, As: 6, L: 6 });
  });

  it.each(pack.cases.map((entry) => [entry.name, entry] as const))(
    '%s leaves both blocks standing',
    (_name, entry) => {
      expect(wrongOutside(caseState(entry), isLastSixOrCorner)).toBe(0);
    },
  );

  it.each(
    pack.cases
      .filter((entry) => entry.group !== 'O')
      .map((entry) => [entry.name, entry] as const),
  )(
    '%s has the corner shape its group is named for',
    (_name, entry) => {
      const twin = twoLook.cases.find((candidate) => candidate.id === SHAPE_OF[entry.group ?? '']);
      if (!twin) throw new Error(`no shape for ${entry.group}`);
      expect(aufKey(caseState(entry), cornerShape)).toBe(aufKey(caseState(twin), cornerShape));
    },
  );

  it('starts every O case with the corners already up', () => {
    for (const entry of pack.cases.filter((candidate) => candidate.group === 'O')) {
      expect(cornerShape(caseState(entry)).replaceAll('.', '')).toBe('yyyy');
    }
  });

  it('holds forty-two different cases', () => {
    const keys = pack.cases.map((entry) => aufKey(caseState(entry), cornerCase));
    expect(new Set(keys).size).toBe(42);
  });
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

describe('beginner', () => {
  const pack = packById('beginner');
  const groupOf = (name: string) => pack.cases.filter((entry) => entry.group === name);
  const corners = groupOf('Bottom layer corners');
  const edges = groupOf('Middle layer edges');

  /** Where the piece wearing these colours has got to. */
  function pieceAt(state: CubeStateOf, colours: string): readonly number[] {
    const wanted = [...colours].sort().join('');
    for (const [, indices] of CUBIES) {
      const worn = indices
        .map((index) => state[index] ?? '')
        .sort()
        .join('');
      if (worn === wanted) return FACELETS[indices[0] ?? 0]?.position ?? [];
    }
    throw new Error(`no piece wearing ${colours}`);
  }

  const inSlot = (x: number, z: number) => (index: number) => {
    const position = FACELETS[index]?.position;
    if (!position) return false;
    return position[0] === x && position[2] === z && position[1] !== 1;
  };

  it('groups its cases under the names the guide and the diagrams use', () => {
    const named: readonly string[] = Object.values(BEGINNER_GROUPS);

    for (const entry of pack.cases) expect(named).toContain(entry.group);
  });

  it('is the seven algorithms the guide teaches', () => {
    expect(pack.cases).toHaveLength(7);
    expect(corners).toHaveLength(3);
    expect(edges).toHaveLength(2);
    expect(groupOf('Corners home')).toHaveLength(1);
    expect(groupOf('Edges home')).toHaveLength(1);
  });

  it.each(corners.map((entry) => [entry.name, entry] as const))(
    '%s waits in the top layer above the slot it drops into',
    (_name, entry) => {
      const state = caseState(entry);

      // Every corner of this step goes into the front-right slot, and gets
      // there from the top: it is the one place a beginner can see it.
      expect(pieceAt(state, 'DFR')).toEqual([1, 1, 1]);
      // Below the top layer only that slot is open. The middle layer is not
      // built yet at this step, so its edge is allowed to be anywhere.
      expect(wrongOutside(state, (index) => isTopLayer(index) || isFrontRightSlot(index))).toBe(0);
    },
  );

  it('teaches the same corner three ways round, not three corners', () => {
    // The three cases differ only in which way the cross colour points, which
    // is the whole of the recognition: right, front, or up.
    const facings = corners.map((entry) => {
      const state = caseState(entry);
      const corner = FACELETS.flatMap((sticker, index) =>
        sticker.position.join(',') === '1,1,1' && state[index] === 'D' ? [sticker.face] : [],
      );
      return corner[0];
    });

    expect(new Set(facings).size).toBe(3);
  });

  it.each([
    ['beg-edge-front', 'FR', inSlot(1, 1)],
    ['beg-edge-back', 'BR', inSlot(1, -1)],
  ] as const)('%s brings an edge down from the top into its own slot', (id, colours, slot) => {
    const entry = pack.cases.find((candidate) => candidate.id === id);
    if (!entry) throw new Error(`missing case: ${id}`);
    const state = caseState(entry);

    // Both are met in the same place — an edge on the top right, lined up with
    // the centre it matches — and only the colour on top says which slot it
    // belongs to. That is what makes one grip enough for the whole step.
    expect(pieceAt(state, colours)).toEqual([1, 1, 0]);
    expect(wrongOutside(state, (index) => isTopLayer(index) || slot(index))).toBe(0);
  });

  it('sends three corners round and leaves every edge alone', () => {
    const entry = pack.cases.find((candidate) => candidate.id === 'beg-corners');
    if (!entry) throw new Error('missing case: beg-corners');
    const state = caseState(entry);

    // The reason this one is here rather than a borrowed PLL: the corners can
    // be finished without touching an edge, so the two last steps stay apart.
    expect(wrongOutside(state, isCornerSticker)).toBe(0);
    expect(homePieces(state, 3)).toBe(5);
  });

  it('sends three edges round and leaves every corner alone', () => {
    const entry = pack.cases.find((candidate) => candidate.id === 'beg-edges');
    if (!entry) throw new Error('missing case: beg-edges');
    const state = caseState(entry);

    expect(wrongOutside(state, (index) => !isCornerSticker(index))).toBe(0);
    expect(homePieces(state, 2)).toBe(9);
  });
});

describe('twin cases', () => {
  const entryById = (id: string): PackCase => {
    for (const pack of PACKS) {
      const entry = pack.cases.find((candidate) => candidate.id === id);
      if (entry !== undefined) return entry;
    }
    throw new Error(`no such case: ${id}`);
  };

  /** The last layer as the set reads it, from each of the four sides. */
  const readings = (entry: PackCase, stickering: Stickering): string[] =>
    ['', 'U', 'U2', "U'"].map((turn) =>
      JSON.stringify(lastLayerView(applyAlg(caseState(entry), movesOf(turn)), stickering)),
    );

  it.each(CASE_TWINS.map(([twoLook, full]) => [twoLook, full] as const))(
    '%s is the same case as %s',
    (twoLook, full) => {
      // OLL is read by what faces up; PLL by every sticker of the layer.
      const stickering: Stickering = full.startsWith('oll') ? 'orientation' : 'full';
      const mine = readings(entryById(twoLook), stickering);

      expect(readings(entryById(full), stickering).some((view) => mine.includes(view))).toBe(true);
    },
  );

  it('pairs a two-look case with a full one, each at most once', () => {
    const twoLook = new Set(packById('2look-oll').cases.concat(packById('2look-pll').cases).map((entry) => entry.id));
    const ids = CASE_TWINS.flat();

    expect(CASE_TWINS.every(([first]) => twoLook.has(first))).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
