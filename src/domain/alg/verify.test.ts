import { describe, expect, it } from 'vitest';
import { PACKS, type PackCase } from '../../db/seed/packs';
import { invertAlg, parseAlg } from '../cube/notation';
import { applyAlg, solvedState, type CubeState } from '../cube/state';
import { permutationArrows } from '../cube/views';
import { goalOf, verifyAlg, withPreAuf, type Auf, type CaseGoal } from './verify';

function caseState(entry: PackCase): CubeState {
  const parsed = parseAlg(entry.setup ?? entry.alg);
  if (!parsed.ok) throw new Error(`pack case does not parse: ${entry.id}`);
  return applyAlg(solvedState(), entry.setup === undefined ? invertAlg(parsed.moves) : parsed.moves);
}

function packCase(setId: string, caseId: string): PackCase {
  const found = PACKS.find((pack) => pack.set.id === setId)?.cases.find((entry) => entry.id === caseId);
  if (!found) throw new Error(`no such case: ${caseId}`);
  return found;
}

function goal(setId: string, entry: PackCase): CaseGoal {
  const found = goalOf(setId, entry.group);
  if (found === null) throw new Error(`no goal for ${setId}`);
  return found;
}

/**
 * Algorithms collected from outside the packs — other people's charts — for
 * each two-look case. Every one has to solve its own case and none of them
 * any other case of the same look: that is what tells a judge that checks
 * too little from one that checks the right thing.
 */
const OUTSIDE: readonly { setId: string; caseId: string; algs: readonly string[] }[] = [
  {
    setId: '2look-oll',
    caseId: '2oll-line',
    algs: ["F R U R' U' F'", "F' L' U' L U F", "R' U' R' F R F' U R"],
  },
  {
    setId: '2look-oll',
    caseId: '2oll-l',
    algs: ["f R U R' U' f'", "F U R U' R' F'", "F R U R' U' F' U2 F R U R' U' F'", "B' U' R' U R B"],
  },
  {
    setId: '2look-oll',
    caseId: '2oll-dot',
    algs: [
      "F R U R' U' F' f R U R' U' f'",
      "f R U R' U' f' U' F R U R' U' F'",
      "R U2 R2 F R F' U2 R' F R F'",
    ],
  },
  {
    setId: '2look-oll',
    caseId: '2oll-sune',
    algs: ["R U R' U R U2 R'", "L' U2 L U L' U L", "R' U2 R U R' U R"],
  },
  {
    setId: '2look-oll',
    caseId: '2oll-antisune',
    algs: ["R U2 R' U' R U' R'", "L' U' L U' L' U2 L", "R' U' R U' R' U2 R"],
  },
  {
    setId: '2look-oll',
    caseId: '2oll-h',
    algs: [
      "R U R' U R U' R' U R U2 R'",
      "F R U R' U' R U R' U' R U R' U' F'",
      "R U2 R' U' R U R' U' R U' R'",
    ],
  },
  {
    setId: '2look-oll',
    caseId: '2oll-pi',
    algs: ["R U2 R2 U' R2 U' R2 U2 R", "R' U2 R2 U R2 U R2 U2 R'"],
  },
  {
    setId: '2look-oll',
    caseId: '2oll-u',
    algs: ["R2 D' R U2 R' D R U2 R", "R2 D R' U2 R D' R' U2 R'"],
  },
  {
    setId: '2look-oll',
    caseId: '2oll-t',
    algs: ["r U R' U' r' F R F'", "l' U' L U R U' r' F", "R U R D R' U' R D' R2"],
  },
  {
    setId: '2look-oll',
    caseId: '2oll-bowtie',
    algs: [
      "F' r U R' U' r' F R",
      "F R' F' r U R U' r'",
      "R' F R B' R' F' R B",
      "x R' U R D' R' U' R D x'",
      "R2 D' R U' R' D R U R",
    ],
  },
  {
    setId: '2look-pll',
    caseId: '2pll-t',
    algs: [
      "R U R' U' R' F R2 U' R' U' R U R' F'",
      "R U R' F' R U R' U' R' F R2 U' R'",
      "x R' U R' D2 R U' R' D2 R2 x'",
      "R' F R' B2 R F' R' B2 R2",
    ],
  },
  {
    setId: '2look-pll',
    caseId: '2pll-y',
    algs: [
      "F R U' R' U' R U R' F' R U R' U' R' F R F'",
      "R U R' U R U R' F' R U R' U' R' F R2 U' R' U2 R U' R'",
    ],
  },
  {
    setId: '2look-pll',
    caseId: '2pll-ua',
    algs: ["R U' R U R U R U' R' U' R2", "M2 U M U2 M' U M2", "R2 U' R' U' R U R U R U' R"],
  },
  {
    setId: '2look-pll',
    caseId: '2pll-ub',
    algs: ["R2 U R U R' U' R' U' R' U R'", "M2 U' M U2 M' U' M2", "R' U R' U' R' U' R' U R U R2"],
  },
  {
    setId: '2look-pll',
    caseId: '2pll-h',
    algs: ["M2 U M2 U2 M2 U M2", "R2 U2 R U2 R2 U2 R2 U2 R U2 R2", "M2 U' M2 U2 M2 U' M2"],
  },
  {
    setId: '2look-pll',
    caseId: '2pll-z',
    algs: [
      "M' U M2 U M2 U M' U2 M2",
      "M2 U M2 U M' U2 M2 U2 M'",
      "M' U' M2 U' M2 U' M' U2 M2",
      "R' U' R U' R U R U' R' U R U R2 U' R'",
    ],
  },
];

