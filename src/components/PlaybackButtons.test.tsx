import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { PlaybackStatus } from '../hooks/use-playback';
import { PlaybackButtons } from './PlaybackButtons';

describe('PlaybackButtons', () => {
  it.each<[PlaybackStatus, string, boolean]>([
    ['idle', 'Play', false],
    ['playing', 'Pause', false],
    ['paused', 'Continue', true],
  ])('%s: the main button says %s, the step is there: %s', (status, label, hasStep) => {
    render(<PlaybackButtons status={status} onToggle={() => {}} onStep={() => {}} placement="row" />);
    expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Next move' }) !== null).toBe(hasStep);
  });
});
