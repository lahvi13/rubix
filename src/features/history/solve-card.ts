import type { Solve } from '../../db/types';
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
    solve.scrambleSource === 'own'
      ? strings.scramble.own
      : solve.scrambleSource === 'history'
        ? strings.scramble.fromHistory
        : null;

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
  };
}

export function solveCardFilename(solve: Solve): string {
  return `rubix-single-${formatIsoDate(solve.createdAt)}.png`;
}
