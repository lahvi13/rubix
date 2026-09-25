import type { PlaybackPosition, PlaybackStatus } from '../hooks/use-playback';
import { strings } from '../lib/strings';
import { BackIcon, PauseIcon, PlayIcon, StepIcon } from './Icons';

interface PlaybackButtonsProps {
  status: PlaybackStatus;
  /** Where a paused cube stands. */
  position: PlaybackPosition;
  onToggle: () => void;
  onStep: () => void;
  onBack: () => void;
  /**
   * `corners` lies over the cube, in the corners a cube seen from a corner
   * and an unfolded net both leave empty; `row` is a line of its own under it.
   */
  placement: 'corners' | 'row';
  /** What playing from the start means here, when it is more than "play". */
  playLabel?: string;
}

/**
 * Play or pause, and a move on or back. The steps only appear once the cube
 * has been paused: someone who stops it is someone who could not keep up, and
 * that is who going a move at a time is for. Someone just watching sees no
 * more than a pause button, and a still picture — on a screen meant to be
 * quiet — no more than play. Each step is there only when there is a move to
 * go to: nothing back from the start, nothing on from the end.
 *
 * The play button never moves when the steps appear: a button that slides
 * away between two taps is a second tap that lands on its neighbour.
 */
export function PlaybackButtons({
  status,
  position,
  onToggle,
  onStep,
  onBack,
  placement,
  playLabel = strings.playback.play,
}: PlaybackButtonsProps) {
  const isPlaying = status === 'playing';
  const isPaused = status === 'paused';
  const toggleLabel = isPlaying
    ? strings.playback.pause
    : isPaused && position === 'middle'
      ? strings.playback.resume
      : playLabel;
  return (
    <div className={`playback playback--${placement}`}>
      {isPaused && position !== 'start' ? (
        <button
          type="button"
          className="playback__back"
          aria-label={strings.playback.back}
          title={strings.playback.back}
          onClick={onBack}
        >
          <BackIcon />
        </button>
      ) : null}
      <button
        type="button"
        className={placement === 'row' ? 'is-primary playback__toggle' : 'playback__toggle'}
        aria-label={toggleLabel}
        title={toggleLabel}
        onClick={onToggle}
      >
        {isPlaying ? <PauseIcon /> : <PlayIcon />}
      </button>
      {isPaused && position !== 'end' ? (
        <button
          type="button"
          className="playback__step"
          aria-label={strings.playback.step}
          title={strings.playback.step}
          onClick={onStep}
        >
          <StepIcon />
        </button>
      ) : null}
    </div>
  );
}
