import { db } from '../schema';
import type { AlgCase, AlgSet, Algorithm } from '../types';
import { formatAlg, parseAlg } from '../../domain/cube/notation';
import { SET_ORDER } from '../seed/packs';
import { now } from '../../lib/clock';
import { createId } from '../../lib/uuid';

/**
 * Algorithms are stored the way the app writes them, so the same moves read
 * the same on the case list and in the case sheet. Text that does not parse is
 * kept as typed — the UI is what refuses it.
 */
function normaliseMoves(moves: string): string {
  const parsed = parseAlg(moves);
  // Brackets travel with it: where somebody put them is how they remember the
  // algorithm, and it is not the app's to tidy away.
  return parsed.ok ? formatAlg(parsed.moves, parsed.groups) : moves.trim();
}

export interface CaseWithAlg {
  algCase: AlgCase;
  /** The variant the user drills; the pack one unless they picked another. */
  active: Algorithm | null;
}

/** In solving order (SET_ORDER); anything the packs do not name goes last. */
export async function listSets(): Promise<AlgSet[]> {
  const sets = await db.algSets.toArray();
  const rank = (set: AlgSet): number => {
    const index = SET_ORDER.indexOf(set.id);
    return index === -1 ? SET_ORDER.length : index;
  };
  return sets.sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
}

export async function getSet(id: string): Promise<AlgSet | undefined> {
  return db.algSets.get(id);
}

export async function listCases(setId: string): Promise<AlgCase[]> {
  return db.algCases.where('[setId+order]').between([setId, -Infinity], [setId, Infinity]).toArray();
}

export async function getCase(id: string): Promise<AlgCase | undefined> {
  return db.algCases.get(id);
}

/**
 * Cases of a set together with the algorithm each one is drilled with. One
 * pass over the set's algorithms rather than a query per case — the OLL screen
 * asks for 57 of these at once.
 */
export async function listCasesWithAlgs(setId: string): Promise<CaseWithAlg[]> {
  const cases = await listCases(setId);
  const ids = new Set(cases.map((entry) => entry.id));
  const algorithms = await db.algorithms.where('caseId').anyOf([...ids]).toArray();

  const activeByCase = new Map<string, Algorithm>();
  for (const algorithm of algorithms) {
    if (algorithm.isActive !== 1) continue;
    activeByCase.set(algorithm.caseId, algorithm);
  }

  return cases.map((algCase) => ({ algCase, active: activeByCase.get(algCase.id) ?? null }));
}

/**
 * Renames a case, for the reader only. Blank puts the pack's own name back
 * rather than storing an empty string, so "no label" has one representation
 * and the seed's `existing?.label ?? null` keeps working.
 */
export async function setCaseLabel(caseId: string, label: string): Promise<void> {
  const trimmed = label.trim();
  await db.algCases.update(caseId, { label: trimmed === '' ? null : trimmed, updatedAt: now() });
}

export async function setCaseProgress(caseId: string, progress: AlgCase['progress']): Promise<void> {
  await db.algCases.update(caseId, { progress, updatedAt: now() });
}

/**
 * A case drilled for the first time is being learned, whether or not anybody
 * said so. Only ever from 'new': a case somebody marked known and drills to
 * keep sharp stays known.
 */
export async function markCaseLearning(caseId: string): Promise<void> {
  await db.algCases
    .where('id')
    .equals(caseId)
    .filter((algCase) => algCase.progress === 'new')
    .modify({ progress: 'learning', updatedAt: now() });
}

export async function listAlgorithms(caseId: string): Promise<Algorithm[]> {
  const algorithms = await db.algorithms.where('caseId').equals(caseId).toArray();
  // Pack first, then the user's own in the order they were added.
  return algorithms.sort((a, b) => {
    if (a.source !== b.source) return a.source === 'pack' ? -1 : 1;
    return a.createdAt - b.createdAt;
  });
}

export async function getActiveAlgorithm(caseId: string): Promise<Algorithm | null> {
  const active = await db.algorithms.where('[caseId+isActive]').equals([caseId, 1]).first();
  return active ?? null;
}

/** A variant the user typed in. Adding one makes it the case's algorithm. */
export async function addUserAlgorithm(caseId: string, moves: string): Promise<Algorithm> {
  const timestamp = now();
  const algorithm: Algorithm = {
    id: createId(),
    caseId,
    moves: normaliseMoves(moves),
    isActive: 1,
    source: 'user',
    packVersion: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  await db.transaction('rw', db.algorithms, async () => {
    await clearActive(caseId);
    await db.algorithms.add(algorithm);
  });
  return algorithm;
}

export async function setActiveAlgorithm(id: string): Promise<void> {
  await db.transaction('rw', db.algorithms, async () => {
    const algorithm = await db.algorithms.get(id);
    if (!algorithm) return;

    await clearActive(algorithm.caseId);
    await db.algorithms.update(id, { isActive: 1, updatedAt: now() });
  });
}

/** The pack's own algorithm is the seed's to update, so it is left alone here. */
export async function updateUserAlgorithm(id: string, moves: string): Promise<void> {
  await db.algorithms
    .where('id')
    .equals(id)
    .filter((row) => row.source === 'user')
    .modify({ moves: normaliseMoves(moves), updatedAt: now() });
}

/**
 * Only the user's own variants can go. The pack algorithm stays as the case's
 * fallback, and takes over again when the active variant is deleted.
 */
export async function deleteUserAlgorithm(id: string): Promise<void> {
  const deletedAt = now();

  await db.transaction('rw', db.algorithms, db.tombstones, async () => {
    const algorithm = await db.algorithms.get(id);
    if (!algorithm || algorithm.source !== 'user') return;

    await db.algorithms.delete(id);
    await db.tombstones.put({ id, table: 'algorithms', deletedAt });

    if (algorithm.isActive !== 1) return;
    const fallback = await db.algorithms
      .where('caseId')
      .equals(algorithm.caseId)
      .filter((row) => row.source === 'pack')
      .first();
    if (fallback) await db.algorithms.update(fallback.id, { isActive: 1, updatedAt: deletedAt });
  });
}

async function clearActive(caseId: string): Promise<void> {
  await db.algorithms
    .where('[caseId+isActive]')
    .equals([caseId, 1])
    .modify({ isActive: 0, updatedAt: now() });
}
