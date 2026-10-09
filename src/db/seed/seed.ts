import { db } from '../schema';
import type { AlgCase, AlgSet, Algorithm, CaseProgress, Method, Trigger } from '../types';
import { formatAlg, invertAlg, parseAlg } from '../../domain/cube/notation';
import { now } from '../../lib/clock';
import {
  CROSS_PACK,
  PACKS,
  PACK_METHOD_ID,
  PACK_PUZZLE,
  ROUX_METHOD_ID,
  type AlgPack,
  type PackCase,
} from './packs';
import { CASE_TWINS, packAlgId } from '../../domain/alg/sets';
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
 * It also retires: a pack case whose id has left the packs is taken out along
 * with its pack algorithms. Without that, a case dropped by a later version
 * stays on every device that ever saw it — upserting by id can add and correct
 * rows but never notices one that should no longer be there, which is how two
 * retired beginner cases went on being taught months after they were replaced.
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

  const deletedAt = now();
  const tombstones = [
    ...changes.retired.algCases.map((id) => ({ id, table: 'algCases', deletedAt })),
    ...changes.retired.algorithms.map((id) => ({ id, table: 'algorithms', deletedAt })),
  ];

  await db.transaction(
    'rw',
    [db.methods, db.algSets, db.algCases, db.algorithms, db.triggers, db.tombstones],
    () =>
      Promise.all([
        db.methods.bulkPut(changes.methods),
        db.algSets.bulkPut(changes.algSets),
        db.algCases.bulkPut(changes.algCases),
        db.algorithms.bulkPut(changes.algorithms),
        db.triggers.bulkPut(changes.triggers),
        // A retired row needs its tombstone or the next import brings it back.
        db.algCases.bulkDelete(changes.retired.algCases),
        db.algorithms.bulkDelete(changes.retired.algorithms),
        db.tombstones.bulkPut(tombstones),
        db.tombstones.bulkDelete(changes.unburied),
      ]),
  );
}

interface SeedChanges {
  methods: Method[];
  algSets: AlgSet[];
  algCases: AlgCase[];
  algorithms: Algorithm[];
  triggers: Trigger[];
  /** Pack rows the packs no longer have, to be deleted with a tombstone. */
  retired: { algCases: string[]; algorithms: string[] };
  /** Tombstones the seed once left on built-in algorithms the packs offer again. */
  unburied: string[];
}

interface CurrentState {
  methods: Map<string, Method>;
  algSets: Map<string, AlgSet>;
  algCases: Map<string, AlgCase>;
  algorithms: Map<string, Algorithm>;
  triggers: Map<string, Trigger>;
  /** Ids the user has deleted; the pack must leave them alone. */
  buried: Set<string>;
  /** Every algorithm row, by the case it belongs to. */
  algorithmsByCase: Map<string, Algorithm[]>;
  /** Every case id the packs carry today; anything else is a leftover. */
  packed: Set<string>;
  /** Case ids something the reader timed still points at. */
  attempted: Set<string>;
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

  const packed = new Set<string>();
  for (const pack of [...PACKS, CROSS_PACK]) {
    for (const entry of pack.cases) packed.add(entry.id);
  }

  // Asked only about the leftovers, and by index: a device that is up to date
  // has none, so the usual cost of this is a single empty array.
  const leftovers = algCases.filter((row) => !packed.has(row.id)).map((row) => row.id);
  const attempted = new Set(
    leftovers.length === 0
      ? []
      : (await db.solves.where('caseId').anyOf(leftovers).toArray()).map((solve) => solve.caseId),
  );

  return {
    methods: byId(methods),
    algSets: byId(algSets),
    algCases: byId(algCases),
    algorithms: byId(algorithms),
    triggers: byId(triggers),
    buried: new Set(tombstones.map((stone) => stone.id)),
    algorithmsByCase: groupByCase(algorithms),
    packed,
    // Only ever holds ids, never nulls: anyOf was asked for case ids.
    attempted: new Set([...attempted].filter((id): id is string => id !== null)),
  };
}

function byId<T extends { id: string }>(rows: readonly T[]): Map<string, T> {
  return new Map(rows.map((row) => [row.id, row]));
}

function groupByCase(rows: readonly Algorithm[]): Map<string, Algorithm[]> {
  const grouped = new Map<string, Algorithm[]>();
  for (const row of rows) grouped.set(row.caseId, [...(grouped.get(row.caseId) ?? []), row]);
  return grouped;
}

