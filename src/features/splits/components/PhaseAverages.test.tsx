import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { MethodPhase } from '../../../db/types';
import type { PhaseAverageRow } from '../../../domain/stats/phases';
import { formatAverage } from '../../../lib/format';
import { PhaseAverages } from './PhaseAverages';

const PHASES: MethodPhase[] = [
  { key: 'cross', label: 'Cross', order: 0 },
  { key: 'f2l', label: 'F2L', order: 1 },
];

const ROWS: PhaseAverageRow[] = [
  {
    n: 'all',
    phases: [
      { phase: 'cross', ms: 3000, count: 2, solveId: null },
      { phase: 'f2l', ms: 9000, count: 2, solveId: null },
    ],
    totalMs: 12_000,
    totalSolveId: null,
  },
  {
    n: 'best',
    phases: [
      { phase: 'cross', ms: 2000, count: 2, solveId: 'fast-cross' },
      { phase: 'f2l', ms: 8000, count: 2, solveId: 'fast-f2l' },
    ],
    totalMs: 11_000,
    totalSolveId: 'fastest',
  },
];

describe('PhaseAverages', () => {
  it('opens the solve a best was set in, and nothing behind an average', async () => {
    const onOpenSolve = vi.fn();
    const user = userEvent.setup();
    render(
      <PhaseAverages
        rows={ROWS}
        phases={PHASES}
        measuredCount={2}
        solveCount={2}
        onOpenSolve={onOpenSolve}
      />,
    );

    await user.click(screen.getByRole('button', { name: formatAverage(8000) }));
    await user.click(screen.getByRole('button', { name: formatAverage(11_000) }));
    expect(onOpenSolve.mock.calls).toEqual([['fast-f2l'], ['fastest']]);

    expect(screen.queryByRole('button', { name: formatAverage(9000) })).toBeNull();
    expect(screen.queryByRole('button', { name: formatAverage(12_000) })).toBeNull();
  });
});
