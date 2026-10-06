import { useState } from 'react';
import { CubeDiagram } from '../../../components/CubeDiagram';
import { PlaybackButtons } from '../../../components/PlaybackButtons';
import { Sheet } from '../../../components/Sheet';
import type { TriggerDefinition } from '../../../domain/alg/triggers';
import { formatAlg, invertAlg, parseAlg } from '../../../domain/cube/notation';
import { usePlayback } from '../../../hooks/use-playback';
import { usePlaybackKeys } from '../../../hooks/use-playback-keys';
import { useTap } from '../../../hooks/use-tap';
import type { CubeSkin } from '../../../lib/cube-skins';
import { strings } from '../../../lib/strings';
import { AlgText, CasePlayer } from '../../trainer';
import { holdState, type LearnSituation } from '../steps';

interface SituationSheetProps {
  situation: LearnSituation;
  skin: CubeSkin;
  triggers: readonly TriggerDefinition[];
  onClose: () => void;
}

/**
 * A cross situation opened the way every case on the page opens: a sheet with
 * the cube, its controls and the moves. Only that — the case sheet's learning
 * state, variants and attempts belong to an algorithm worth learning, and two
 * or four moves read off a picture are not one.
 */
export function SituationSheet({ situation, skin, triggers, onClose }: SituationSheetProps) {
  const parsed = parseAlg(situation.alg);
  const moves = parsed.ok ? parsed.moves : [];
  const playback = usePlayback(situation.alg);
  const [playingMove, setPlayingMove] = useState<number | null>(null);
  const isPlaying = playback.status !== 'idle';
  const tap = useTap(playback.toggle);
  usePlaybackKeys(playback, { isActive: true, withSpace: true });

  const picture = (
    <CubeDiagram
      className="case-detail__diagram"
      state={holdState(situation)}
      view="isometric"
      stickering="cross"
      skin={skin}
      label={situation.text}
    />
  );

  return (
    <Sheet label={situation.text} className="case-detail" onClose={onClose}>
      <h2 className="case-detail__name learn__situation-name">{situation.text}</h2>

      <div className="case-detail__stage" {...tap}>
        {isPlaying ? (
          <CasePlayer
            setupAlg={formatAlg(invertAlg(moves))}
            alg={formatAlg(moves)}
            stickering="cross"
            request={playback.request}
            onMove={setPlayingMove}
            onStopped={playback.stopped}
            placeholder={picture}
          />
        ) : (
          picture
        )}
      </div>

      <div className="case-detail__controls">
        <PlaybackButtons
          status={playback.status}
          onToggle={playback.toggle}
          onStep={playback.step}
          onBack={playback.back}
          position={playback.position}
          placement="row"
        />
      </div>

      <AlgText
        moves={moves}
        triggers={triggers}
        onPlay={playback.restart}
        playingMove={isPlaying ? playingMove : null}
        playLabel={strings.trainer.play}
      />
    </Sheet>
  );
}
