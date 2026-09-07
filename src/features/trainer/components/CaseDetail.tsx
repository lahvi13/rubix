import { useCallback, useState } from 'react';
import { CubeDiagram, type DiagramView } from '../../../components/CubeDiagram';
import { CloseIcon, PlayIcon, StopIcon } from '../../../components/Icons';
import { formatAlg, parseAlg } from '../../../domain/cube/notation';
import { applyAlg, solvedState } from '../../../domain/cube/state';
import type { Stickering } from '../../../domain/cube/views';
import type { TriggerDefinition } from '../../../domain/alg/triggers';
import { useSetting } from '../../../hooks/use-setting';
import type { CubeSkin } from '../../../lib/cube-skins';
import { watchWrite } from '../../../lib/errors';
import { strings } from '../../../lib/strings';
import { useCaseDetail } from '../hooks/use-case-detail';
import { useCaseStat } from '../hooks/use-case-stats';
import { useCaseAttempts } from '../hooks/use-case-attempts';
import { AlgText } from './AlgText';
import { AttemptList } from './AttemptList';
import { CaseStatsRow } from './CaseStats';
import { CasePlayer, type PlayerStickering } from './CasePlayer';

interface CaseDetailProps {
  caseId: string;
  view: DiagramView;
  stickering: Stickering;
  playerStickering: PlayerStickering;
  skin: CubeSkin;
  triggers: readonly TriggerDefinition[];
  onClose: () => void;
}

export function CaseDetail({
  caseId,
  view,
  stickering,
  playerStickering,
  skin,
  triggers,
  onClose,
}: CaseDetailProps) {
  const { algCase, algorithms, active, moves, choose, addVariant, removeVariant } =
    useCaseDetail(caseId);
  const [replayToken, setReplayToken] = useState(0);
  const [isPlaying, setPlaying] = useState(false);
  // Which move the player is turning, so the written algorithm can follow along.
  const [playingMove, setPlayingMove] = useState<number | null>(null);
  const [draft, setDraft] = useState('');
  const [showRotationAlgs] = useSetting('trainer.showRotationAlgs');
  // The algorithm leaves the cube solved, which is the one thing on this
  // screen nobody came to look at, so the case comes back by itself. Kept
  // stable: the player subscribes to it.
  const stopPlaying = useCallback(() => setPlaying(false), []);
  const stats = useCaseStat(caseId);
  const attempts = useCaseAttempts(caseId);

  if (!algCase) return null;

  const setupMoves = parseAlg(algCase.setupAlg);
  const setup = setupMoves.ok ? setupMoves.moves : [];
  const state = applyAlg(solvedState(), setup);
  // Hiding a variant must never hide the one being drilled.
  const shownAlgorithms = algorithms.filter(
    (algorithm) =>
      showRotationAlgs || algorithm.isActive === 1 || !algorithm.id.endsWith('-pack-grip'),
  );

  // Playing does not ask about the flat/3D setting: that one is about the
  // still picture, and nothing but a turning cube shows what the moves do.
  const play = (): void => {
    setPlaying(true);
    setReplayToken((token) => token + 1);
  };

  const draftError = draft.trim() !== '' && !parseAlg(draft).ok;

  return (
    <div className="detail case-detail" role="dialog" aria-label={algCase.name}>
      <div className="detail__header detail__header--bare">
        <button
          type="button"
          className="detail__close"
          onClick={onClose}
          aria-label={strings.history.close}
        >
          <CloseIcon />
        </button>
      </div>

      {/* The name belongs to the picture under it, not to the panel: read
          together they say which case this is. */}
      <h2 className="case-detail__name">{algCase.name}</h2>

      <div className="case-detail__stage">
        {isPlaying ? (
          <CasePlayer
            // Performed exactly as written — the player is stood yellow up
            // first, and a rotation moves the pieces, not the letters.
            setupAlg={formatAlg(setup)}
            alg={formatAlg(moves)}
            stickering={playerStickering}
            replayToken={replayToken}
            onMove={setPlayingMove}
            onFinished={stopPlaying}
          />
        ) : (
          <CubeDiagram
            className="case-detail__diagram"
            state={state}
            view={view}
            stickering={stickering}
            skin={skin}
            label={algCase.name}
          />
        )}
      </div>

      <div className="case-detail__controls">
        <button
          type="button"
          className="is-primary case-detail__play"
          onClick={isPlaying ? stopPlaying : play}
          aria-label={isPlaying ? strings.trainer.stop : strings.trainer.play}
          title={isPlaying ? strings.trainer.stop : strings.trainer.play}
        >
          {isPlaying ? <StopIcon /> : <PlayIcon />}
        </button>
      </div>

      <AlgText
        moves={moves}
        triggers={triggers}
        onPlay={play}
        playingMove={isPlaying ? playingMove : null}
        playLabel={strings.trainer.play}
      />

      <h3 className="case-detail__section">{strings.trainer.variants}</h3>
      <ul className="variants">
        {shownAlgorithms.map((algorithm) => (
          <li key={algorithm.id} className="variants__item">
            <label className="variants__pick">
              <input
                type="radio"
                name="variant"
                checked={algorithm.id === active?.id}
                onChange={() => watchWrite(() => choose(algorithm.id), strings.trainer.chooseAlgorithm)}
              />
              <span className="variants__moves">{algorithm.moves}</span>
            </label>
            <span className="variants__source">
              {algorithm.source === 'pack' ? strings.trainer.packAlg : strings.trainer.ownAlg}
            </span>
            {algorithm.source === 'user' ? (
              <button
                type="button"
                onClick={() =>
                  watchWrite(() => removeVariant(algorithm.id), strings.trainer.removeAlgorithm)
                }
              >
                {strings.solve.delete}
              </button>
            ) : null}
          </li>
        ))}
      </ul>

      <form
        className="variants__add"
        onSubmit={(event) => {
          event.preventDefault();
          if (draft.trim() === '' || draftError) return;
          watchWrite(() => addVariant(draft), strings.trainer.addAlgorithm);
          setDraft('');
        }}
      >
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={strings.trainer.ownAlgPlaceholder}
          aria-label={strings.trainer.ownAlgPlaceholder}
          className={draftError ? 'is-invalid' : ''}
        />
        <button type="submit" disabled={draft.trim() === '' || draftError}>
          {strings.trainer.addAlg}
        </button>
      </form>
      {draftError ? <p className="detail__error">{strings.trainer.invalidAlg}</p> : null}

      <h3 className="case-detail__section">{strings.trainer.caseStats}</h3>
      <CaseStatsRow stats={stats} />
      <AttemptList
        attempts={attempts.attempts}
        onJudge={(id, penalty) =>
          watchWrite(() => attempts.changePenalty(id, penalty), strings.drill.judging)
        }
        onDelete={(id) => watchWrite(() => attempts.remove(id), strings.drill.discarding)}
        onDeleteAll={() => watchWrite(attempts.removeAll, strings.drill.discarding)}
      />
    </div>
  );
}
