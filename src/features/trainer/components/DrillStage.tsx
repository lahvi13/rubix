import type { ReactNode } from 'react';
import { PlaybackButtons } from '../../../components/PlaybackButtons';
import type { Playback } from '../../../hooks/use-playback';
import { useTap } from '../../../hooks/use-tap';

interface DrillStageProps {
  /** Beside the cube on the left — what is done to the cube itself. */
  start?: ReactNode;
  /** Beside the cube on the right — moving on. */
  end?: ReactNode;
  /** Whether there is an answer to play yet. */
  canPlay: boolean;
  playback: Playback;
  /** The still picture, or the cube that plays in its place. */
  children: ReactNode;
}

/**
 * The cube with a button either side of it, shared by both drills.
 *
 * Beside it rather than in a row under it: under it, the next case was a
 * scroll away on a phone with large text, and on the recognition screen that
 * row was the bottom row of cards. Once there is something to play, a tap on
 * the cube plays and pauses it, as the timer's scramble preview does.
 */
export function DrillStage({ start, end, canPlay, playback, children }: DrillStageProps) {
  const tap = useTap(playback.toggle);

  return (
    <div className="drill__top">
      <div className="drill__side drill__side--start">{start}</div>
      {canPlay ? (
        <div className="drill__stage is-playable" {...tap}>
          {children}
          <PlaybackButtons
            status={playback.status}
            onToggle={playback.toggle}
            onStep={playback.step}
            onBack={playback.back}
            position={playback.position}
            placement="corners"
          />
        </div>
      ) : (
        <div className="drill__stage">{children}</div>
      )}
      <div className="drill__side drill__side--end">{end}</div>
    </div>
  );
}
