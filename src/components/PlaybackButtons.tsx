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
 * Play or pause, and one move on. The step only appears once the cube has been
 * paused: someone who stops it is someone who could not keep up, and that is
 * who going a move at a time is for. Someone just watching sees no more than
 * a pause button, and a still picture — on a screen meant to be quiet — no
 * more than play. The play button never moves when the step appears: a button
 * that slides away between two taps is a second tap that lands on its
 * neighbour.
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
      {status === 'paused' ? (
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