const OUTSIDE_ROWS = OUTSIDE.flatMap(({ setId, caseId, algs }) =>
  algs.map((alg) => ({ setId, caseId, alg })),
);

describe('verifyAlg', () => {
  it.each(OUTSIDE_ROWS)('$alg solves $caseId', ({ setId, caseId, alg }) => {
    const entry = packCase(setId, caseId);
    expect(verifyAlg(caseState(entry), alg, goal(setId, entry)).ok).toBe(true);
  });

  it.each(OUTSIDE_ROWS)('$alg solves no other case of the look $caseId is in', ({ setId, caseId, alg }) => {
    const own = packCase(setId, caseId);
    const others = OUTSIDE.filter(
      (other) =>
        other.setId === setId &&
        other.caseId !== caseId &&
        packCase(setId, other.caseId).group === own.group,
    );
    expect(others.length).toBeGreaterThan(0);
    for (const other of others) {
      const entry = packCase(setId, other.caseId);
      expect(verifyAlg(caseState(entry), alg, goal(setId, entry)).ok, other.caseId).toBe(false);
    }
  });

  // Whatever the packs offer, the check must let through: a built-in
  // algorithm the trainer itself would refuse is a broken check.
  // The ones that cost a slot included: the pack offers them, so the reader
  // may type one in.
  const PACK_ROWS = PACKS.filter((pack) => goalOf(pack.set.id, pack.cases[0]?.group ?? null) !== null).flatMap(
    (pack) =>
      pack.cases.flatMap((entry) =>
        [entry.alg, entry.alt, ...(entry.others ?? []), ...(entry.orientOnly ?? []), ...(entry.multiSlot ?? [])]
          .filter((alg) => alg !== undefined)
          .map((alg) => ({ setId: pack.set.id, entry, alg })),
      ),
  );

  it('checks every set but the beginner walk', () => {
    const checked = new Set(PACK_ROWS.map((row) => row.setId));
    expect([...checked].sort()).toEqual(
      PACKS.map((pack) => pack.set.id)
        .filter((id) => id !== 'beginner')
        .sort(),
    );
  });

  it.each(PACK_ROWS)('$setId $entry.id: built-in $alg passes', ({ setId, entry, alg }) => {
    expect(verifyAlg(caseState(entry), alg, goal(setId, entry)).ok).toBe(true);
  });

  // Roux leaves the middle slice and the six edges to its last step, so an
  // algorithm that ends with them anywhere has still done its own.
  it.each([
    { setId: 'cmll', extra: "M'" },
    { setId: '2look-cmll', extra: "M'" },
    { setId: '2look-cmll', extra: 'M2' },
    { setId: 'roux-sb', extra: 'M' },
  ])('$setId: every case passes with $extra after it', ({ setId, extra }) => {
    const pack = PACKS.find((candidate) => candidate.set.id === setId);
    for (const entry of pack?.cases ?? []) {
      expect(verifyAlg(caseState(entry), `${entry.alg} ${extra}`, goal(setId, entry)).ok, entry.id).toBe(true);
    }
  });

  it.each([
    // The pair in, and a slot of the cross taken apart on the way out.
    { setId: 'f2l', caseId: 'f2l-1', extra: 'F' },
    // The blocks broken.
    { setId: 'cmll', caseId: undefined, extra: 'R' },
    { setId: '2look-cmll', caseId: undefined, extra: 'L' },
  ])('$setId: refuses an algorithm followed by $extra', ({ setId, caseId, extra }) => {
    const pack = PACKS.find((candidate) => candidate.set.id === setId);
    const entry = caseId === undefined ? pack?.cases[0] : pack?.cases.find((candidate) => candidate.id === caseId);
    if (!entry) throw new Error('no case');
    expect(verifyAlg(caseState(entry), `${entry.alg} ${extra}`, goal(setId, entry)).ok).toBe(false);
  });

  it.each([
    { caseId: '2oll-sune', alg: "R U R' U R U2 R'", preAuf: '' },
    // Written for the case turned a quarter: the turn the algorithm opens
    // with has to be undone first, and that undoing is what is reported.
    { caseId: '2oll-sune', alg: "U' R U R' U R U2 R'", preAuf: 'U' },
    { caseId: '2oll-sune', alg: "U R U R' U R U2 R'", preAuf: "U'" },
    { caseId: '2pll-ua', alg: "U2 M2 U M U2 M' U M2", preAuf: 'U2' },
  ])('$alg on $caseId wants ($preAuf) first', ({ caseId, alg, preAuf }) => {
    const setId = caseId.startsWith('2oll') ? '2look-oll' : '2look-pll';
    const entry = packCase(setId, caseId);
    expect(verifyAlg(caseState(entry), alg, goal(setId, entry))).toEqual({ ok: true, preAuf });
  });

  it.each([
    { alg: 'R U Q', error: 'unreadable' },
    { alg: '   ', error: 'unreadable' },
    // Orients the corners, then breaks the second layer.
    { alg: "R U R' U R U2 R' F", error: 'unsolved' },
  ])('refuses $alg as $error', ({ alg, error }) => {
    const entry = packCase('2look-oll', '2oll-sune');
    expect(verifyAlg(caseState(entry), alg, goal('2look-oll', entry))).toEqual({ ok: false, error });
  });

  it('refuses a corners look that leaves two edges flipped', () => {
    const entry = packCase('2look-pll', '2pll-t');
    const tPerm = "R U R' U' R' F R2 U' R' U' R U R' F'";
    // Flips two edges and leaves every corner where it was.
    const flipped = `${tPerm} M' U M U2 M' U M`;
    expect(verifyAlg(caseState(entry), flipped, ['corners']).ok).toBe(true);
    expect(verifyAlg(caseState(entry), flipped, goal('2look-pll', entry)).ok).toBe(false);
  });
});

