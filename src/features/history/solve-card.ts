import type { Solve } from '../../db/types';
import { parseAlg } from '../../domain/cube/notation';
import { applyAlg, solvedState } from '../../domain/cube/state';
import { CUBE_ORDER, SUPPORTED_PUZZLES } from '../../domain/puzzle/puzzles';
import { finalMs } from '../../domain/solve/final-time';
import { formatDate, formatIsoDate, formatResult } from '../../lib/format';
import type { ShareCard } from '../../lib/share-card';
import { strings } from '../../lib/strings';

export type SolveRecord = 'personal' | 'session' | null;

/**
 * One solve as a picture: the time, the record it holds, the scramble. A
 * scramble the app did not draw is said up top — a time on one somebody
 * chose, or solved before, is not the claim a random one makes, and the
 * picture is what travels without the app around it. So is the method, where
 * the sender times in more than one: a best is the best of its method, and a
 * Roux minute is not a CFOP one.
 */
export function solveCard(
  solve: Solve,
  record: SolveRecord,
  methodName: string | null = null,
): ShareCard {
  const source =
    solve.scrambleSource === 'generated' ? null : strings.scramble.sources[solve.scrambleSource];

  return {
    kicker: [strings.share.single, methodName, source].filter((part) => part !== null).join(' · '),
    headline: formatResult(finalMs(solve), solve.penalty),
    badge:
      record === 'personal'
        ? `★ ${strings.history.personalBest}`
        : record === 'session'
          ? `★ ${strings.history.sessionBest}`
          : null,
    detail: solve.scramble,
    date: formatDate(solve.createdAt),
    ...scrambledCube(solve),
  };
}

/**
 * Only a cube the app can be switched to is drawn, and only from a scramble
 * that reads — an old import may not.
 */
function scrambledCube(solve: Solve): Pick<ShareCard, 'cube' | 'cubeOrder'> {
  const puzzle = SUPPORTED_PUZZLES.find((supported) => supported === solve.puzzle);
  const parsed = parseAlg(solve.scramble);
  if (puzzle === undefined || !parsed.ok || parsed.moves.length === 0) return { cube: null };
  return { cube: applyAlg(solvedState(), parsed.moves), cubeOrder: CUBE_ORDER[puzzle] };
}

export function solveCardFilename(solve: Solve): string {
  return `rubix-single-${formatIsoDate(solve.createdAt)}.png`;
}
