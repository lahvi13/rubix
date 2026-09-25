import type { PlaybackStatus } from '../hooks/use-playback';
import { strings } from '../lib/strings';
import { PauseIcon, PlayIcon, StepIcon } from './Icons';

interface PlaybackButtonsProps {
  status: PlaybackStatus;
  onToggle: () => void;
  onStep: () => void;
  /**
   * `corners` lies over the cube, in the two corners a cube leaves empty on
   * the right; `row` is a line of its own under it.
   */
  placement: 'corners' | 'row';
  /** What playing from the start means here, when it is more than "play". */
  playLabel?: string;
}

/**
 * Play or pause, and one move on. The step only appears once there is a cube
 * turning: before that there is nothing to step through, and a still picture
 * with two buttons on it is one more thing to read on a screen that is meant
 * to be quiet. The play button never moves when it does — a button that slides
 * away between two taps is a second tap that lands on its neighbour.
 */
export function PlaybackButtons({
  status,
  onToggle,
  onStep,
  placement,
  playLabel = strings.playback.play,
}: PlaybackButtonsProps) {
  const isPlaying = status === 'playing';
  const toggleLabel = isPlaying
    ? strings.playback.pause
    : status === 'paused'
      ? strings.playback.resume
      : playLabel;
  return (
    <div className={`playback playback--${placement}`}>
      <button
        type="button"
        className={placement === 'row' ? 'is-primary playback__toggle' : 'playback__toggle'}
        aria-label={toggleLabel}
        title={toggleLabel}
        onClick={onToggle}
      >
        {isPlaying ? <PauseIcon /> : <PlayIcon />}
      </button>
      {status === 'idle' ? null : (
        <button
          type="button"
          className="playback__step"
          aria-label={strings.playback.step}
          title={strings.playback.step}
          onClick={onStep}
        >
          <StepIcon />
        </button>
      )}
    </div>
  );
}
