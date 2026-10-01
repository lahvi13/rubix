import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { MethodPhase, Solve, Split } from '../../../db/types';
import { formatMs } from '../../../lib/format';
import { strings } from '../../../lib/strings';
import { SplitEditor } from './SplitEditor';

const PHASES: MethodPhase[] = [
  { key: 'cross', label: 'Cross', order: 0 },
  { key: 'f2l', label: 'F2L', order: 1 },
  { key: 'oll', label: 'OLL', order: 2 },
  { key: 'pll', label: 'PLL', order: 3 },
];

function split(phase: string, atMs: number): Split {
  return { phase, atMs, source: 'manual' };
}

const ALL_SPLITS = [split('cross', 2_000), split('f2l', 10_000), split('oll', 14_000)];

function solveWith(splits: Split[]): Solve {
  return {
    id: 'solve-1',
    sessionId: 'session-1',
    puzzle: '333',
    mode: 'freestyle',
    caseId: null,
    scramble: "R U R' U'",
    scrambleSource: 'generated',
    rawMs: 20_000,
    penalty: 'none',
    penaltySource: 'auto',
    inspectionMs: null,
    startedAt: 0,
    splits,
    splitsSchemaVersion: 1,
    tagIds: [],
    note: null,
    starred: 0,
    editedAt: null,
    createdAt: 0,
    updatedAt: 0,
  };
}

const endsAt = (label: string) => screen.getByLabelText(`${label} ${strings.splits.endsAt}`);

describe('SplitEditor', () => {
  it('moves a boundary to the time typed, leaving the others where they were', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<SplitEditor solve={solveWith(ALL_SPLITS)} phases={PHASES} onChange={onChange} />);

    await user.clear(endsAt('F2L'));
    await user.type(endsAt('F2L'), '9.5');
    await user.tab();

    expect(onChange).toHaveBeenCalledExactlyOnceWith([
      split('cross', 2_000),
      split('f2l', 9_500),
      split('oll', 14_000),
    ]);
  });

  it('takes the time on Enter too', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<SplitEditor solve={solveWith(ALL_SPLITS)} phases={PHASES} onChange={onChange} />);

    await user.clear(endsAt('F2L'));
    await user.type(endsAt('F2L'), '9.5{Enter}');

    expect(onChange).toHaveBeenCalledWith([
      split('cross', 2_000),
      split('f2l', 9_500),
      split('oll', 14_000),
    ]);
  });

  // Refused rather than clamped, and what was typed stays so one digit can be fixed.
  it.each([
    ['past the next boundary', '15'],
    ['before the previous one', '1.5'],
    ['not a time at all', 'abc'],
  ])('refuses a time %s and keeps it on screen', async (_, typed) => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<SplitEditor solve={solveWith(ALL_SPLITS)} phases={PHASES} onChange={onChange} />);

    await user.clear(endsAt('F2L'));
    await user.type(endsAt('F2L'), typed);
    await user.tab();

    expect(onChange).not.toHaveBeenCalled();
    expect(endsAt('F2L')).toHaveClass('is-invalid');
    expect(endsAt('F2L')).toHaveValue(typed);
  });

  it('shows the time that was kept once an edit is accepted', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    const { rerender } = render(
      <SplitEditor solve={solveWith(ALL_SPLITS)} phases={PHASES} onChange={onChange} />,
    );

    await user.clear(endsAt('F2L'));
    await user.type(endsAt('F2L'), '9.5');
    await user.tab();
    rerender(<SplitEditor solve={solveWith(onChange.mock.calls[0]?.[0])} phases={PHASES} onChange={onChange} />);

    expect(endsAt('F2L')).toHaveValue(formatMs(9_500));
  });

  it('removes a boundary', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<SplitEditor solve={solveWith(ALL_SPLITS)} phases={PHASES} onChange={onChange} />);

    await user.click(screen.getByRole('button', { name: `${strings.splits.removeSplit} F2L` }));

    expect(onChange).toHaveBeenCalledExactlyOnceWith([split('cross', 2_000), split('oll', 14_000)]);
  });

  it('adds a missing boundary halfway through the block it splits', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    const solve = solveWith([split('cross', 2_000), split('oll', 14_000)]);
    render(<SplitEditor solve={solve} phases={PHASES} onChange={onChange} />);

    await user.click(screen.getByRole('button', { name: `${strings.splits.addSplit} F2L` }));

    expect(onChange).toHaveBeenCalledExactlyOnceWith([
      split('cross', 2_000),
      split('f2l', 8_000),
      split('oll', 14_000),
    ]);
  });

  it('gives the last phase no boundary of its own: the stop ends it', () => {
    render(<SplitEditor solve={solveWith(ALL_SPLITS)} phases={PHASES} onChange={vi.fn()} />);

    expect(screen.queryByLabelText(`PLL ${strings.splits.endsAt}`)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /PLL$/ })).not.toBeInTheDocument();
    expect(screen.getByText(strings.splits.endsAtStop)).toBeInTheDocument();
  });

  // The screen shows hundredths of a stop that has milliseconds: copying it
  // used to leave a PLL of 0.00 that then counted as the best PLL.
  it('ends the solve at the last boundary when it is typed as the stop', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <SplitEditor
        solve={{ ...solveWith(ALL_SPLITS), rawMs: 20_006 }}
        phases={PHASES}
        onChange={onChange}
      />,
    );

    await user.clear(endsAt('OLL'));
    await user.type(endsAt('OLL'), formatMs(20_006));
    await user.tab();

    expect(onChange).toHaveBeenCalledExactlyOnceWith([split('cross', 2_000), split('f2l', 10_000)]);
  });

  it('says the stop ends the phase the solve ended in, not always the last one', () => {
    render(
      <SplitEditor
        solve={solveWith([split('cross', 2_000), split('f2l', 10_000)])}
        phases={PHASES}
        onChange={vi.fn()}
      />,
    );

    const oll = screen.getByText('OLL').closest('li');
    const pll = screen.getByText('PLL').closest('li');
    expect(oll).toHaveTextContent(strings.splits.endsAtStop);
    expect(pll).not.toHaveTextContent(strings.splits.endsAtStop);
  });

  it('clears every boundary, and offers to only when there is one', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    const { rerender } = render(
      <SplitEditor solve={solveWith(ALL_SPLITS)} phases={PHASES} onChange={onChange} />,
    );

    await user.click(screen.getByRole('button', { name: strings.splits.clear }));
    expect(onChange).toHaveBeenCalledExactlyOnceWith([]);

    rerender(<SplitEditor solve={solveWith([])} phases={PHASES} onChange={onChange} />);
    expect(screen.queryByRole('button', { name: strings.splits.clear })).not.toBeInTheDocument();
  });
});
