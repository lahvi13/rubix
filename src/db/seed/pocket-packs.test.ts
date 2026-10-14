/**
 * The 2×2's packs, checked by running them like every other pack — on the
 * corners alone. A 2×2 is the model's corners; the model's edges and centres
 * go wherever a 2×2 algorithm takes them and mean nothing here.
 */

import { describe, expect, it } from 'vitest';
import { invertAlg, parseAlg, type Move } from '../../domain/cube/notation';
import { FACELETS, applyAlg, solvedState, type CubeState } from '../../domain/cube/state';
import { POCKET_PACKS, type AlgPack, type PackCase } from './packs';

function movesOf(text: string): Move[] {
  const parsed = parseAlg(text);
  if (!parsed.ok) throw new Error(`unparsable: ${text} (at ${parsed.token})`);
  return parsed.moves;
}

const turn = (state: CubeState, text: string): CubeState => applyAlg(state, movesOf(text));
const SOLVED = solvedState();

const CORNER_STICKERS = FACELETS.flatMap((sticker, index) =>
  sticker.position.every((coordinate) => coordinate !== 0) ? [index] : [],
);
/** The cube as a 2×2 is. */
const corners = (state: CubeState): string => CORNER_STICKERS.map((index) => state[index]).join('');

/** The same case with the top or the bottom turned is the same case. */
function layerTurnsKey(state: CubeState): string {
  const keys: string[] = [];
  for (const top of ['', 'U', 'U2', "U'"]) {
    for (const bottom of ['', 'D', 'D2', "D'"]) {
      keys.push(corners(turn(state, `${top} ${bottom}`.trim())));
    }
  }
  return keys.sort()[0] ?? '';
}

const caseState = (entry: PackCase): CubeState =>
  applyAlg(SOLVED, entry.setup === undefined ? invertAlg(movesOf(entry.alg)) : movesOf(entry.setup));

const isLayerStickerOf = (index: number, layer: 1 | -1): boolean =>
  CORNER_STICKERS.includes(index) && FACELETS[index]?.position[1] === layer;

/** Stickers of a layer's corners showing its own colour on top or bottom. */
const facesDone = (state: CubeState, layer: 1 | -1): boolean =>
  FACELETS.every((sticker, index) => {
    const isFace = sticker.face === (layer === 1 ? 'U' : 'D');
    return !isFace || !isLayerStickerOf(index, layer) || state[index] === sticker.face;
  });

const yellowOnTop = (state: CubeState): number =>
  FACELETS.filter(
    (sticker, index) => sticker.face === 'U' && isLayerStickerOf(index, 1) && state[index] === 'U',
  ).length;

/**
 * A bar: both of a layer's stickers on one side the same colour. The guide
 * reads a layer by them — four for a solved one, one for a swap side by side,
 * none for a swap across.
 */
function bars(state: CubeState, layer: 1 | -1): number {
  let count = 0;
  for (const side of ['F', 'R', 'B', 'L'] as const) {
    const colours = FACELETS.flatMap((sticker, index) =>
      sticker.face === side && isLayerStickerOf(index, layer) ? [state[index]] : [],
    );
    if (colours.length === 2 && colours[0] === colours[1]) count += 1;
  }
  return count;
}

const pack = (id: string): AlgPack => {
  const found = POCKET_PACKS.find((candidate) => candidate.set.id === id);
  if (!found) throw new Error(`missing pack: ${id}`);
  return found;
};

