import { describe, expect, it } from 'vitest';
import { averageCard } from './average-card';
import type { AverageWindowView, WindowSolve } from './hooks/use-session-stats';

const DAY = 86_400_000;
const START = Date.UTC(2026, 8, 20, 12);

function row(resultMs: number | null, isTrimmed = false, day = 0): WindowSolve {
  return {
    id: String(resultMs),
    resultMs,
    penalty: resultMs === null ? 'dnf' : 'none',
    isTrimmed,
    createdAt: START + day * DAY,
    scramble: "R U R' U'",
  };
}

function view(solves: WindowSolve[], average: AverageWindowView['average'] = 12_000): AverageWindowView {
  return { n: 5, at: 'best', average, trim: 1, solves };
}

describe('averageCard', () => {
  it('lists every time behind the average, the trimmed ones in brackets', () => {
    const card = averageCard(
      view([row(10_210, true), row(12_450), row(13_020), row(15_330, true), row(11_550)]),
    );
    expect(card.detail).toBe('(10.21) 12.45 13.02 (15.33) 11.55');
    expect(card.headline).toBe('12.00');
    expect(card.kicker).toBe('Best ao5');
  });

  it('writes a trimmed DNF the way csTimer does', () => {
    const card = averageCard(view([row(null, true), row(12_000)]));
    expect(card.detail).toBe('(DNF) 12.00');
  });

  it.each<[string, WindowSolve[], RegExp]>([
    ['one day as that day', [row(1, false, 0), row(2, false, 0)], /^[^–]+$/],
    ['several days as a range', [row(1, false, 0), row(2, false, 3)], / – /],
  ])('dates %s', (_name, solves, pattern) => {
    expect(averageCard(view(solves)).date).toMatch(pattern);
  });
});
