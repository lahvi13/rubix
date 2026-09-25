import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { PlaybackPosition, PlaybackStatus } from '../hooks/use-playback';
import { PlaybackButtons } from './PlaybackButtons';

describe('PlaybackButtons', () => {
  it.each<[PlaybackStatus, PlaybackPosition, string, boolean, boolean]>([
    ['idle', 'start', 'Play', false, false],
    ['playing', 'middle', 'Pause', false, false],
    ['paused', 'middle', 'Continue', true, true],
    // Stepped back to the start, or on to the end: only the way that has a move.
    ['paused', 'start', 'Play', false, true],
    ['paused', 'end', 'Play', true, false],
  ])('%s at the %s: %s, back %s, next %s', (status, position, label, hasBack, hasStep) => {
    render(
      <PlaybackButtons
        status={status}
        position={position}
        onToggle={() => {}}
        onStep={() => {}}
        onBack={() => {}}
        placement="row"
      />,
    );
    expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Previous move' }) !== null).toBe(hasBack);
    expect(screen.queryByRole('button', { name: 'Next move' }) !== null).toBe(hasStep);
  });
});
