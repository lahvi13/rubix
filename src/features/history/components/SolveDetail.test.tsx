import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { MethodPhase, Penalty, Solve, Split, Tag } from '../../../db/types';
import { strings } from '../../../lib/strings';
import { SolveDetail } from './SolveDetail';

const PHASES: MethodPhase[] = [
  { key: 'cross', label: 'Cross', order: 0 },
  { key: 'f2l', label: 'F2L', order: 1 },
  { key: 'oll', label: 'OLL', order: 2 },
  { key: 'pll', label: 'PLL', order: 3 },
];

const WARMUP: Tag = { id: 'tag-warmup', name: 'Warmup', color: '#4ade80', createdAt: 0, updatedAt: 0 };
const OH: Tag = { id: 'tag-oh', name: 'OH', color: '#38bdf8', createdAt: 0, updatedAt: 0 };

function solveOf(overrides: Partial<Solve> = {}): Solve {
  return {
    id: 'solve-1',
    sessionId: 'session-1',
    puzzle: '333',
    mode: 'freestyle',
    caseId: null,
    scramble: "R U R' U'",
    scrambleSource: 'generated',
    rawMs: 12_340,
    penalty: 'none',
    penaltySource: 'auto',
    inspectionMs: null,
    startedAt: 0,
    splits: [],
    splitsSchemaVersion: 1,
    tagIds: [],
    note: null,
    starred: 0,
    editedAt: null,
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  };
}

function renderDetail(solve: Solve, phases: readonly MethodPhase[] = []) {
  const props = {
    onEdit: vi.fn(),
    onCreateTag: vi.fn(async (name: string): Promise<Tag> => ({ ...WARMUP, id: 'tag-new', name })),
    onDelete: vi.fn(),
    onMove: vi.fn(),
  };
  render(
    <SolveDetail
      solve={solve}
      phases={phases}
      tags={[WARMUP, OH]}
      bests={{ totalMs: null, phaseMs: [] }}
      globalPbMs={null}
      sessionName="Default"
      onShare={vi.fn()}
      isSharing={false}
      onClose={vi.fn()}
      {...props}
    />,
  );
  return { ...props, user: userEvent.setup() };
}

const penaltyButton = (penalty: string) =>
  screen.getByRole('button', { name: `${strings.history.penaltyLabel} ${penalty}` });