function planSeed(current: CurrentState): SeedChanges {
  const changes: SeedChanges = {
    methods: [],
    algSets: [],
    algCases: [],
    algorithms: [],
    triggers: [],
    retired: { algCases: [], algorithms: [] },
    unburied: [],
  };

  const agreed = agreedProgress(current.algCases);

  for (const definition of METHODS) {
    const existing = current.methods.get(definition.id);
    const method = buildMethod(definition, existing);
    if (hasChanged(existing, method)) changes.methods.push(method);
  }

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
        const algCase = buildCase(pack, entry, index, existingCase, agreed.get(entry.id));
        if (hasChanged(existingCase, algCase)) changes.algCases.push(algCase);
      }

      // A case with nothing to look up — the cross — gets no algorithm row.
      if (entry.alg === '') continue;

      const algorithmId = `${entry.id}-pack`;
      if (current.buried.has(algorithmId)) continue;

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

      const rows = current.algorithmsByCase.get(entry.id) ?? [];
      const picked = pickedExtra(rows, algorithmId, extras);
      // Judged by which row is active rather than by who wrote it. Picking a
      // second built-in algorithm is as much a choice as typing one in, and
      // counting only the typed ones left the pack free to switch its own
      // answer back on at the next start — two rows active at once, and which
      // of them the screen showed came down to the order they came back in.
      const isOtherChosen = picked !== null || rows.some((row) => row.isActive === 1 && row.source === 'user');

      const existingAlgorithm = current.algorithms.get(algorithmId);
      const algorithm = buildAlgorithm(entry, existingAlgorithm, isOtherChosen);
      if (hasChanged(existingAlgorithm, algorithm)) changes.algorithms.push(algorithm);

      for (const [extraId, moves] of extras) {
        // Nobody deletes a built-in algorithm but the seed, so a tombstone on
        // one the pack offers again was left by an earlier pack that dropped
        // it. The pack decides what it ships; the id comes back.
        if (current.buried.has(extraId)) changes.unburied.push(extraId);

        const existingExtra = current.algorithms.get(extraId);
        const extra = buildExtraAlgorithm(extraId, entry.id, moves, existingExtra, extraId === picked);
        if (hasChanged(existingExtra, extra)) changes.algorithms.push(extra);
      }

      // Built-in alternatives the pack no longer offers: gone from the pack
      // means gone from the case sheet, or a dropped duplicate lingers on
      // every device that ever saw it.
      const offered = new Set([algorithmId, ...extras.map(([extraId]) => extraId)]);
      for (const row of rows) {
        if (row.source === 'pack' && !offered.has(row.id)) changes.retired.algorithms.push(row.id);
      }
    }
  }

  planRetirements(current, changes);

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

/**
 * Cases the packs have dropped since this device last saw them, and the pack
 * algorithms that hang off them.
 *
 * Only what the pack owns and only where the reader has left it alone. A case
 * they made their own, renamed, wrote an algorithm for, or ever drilled is
 * theirs from then on: the seed may stop teaching a case, but it does not get
 * to throw away somebody's work on the way out.
 */
function planRetirements(current: CurrentState, changes: SeedChanges): void {
  for (const algCase of current.algCases.values()) {
    if (current.packed.has(algCase.id)) continue;
    if (algCase.isCustom === 1) continue;
    if (algCase.label !== null && algCase.label !== '') continue;
    if (algCase.progress !== 'new') continue;
    if (current.attempted.has(algCase.id)) continue;

    const algorithms = [...current.algorithms.values()].filter(
      (row) => row.caseId === algCase.id,
    );
    if (algorithms.some((row) => row.source === 'user')) continue;

    changes.retired.algCases.push(algCase.id);
    for (const row of algorithms) changes.retired.algorithms.push(row.id);
  }
}

const PROGRESS_RANK: Record<CaseProgress, number> = { new: 0, learning: 1, known: 2 };

/**
 * One progress for each pair of twin cases (packs.ts) that disagree. The
 * repository marks both of a pair at once, so this only meets pairs marked
 * apart before that — or brought in apart by an import — and settles them on
 * the further of the two: taking back a case somebody marked known would be
 * the one wrong answer.
 */
