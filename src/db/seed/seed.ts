import { db } from '../schema';
import type { AlgCase, AlgSet, Algorithm, Method, Trigger } from '../types';
import { formatAlg, invertAlg, parseAlg } from '../../domain/cube/notation';
import { now } from '../../lib/clock';
import {
  CROSS_PACK,
  PACKS,
  PACK_METHOD_ID,
  PACK_PUZZLE,
  packAlgId,
  type AlgPack,
  type PackCase,
} from './packs';
import { TRIGGER_PACK } from './triggers';

/**
 * Puts the built-in data in place: the CFOP method, the algorithm sets and
 * their cases, one pack algorithm each, and the triggers.
 *
 * Runs on every start and is an upsert keyed by id, so a later app version can
 * add cases or correct an algorithm. Three things it must never do: touch a
 * row the user made their own (a user algorithm, a custom case, a trigger they
 * rewrote), bring back a row they deleted, or rewrite a row that has not
 * changed — a bumped `updatedAt` on every start would make every export look
 * freshly edited.
 *
 * Everything is read first and written in one pass at the end. Interleaving
 * hundreds of reads and writes inside a transaction is both slow and fragile:
 * Dexie commits a transaction the moment its queue runs dry, and a long chain
 * of awaits is exactly how that happens by accident.
 */
export async function seedPacks(): Promise<void> {
  const current = await readCurrent();
  const changes = planSeed(current);
  if (isEmpty(changes)) return;

  await db.transaction('rw', [db.methods, db.algSets, db.algCases, db.algorithms, db.triggers], () =>
    Promise.all([
      db.methods.bulkPut(changes.methods),
      db.algSets.bulkPut(changes.algSets),
      db.algCases.bulkPut(changes.algCases),
      db.algorithms.bulkPut(changes.algorithms),
      db.triggers.bulkPut(changes.triggers),
    ]),
  );
}

interface SeedChanges {
  methods: Method[];
  algSets: AlgSet[];
  algCases: AlgCase[];
  algorithms: Algorithm[];
  triggers: Trigger[];
}

interface CurrentState {
  methods: Map<string, Method>;
  algSets: Map<string, AlgSet>;
  algCases: Map<string, AlgCase>;
  algorithms: Map<string, Algorithm>;
  triggers: Map<string, Trigger>;
  /** Ids the user has deleted; the pack must leave them alone. */
  buried: Set<string>;
  /** Cases where a user algorithm is the one being drilled. */
  userChoice: Set<string>;
}

async function readCurrent(): Promise<CurrentState> {
  const [methods, algSets, algCases, algorithms, triggers, tombstones] = await Promise.all([
    db.methods.toArray(),
    db.algSets.toArray(),
    db.algCases.toArray(),
    db.algorithms.toArray(),
    db.triggers.toArray(),
    db.tombstones.toArray(),
  ]);

  return {
    methods: byId(methods),
    algSets: byId(algSets),
    algCases: byId(algCases),
    algorithms: byId(algorithms),
    triggers: byId(triggers),
    buried: new Set(tombstones.map((stone) => stone.id)),
    userChoice: new Set(
      algorithms
        .filter((row) => row.source === 'user' && row.isActive === 1)
        .map((row) => row.caseId),
    ),
  };
}

function byId<T extends { id: string }>(rows: readonly T[]): Map<string, T> {
  return new Map(rows.map((row) => [row.id, row]));
}

function planSeed(current: CurrentState): SeedChanges {
  const changes: SeedChanges = {
    methods: [],
    algSets: [],
    algCases: [],
    algorithms: [],
    triggers: [],
  };

  const method = buildMethod(current.methods.get(PACK_METHOD_ID));
  if (hasChanged(current.methods.get(PACK_METHOD_ID), method)) changes.methods.push(method);

  // Cross rides along with the algorithm sets: it is a set to drill, just not
  // one to read.
  for (const pack of [...PACKS, CROSS_PACK]) {
    const existingSet = current.algSets.get(pack.set.id);
    const algSet = buildSet(pack, existingSet);
    if (hasChanged(existingSet, algSet)) changes.algSets.push(algSet);

    for (const [index, entry] of pack.cases.entries()) {
      if (current.buried.has(entry.id)) continue;

      const existingCase = current.algCases.get(entry.id);
      // A case the user turned into their own belongs to them now.
      if (existingCase?.isCustom !== 1) {
        const algCase = buildCase(pack, entry, index, existingCase);
        if (hasChanged(existingCase, algCase)) changes.algCases.push(algCase);
      }

      // A case with nothing to look up — the cross — gets no algorithm row.
      if (entry.alg === '') continue;

      const algorithmId = `${entry.id}-pack`;
      if (current.buried.has(algorithmId)) continue;

      const existingAlgorithm = current.algorithms.get(algorithmId);
      const algorithm = buildAlgorithm(entry, existingAlgorithm, current.userChoice.has(entry.id));
      if (hasChanged(existingAlgorithm, algorithm)) changes.algorithms.push(algorithm);

      // Beside the pack's own answer: the same solution with the cube turned
      // round, and any different solution the pack offers for the same case.
      const extras: [string, string][] = [
        ...(entry.alt === undefined ? [] : [[packAlgId(entry.id, 'grip'), entry.alt]]),
        ...(entry.others ?? []).map((moves, position) => [
          packAlgId(entry.id, 'other', position),
          moves,
        ]),
        ...(entry.multiSlot ?? []).map((moves, position) => [
          packAlgId(entry.id, 'slot', position),
          moves,
        ]),
        ...(entry.orientOnly ?? []).map((moves, position) => [
          packAlgId(entry.id, 'orient', position),
          moves,
        ]),
      ] as [string, string][];

      for (const [extraId, moves] of extras) {
        if (current.buried.has(extraId)) continue;

        const existingExtra = current.algorithms.get(extraId);
        const extra = buildExtraAlgorithm(extraId, entry.id, moves, existingExtra);
        if (hasChanged(existingExtra, extra)) changes.algorithms.push(extra);
      }
    }
  }

  for (const packTrigger of TRIGGER_PACK) {
    if (current.buried.has(packTrigger.id)) continue;

    const existing = current.triggers.get(packTrigger.id);
    // Rewriting a built-in trigger makes it the user's.
    if (existing?.source === 'user') continue;

    const trigger = buildTrigger(packTrigger, existing);
    if (hasChanged(existing, trigger)) changes.triggers.push(trigger);
  }

  return changes;
}