describe('the arrows a two-look PLL case is drawn with', () => {
  it.each([
    { caseId: '2pll-z', arrows: 2 },
    { caseId: '2pll-h', arrows: 2 },
    { caseId: '2pll-ua', arrows: 3 },
    { caseId: '2pll-ub', arrows: 3 },
  ])('$caseId has $arrows', ({ caseId, arrows }) => {
    expect(permutationArrows(caseState(packCase('2look-pll', caseId)), 'edges')).toHaveLength(arrows);
  });
});

describe('withPreAuf', () => {
  it.each([
    { alg: "R U R' U R U2 R'", auf: '', expected: "R U R' U R U2 R'" },
    { alg: "L' U2 L U L' U L", auf: 'U', expected: "U L' U2 L U L' U L" },
    { alg: "(R U2 R') (U' R U' R')", auf: "U'", expected: "U' (R U2 R') (U' R U' R')" },
    // Merged with the turn it opens with, never written twice.
    { alg: "U R U R' U R U2 R'", auf: 'U', expected: "U2 R U R' U R U2 R'" },
    { alg: "U' R U R' U R U2 R'", auf: 'U', expected: "R U R' U R U2 R'" },
    { alg: "(U' R U R') (U R U2 R')", auf: 'U', expected: "(R U R') (U R U2 R')" },
    { alg: "(U') R U R' U R U2 R'", auf: 'U', expected: "R U R' U R U2 R'" },
    { alg: "U2' R U R' U R U2 R'", auf: "U'", expected: "U R U R' U R U2 R'" },
    // A wide turn is not a turn of the top layer.
    { alg: "u R U R'", auf: 'U', expected: "U u R U R'" },
    // As a phone keyboard types the prime.
    { alg: 'R U R’ U R U2 R’', auf: 'U', expected: "U R U R' U R U2 R'" },
  ])('$alg with ($auf) first is $expected', ({ alg, auf, expected }) => {
    expect(withPreAuf(alg, auf as Auf)).toBe(expected);
  });
});