describe('SolveDetail', () => {
  describe('penalty', () => {
    it.each<[string, Penalty, string, Penalty]>([
      ['+2 on a clean solve', 'none', strings.solve.plusTwo, 'plus2'],
      ['DNF on a clean solve', 'none', strings.solve.dnf, 'dnf'],
      ['+2 again takes it off', 'plus2', strings.solve.plusTwo, 'none'],
      ['DNF over a +2 replaces it', 'plus2', strings.solve.dnf, 'dnf'],
    ])('%s', async (_, from, button, to) => {
      const { onEdit, user } = renderDetail(solveOf({ penalty: from }));

      await user.click(penaltyButton(button));

      expect(onEdit).toHaveBeenCalledExactlyOnceWith('solve-1', { penalty: to });
    });
  });

  it.each([
    [0, 1],
    [1, 0],
  ] as const)('marks a solve (starred %i -> %i)', async (from, to) => {
    const { onEdit, user } = renderDetail(solveOf({ starred: from }));

    await user.click(screen.getByRole('button', { name: strings.history.markSolve }));

    expect(onEdit).toHaveBeenCalledExactlyOnceWith('solve-1', { starred: to });
  });

  describe('time', () => {
    it('corrects a mistyped time', async () => {
      const { onEdit, user } = renderDetail(solveOf());

      await user.clear(screen.getByLabelText(strings.history.rawTime));
      await user.type(screen.getByLabelText(strings.history.rawTime), '11.5');
      await user.tab();

      expect(onEdit).toHaveBeenCalledExactlyOnceWith('solve-1', { rawMs: 11_500 });
    });

    it('takes the time on Enter too', async () => {
      const { onEdit, user } = renderDetail(solveOf());

      await user.clear(screen.getByLabelText(strings.history.rawTime));
      await user.type(screen.getByLabelText(strings.history.rawTime), '11.5{Enter}');

      expect(onEdit).toHaveBeenCalledWith('solve-1', { rawMs: 11_500 });
    });

    it('refuses what is not a time, and says how to write one', async () => {
      const { onEdit, user } = renderDetail(solveOf());

      await user.clear(screen.getByLabelText(strings.history.rawTime));
      await user.type(screen.getByLabelText(strings.history.rawTime), '12,,3');
      await user.tab();

      expect(onEdit).not.toHaveBeenCalled();
      expect(screen.getByText(strings.history.invalidTime)).toBeInTheDocument();
    });

    it('leaves a solve alone when the time was only looked at', async () => {
      const { onEdit, user } = renderDetail(solveOf());

      await user.click(screen.getByLabelText(strings.history.rawTime));
      await user.tab();

      expect(onEdit).not.toHaveBeenCalled();
    });
  });

  describe('tags', () => {
    it.each([
      ['puts a tag on', [], ['tag-warmup']],
      ['takes a tag off', ['tag-oh', 'tag-warmup'], ['tag-oh']],
    ])('%s', async (_, tagIds, expected) => {
      const { onEdit, user } = renderDetail(solveOf({ tagIds }));

      await user.click(screen.getByRole('button', { name: 'Warmup' }));

      expect(onEdit).toHaveBeenCalledExactlyOnceWith('solve-1', { tagIds: expected });
    });

    it('creates a new tag and puts it on, on Enter', async () => {
      const { onEdit, onCreateTag, user } = renderDetail(solveOf({ tagIds: ['tag-oh'] }));

      await user.type(screen.getByLabelText(strings.history.newTag), 'Fast{Enter}');

      expect(onCreateTag).toHaveBeenCalledExactlyOnceWith('Fast');
      expect(onEdit).toHaveBeenCalledExactlyOnceWith('solve-1', { tagIds: ['tag-oh', 'tag-new'] });
      expect(screen.getByLabelText(strings.history.newTag)).toHaveValue('');
    });

    it('reuses a tag that exists under another case instead of making a second one', async () => {
      const { onEdit, onCreateTag, user } = renderDetail(solveOf());

      await user.type(screen.getByLabelText(strings.history.newTag), 'warmUP');
      await user.click(screen.getByRole('button', { name: '+' }));

      expect(onCreateTag).not.toHaveBeenCalled();
      expect(onEdit).toHaveBeenCalledExactlyOnceWith('solve-1', { tagIds: ['tag-warmup'] });
    });

    it('does nothing for a tag the solve already has, or for a blank name', async () => {
      const { onEdit, onCreateTag, user } = renderDetail(solveOf({ tagIds: ['tag-warmup'] }));

      await user.type(screen.getByLabelText(strings.history.newTag), 'Warmup');
      await user.click(screen.getByRole('button', { name: '+' }));
      await user.type(screen.getByLabelText(strings.history.newTag), '   ');
      await user.click(screen.getByRole('button', { name: '+' }));

      expect(onCreateTag).not.toHaveBeenCalled();
      expect(onEdit).not.toHaveBeenCalled();
    });
  });

  describe('note', () => {
    it('keeps what was written', async () => {
      const { onEdit, user } = renderDetail(solveOf());

      await user.type(screen.getByLabelText(strings.history.note), 'lockup on PLL');
      await user.tab();

      expect(onEdit).toHaveBeenCalledExactlyOnceWith('solve-1', { note: 'lockup on PLL' });
    });

    it('stores an emptied note as no note', async () => {
      const { onEdit, user } = renderDetail(solveOf({ note: 'lockup' }));

      await user.clear(screen.getByLabelText(strings.history.note));
      await user.tab();

      expect(onEdit).toHaveBeenCalledExactlyOnceWith('solve-1', { note: null });
    });

    // Every edit stamps the solve as edited, and an export as freshly changed.
    it.each([
      ['no note', null],
      ['a note', 'lockup'],
    ])('leaves a solve alone when %s was only looked at', async (_, note) => {
      const { onEdit, user } = renderDetail(solveOf({ note }));

      await user.click(screen.getByLabelText(strings.history.note));
      await user.tab();

      expect(onEdit).not.toHaveBeenCalled();
    });
  });

  describe('phase times', () => {
    const splits: Split[] = [
      { phase: 'cross', atMs: 2_000, source: 'manual' },
      { phase: 'f2l', atMs: 8_000, source: 'manual' },
    ];

    it('sends the method with the splits, so the repository can check them', async () => {
      const { onEdit, user } = renderDetail(solveOf({ splits }), PHASES);

      await user.click(screen.getByRole('button', { name: `${strings.splits.removeSplit} F2L` }));

      expect(onEdit).toHaveBeenCalledExactlyOnceWith('solve-1', {
        splits: [splits[0]],
        phaseKeys: ['cross', 'f2l', 'oll', 'pll'],
      });
    });

    it('takes a boundary on Enter inside the sheet', async () => {
      const { onEdit, user } = renderDetail(solveOf({ splits }), PHASES);
      const field = screen.getByLabelText(`F2L ${strings.splits.endsAt}`);

      await user.clear(field);
      await user.type(field, '7.5{Enter}');

      expect(onEdit).toHaveBeenCalledWith('solve-1', {
        splits: [splits[0], { ...splits[1], atMs: 7_500 }],
        phaseKeys: ['cross', 'f2l', 'oll', 'pll'],
      });
    });

    it('offers no phase editor where the session has no method phases', () => {
      renderDetail(solveOf());

      expect(screen.queryByText(strings.splits.title)).not.toBeInTheDocument();
    });
  });

  it('hands deleting and moving to the sheet around it', async () => {
    const { onDelete, onMove, user } = renderDetail(solveOf());

    await user.click(screen.getByRole('button', { name: strings.history.moveTo }));
    await user.click(screen.getByRole('button', { name: strings.solve.delete }));

    expect(onMove).toHaveBeenCalledOnce();
    expect(onDelete).toHaveBeenCalledExactlyOnceWith('solve-1');
  });
});
