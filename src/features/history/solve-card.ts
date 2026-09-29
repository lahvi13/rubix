import type { Solve } from '../../db/types';
import { parseAlg } from '../../domain/cube/notation';
import { applyAlg, solvedState } from '../../domain/cube/state';
import { finalMs } from '../../domain/solve/final-time';
import { formatDate, formatIsoDate, formatResult } from '../../lib/format';
import type { ShareCard } from '../../lib/share-card';
import { strings } from '../../lib/strings';

export type SolveRecord = 'personal' | 'session' | null;

/**
 * One solve as a picture: the time, the record it holds, the scramble. A
 * scramble the app did not draw is said up top — a time on one somebody
 * chose, or solved before, is not the claim a random one makes, and the
 * picture is what travels without the app around it.
 */
export function solveCard(solve: Solve, record: SolveRecord): ShareCard {
  const source =
    solve.scrambleSource === 'generated' ? null : strings.scramble.sources[solve.scrambleSource];

  return {
    kicker: source === null ? strings.share.single : `${strings.share.single} · ${source}`,
    headline: formatResult(finalMs(solve), solve.penalty),
    badge:
      record === 'personal'
        ? `★ ${strings.history.personalBest}`
        : record === 'session'
          ? `★ ${strings.history.sessionBest}`
          : null,
    detail: solve.scramble,
    date: formatDate(solve.createdAt),
    cube: scrambledCube(solve),
  };
}

/** Only a 3×3 is drawn, and only from a scramble that reads — an old import may not. */
function scrambledCube(solve: Solve) {
  if (solve.puzzle !== '333') return null;
  const parsed = parseAlg(solve.scramble);
  return parsed.ok && parsed.moves.length > 0 ? applyAlg(solvedState(), parsed.moves) : null;
}

export function solveCardFilename(solve: Solve): string {
  return `rubix-single-${formatIsoDate(solve.createdAt)}.png`;
}
