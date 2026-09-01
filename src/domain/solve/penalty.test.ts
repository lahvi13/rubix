import { describe, expect, it } from 'vitest';
import type { Penalty } from '../../db/types';
import { penaltyForInspection, togglePenalty } from './penalty';

describe('penaltyForInspection', () => {
  it.each<[number | null, Penalty]>([
    [null, 'none'],
    [0, 'none'],
    [14_999, 'none'],
    // Exactly on the limit is still clean — the penalty applies above it.
    [15_000, 'none'],
    [15_001, 'plus2'],
    [17_000, 'plus2'],
    [17_001, 'dnf'],
    [60_000, 'dnf'],
  ])('%sms of inspection gives %s', (inspectionMs, expected) => {
    expect(penaltyForInspection(inspectionMs)).toBe(expected);
  });
});

describe('togglePenalty', () => {
  it('applies a penalty that is not set', () => {
    expect(togglePenalty('none', 'plus2')).toBe('plus2');
    expect(togglePenalty('none', 'dnf')).toBe('dnf');
  });

  it('clears the penalty when the same one is pressed again', () => {
    expect(togglePenalty('plus2', 'plus2')).toBe('none');
    expect(togglePenalty('dnf', 'dnf')).toBe('none');
  });

  it('replaces one penalty with the other', () => {
    expect(togglePenalty('plus2', 'dnf')).toBe('dnf');
    expect(togglePenalty('dnf', 'plus2')).toBe('plus2');
  });
});