function isEmpty(changes: SeedChanges): boolean {
  return Object.values(changes).every((rows) => rows.length === 0);
}

/** Everything about a row except when it was written. */
function fingerprint(row: object): string {
  const fields = Object.entries(row)
    .filter(([key]) => key !== 'createdAt' && key !== 'updatedAt')
    .sort(([left], [right]) => (left < right ? -1 : 1));
  return JSON.stringify(fields);
}

function hasChanged(existing: object | undefined, next: object): boolean {
  return existing === undefined || fingerprint(existing) !== fingerprint(next);
}

const CFOP = {
  id: PACK_METHOD_ID,
  name: 'CFOP',
  puzzle: PACK_PUZZLE,
  phases: [
    { key: 'cross', label: 'Cross', order: 0 },
    { key: 'f2l', label: 'F2L', order: 1 },
    { key: 'oll', label: 'OLL', order: 2 },
    { key: 'pll', label: 'PLL', order: 3 },
  ],
} as const;

function buildMethod(existing: Method | undefined): Method {
  return {
    ...CFOP,
    phases: CFOP.phases.map((phase) => ({ ...phase })),
    createdAt: existing?.createdAt ?? now(),
    updatedAt: now(),
  };
}

function buildSet(pack: AlgPack, existing: AlgSet | undefined): AlgSet {
  return {
    id: pack.set.id,
    name: pack.set.name,
    puzzle: PACK_PUZZLE,
    methodId: PACK_METHOD_ID,
    packVersion: pack.packVersion,
    createdAt: existing?.createdAt ?? now(),
    updatedAt: now(),
  };
}

function buildCase(
  pack: AlgPack,
  entry: PackCase,
  index: number,
  existing: AlgCase | undefined,
): AlgCase {
  return {
    id: entry.id,
    setId: pack.set.id,
    name: entry.name,
    // The pack names cases; it does not name them for the user. Carried over
    // the same way a trigger's colour is, so an update never takes back a
    // name somebody chose.
    label: existing?.label ?? null,
    group: entry.group,
    setupAlg: setupFor(entry),
    order: index,
    isCustom: 0,
    packVersion: pack.packVersion,
    createdAt: existing?.createdAt ?? now(),
    updatedAt: now(),
  };
}

/**
 * The pack algorithm of a case has a derived id, so a later app version
 * replaces it instead of piling up duplicates. It is only active while the
 * case has no user algorithm — the user's choice outranks the pack.
 */
function buildAlgorithm(
  entry: PackCase,
  existing: Algorithm | undefined,
  userChose: boolean,
): Algorithm {
  return {
    id: `${entry.id}-pack`,
    caseId: entry.id,
    moves: entry.alg,
    isActive: userChose ? 0 : 1,
    source: 'pack',
    packVersion: 1,
    createdAt: existing?.createdAt ?? now(),
    updatedAt: now(),
  };
}

/** An extra algorithm never takes over on its own; the user picks it. */
function buildExtraAlgorithm(
  id: string,
  caseId: string,
  moves: string,
  existing: Algorithm | undefined,
): Algorithm {
  return {
    id,
    caseId,
    moves,
    isActive: existing?.isActive ?? 0,
    source: 'pack',
    packVersion: 1,
    createdAt: existing?.createdAt ?? now(),
    updatedAt: now(),
  };
}

function buildTrigger(
  packTrigger: (typeof TRIGGER_PACK)[number],
  existing: Trigger | undefined,
): Trigger {
  return {
    id: packTrigger.id,
    name: packTrigger.name,
    moves: packTrigger.moves,
    source: 'pack',
    colour: existing?.colour ?? packTrigger.colour,
    isEnabled: existing?.isEnabled ?? 1,
    createdAt: existing?.createdAt ?? now(),
    updatedAt: now(),
  };
}

/** How the case is set up from a solved cube: its own algorithm, undone. */
function setupFor(entry: PackCase): string {
  if (entry.setup !== undefined) return entry.setup;

  const parsed = parseAlg(entry.alg);
  if (!parsed.ok) throw new Error(`Pack algorithm does not parse: ${entry.alg}`);
  return formatAlg(invertAlg(parsed.moves));
}