describe.each(POCKET_PACKS.map((entry) => [entry.set.id, entry] as const))('%s pack', (_id, entry) => {
  it('is a 2×2 set of the 2×2 method', () => {
    expect(entry.puzzle).toBe('222');
    expect(entry.set.method).toBe('222');
  });

  it('has a unique id and name for every case', () => {
    expect(new Set(entry.cases.map((item) => item.id)).size).toBe(entry.cases.length);
    expect(new Set(entry.cases.map((item) => item.name)).size).toBe(entry.cases.length);
  });

  it.each(entry.cases.map((item) => [item.name, item] as const))(
    '%s is a case of its own, solved by its algorithm',
    (_name, item) => {
      const before = caseState(item);
      expect(corners(before)).not.toBe(corners(SOLVED));
      expect(corners(turn(before, item.alg))).toBe(corners(SOLVED));
      // Nothing a 2×2 does not have.
      expect(item.alg).not.toMatch(/[MESrufldb]/);
    },
  );

  it('has no two cases that are the same case turned', () => {
    const keys = entry.cases.map((item) => layerTurnsKey(caseState(item)));
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe('the 2×2 OLL', () => {
  const oll = pack('pocket-oll');

  it.each(oll.cases.map((item) => [item.name, item] as const))(
    '%s leaves the bottom face alone and is grouped by the yellow on top',
    (_name, item) => {
      const before = caseState(item);
      expect(facesDone(before, -1)).toBe(true);
      expect(facesDone(before, 1)).toBe(false);

      const wanted = { 'One yellow on top': 1, 'No yellow on top': 0, 'Two yellow on top': 2 };
      expect(Object.hasOwn(wanted, item.group ?? '')).toBe(true);
      const count = Object.entries(wanted).find(([group]) => group === item.group)?.[1];
      expect(yellowOnTop(before)).toBe(count);
    },
  );

  it.each(
    oll.cases.flatMap((item) =>
      (item.others ?? []).map((moves, index) => [`${item.name} #${index + 1}`, item, moves] as const),
    ),
  )('%s turns the top yellow too, and leaves the bottom face alone', (_name, item, moves) => {
    const after = turn(caseState(item), moves);
    expect(facesDone(after, 1)).toBe(true);
    expect(facesDone(after, -1)).toBe(true);
  });

  it('has a case for every way the top can be turned, and only one', () => {
    // Every twist of the top's four corners there is, up to a turn of the top.
    const classes = new Set<string>();
    const sune = "R U R' U R U2 R'";
    const seen = new Map<string, CubeState>([[corners(SOLVED), SOLVED]]);
    const queue = [SOLVED];
    while (queue.length > 0) {
      const state = queue.shift();
      if (!state) break;
      for (const alg of ['U', sune]) {
        const next = turn(state, alg);
        if (seen.has(corners(next))) continue;
        seen.set(corners(next), next);
        queue.push(next);
      }
    }
    const shape = (state: CubeState): string => {
      const keys: string[] = [];
      let turned = state;
      for (let quarter = 0; quarter < 4; quarter++) {
        keys.push(
          FACELETS.map((_, index) =>
            isLayerStickerOf(index, 1) ? (turned[index] === 'U' ? 'y' : '.') : '',
          ).join(''),
        );
        turned = turn(turned, 'U');
      }
      return keys.sort()[0] ?? '';
    };
    for (const state of seen.values()) classes.add(shape(state));
    classes.delete(shape(SOLVED));

    expect(classes.size).toBe(7);
    expect(new Set(oll.cases.map((item) => shape(caseState(item))))).toEqual(classes);
  });
});

describe('the 2×2 PBL', () => {
  const pbl = pack('pocket-pbl');

  it.each(pbl.cases.map((item) => [item.name, item] as const))(
    '%s has both faces done and is named by the bars of each layer',
    (_name, item) => {
      const before = caseState(item);
      expect(facesDone(before, 1)).toBe(true);
      expect(facesDone(before, -1)).toBe(true);

      // "Adj/Diag": the top's two pieces side by side, the bottom's across;
      // a name with one half has a solved bottom.
      const [top = '', bottom = 'Solved'] = item.name.replace(/ U$/, '').split('/');
      const barsOf = { Adj: 1, Diag: 0, Solved: 4 };
      expect(bars(before, 1)).toBe(barsOf[top === 'Adj' ? 'Adj' : 'Diag']);
      expect(bars(before, -1)).toBe(barsOf[bottom === 'Adj' ? 'Adj' : bottom === 'Diag' ? 'Diag' : 'Solved']);

      const group = { 4: 'Bottom solved', 1: 'Bottom: adjacent swap', 0: 'Bottom: diagonal swap' };
      expect(item.group).toBe(Object.entries(group).find(([count]) => Number(count) === bars(before, -1))?.[1]);
    },
  );

  it.each(
    pbl.cases.flatMap((item) =>
      (item.others ?? []).map((moves, index) => [`${item.name} #${index + 1}`, item, moves] as const),
    ),
  )('%s solves the same case, with a turn of the top at most', (_name, item, moves) => {
    const after = turn(caseState(item), moves);
    expect(
      [after, turn(after, 'U'), turn(after, 'U2'), turn(after, "U'")].some(
        (ended) => corners(ended) === corners(SOLVED),
      ),
    ).toBe(true);
  });

  it('reads a layer of four bars as solved, one as a swap side by side and none as one across', () => {
    expect(bars(SOLVED, 1)).toBe(4);
    // Any turn of a layer keeps what its bars say.
    for (const item of pbl.cases) {
      const before = caseState(item);
      for (const top of ['U', 'U2', "U'"]) expect(bars(turn(before, top), 1)).toBe(bars(before, 1));
    }
  });
});