function agreedProgress(cases: ReadonlyMap<string, AlgCase>): Map<string, CaseProgress> {
  const agreed = new Map<string, CaseProgress>();
  for (const pair of CASE_TWINS) {
    const [first, second] = pair.map((id) => cases.get(id)?.progress);
    if (first === undefined || second === undefined || first === second) continue;

    const further = PROGRESS_RANK[first] >= PROGRESS_RANK[second] ? first : second;
    for (const id of pair) agreed.set(id, further);
  }
  return agreed;
}

function isEmpty(changes: SeedChanges): boolean {
  const { retired, ...rows } = changes;
  return (
    Object.values(rows).every((list) => list.length === 0)
    && retired.algCases.length === 0
    && retired.algorithms.length === 0
  );
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

type MethodDefinition = Omit<Method, 'createdAt' | 'updatedAt'>;

const CFOP: MethodDefinition = {
  id: PACK_METHOD_ID,
  name: 'CFOP',
  puzzle: PACK_PUZZLE,
  phases: [
    { key: 'cross', label: 'Cross', order: 0 },
    { key: 'f2l', label: 'F2L', order: 1 },
    { key: 'oll', label: 'OLL', order: 2 },
    { key: 'pll', label: 'PLL', order: 3 },
  ],
};

/**
 * Last six edges is one phase, not EO, UL/UR and the M slice: it goes by in a
 * couple of seconds of M and U, and three more taps inside it would cost more
 * than they measured.
 */
const ROUX: MethodDefinition = {
  id: ROUX_METHOD_ID,
  name: 'Roux',
  puzzle: PACK_PUZZLE,
  phases: [
    { key: 'fb', label: 'FB', order: 0 },
    { key: 'sb', label: 'SB', order: 1 },
    { key: 'cmll', label: 'CMLL', order: 2 },
    { key: 'lse', label: 'LSE', order: 3 },
  ],
};

const METHODS: readonly MethodDefinition[] = [CFOP, ROUX];

function buildMethod(definition: MethodDefinition, existing: Method | undefined): Method {
  return {
    ...definition,
    phases: definition.phases.map((phase) => ({ ...phase })),
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
  agreed: CaseProgress | undefined,
): AlgCase {
  return {
    id: entry.id,
    setId: pack.set.id,
    name: entry.name,
    // The pack names cases; it does not name them for the user. Carried over
    // the same way a trigger's colour is, so an update never takes back a
    // name somebody chose.
    label: existing?.label ?? null,
    progress: agreed ?? existing?.progress ?? 'new',
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
 * Which built-in alternative the reader has picked, found by its moves rather
 * than its id. Alternatives are numbered by their place in the pack, so a pack
 * that drops one moves every id after it along; following the id would hand
 * the reader's choice to the algorithm that happened to land on it. Null when
 * the pick is the pack's own answer, one of their own, or no longer offered —
 * in which case the pack's own answer takes over again.
 */
function pickedExtra(
  rows: readonly Algorithm[],
  mainId: string,
  extras: readonly (readonly [string, string])[],
): string | null {
  // Beside the pack's own answer, if an old seed left both on: the pick wins.
  const active = rows.find((row) => row.isActive === 1 && row.id !== mainId);
  if (active === undefined || active.source !== 'pack') return null;
  return extras.find(([, moves]) => moves === active.moves)?.[0] ?? null;
}

/**
 * The pack algorithm of a case has a derived id, so a later app version
 * replaces it instead of piling up duplicates. It is only active while nothing
 * else has been picked for the case — whatever the reader chose outranks the
 * pack, and a case left with two active rows would show one of them and tick
 * the other.
 */
function buildAlgorithm(
  entry: PackCase,
  existing: Algorithm | undefined,
  somethingElseIsChosen: boolean,
): Algorithm {
  return {
    id: `${entry.id}-pack`,
    caseId: entry.id,
    moves: entry.alg,
    isActive: somethingElseIsChosen ? 0 : 1,
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
  isPicked: boolean,
): Algorithm {
  return {
    id,
    caseId,
    moves,
    isActive: isPicked ? 1 : 0,
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
    // The pack's, not what is already there. A trigger somebody has recoloured
    // is theirs from that moment — updateTrigger says so — and this function is
    // never reached for one of those, so the colour in the row can only ever be
    // a pack colour from an older version.
    colour: packTrigger.colour,
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
