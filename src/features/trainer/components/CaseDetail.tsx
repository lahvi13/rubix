import { useState } from 'react';
import { CubeDiagram, type DiagramView } from '../../../components/CubeDiagram';
import { formatAlg, mirrorAlg, parseAlg } from '../../../domain/cube/notation';
import { applyAlg, solvedState } from '../../../domain/cube/state';
import type { Stickering } from '../../../domain/cube/views';
import type { TriggerDefinition } from '../../../domain/alg/triggers';
import type { CubeSkin } from '../../../lib/cube-skins';
import { strings } from '../../../lib/strings';
import { useCaseDetail } from '../hooks/use-case-detail';
import { AlgText } from './AlgText';
import { CasePlayer } from './CasePlayer';

interface CaseDetailProps {
  caseId: string;
  view: DiagramView;
  stickering: Stickering;
  skin: CubeSkin;
  triggers: readonly TriggerDefinition[];
  onClose: () => void;
}

export function CaseDetail({
  caseId,
  view,
  stickering,
  skin,
  triggers,
  onClose,
}: CaseDetailProps) {
  const { algCase, algorithms, active, moves, choose, addVariant, removeVariant } =
    useCaseDetail(caseId);
  const [isMirrored, setMirrored] = useState(false);
  const [replayToken, setReplayToken] = useState(0);
  const [isPlaying, setPlaying] = useState(false);
  const [draft, setDraft] = useState('');

  if (!algCase) return null;

  const shownMoves = isMirrored ? mirrorAlg(moves) : moves;
  const setupMoves = parseAlg(algCase.setupAlg);
  const setup = setupMoves.ok
    ? isMirrored
      ? mirrorAlg(setupMoves.moves)
      : setupMoves.moves
    : [];
  const state = applyAlg(solvedState(), setup);

  const play = (): void => {
    setPlaying(true);
    setReplayToken((token) => token + 1);
  };

  const draftError = draft.trim() !== '' && !parseAlg(draft).ok;

  return (
    <div className="detail case-detail" role="dialog" aria-label={algCase.name}>
      <div className="detail__header">
        <h2>{algCase.name}</h2>
        <button type="button" onClick={onClose}>
          {strings.history.close}
        </button>
      </div>

      <div className="case-detail__stage">
        {isPlaying ? (
          <CasePlayer
            setupAlg={formatAlg(setup)}
            alg={formatAlg(shownMoves)}
            visualization="3D"
            replayToken={replayToken}
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
        <button type="button" className="is-primary" onClick={isPlaying ? () => setPlaying(false) : play}>
          {isPlaying ? strings.trainer.stop : strings.trainer.play}
        </button>
        <button
          type="button"
          className={isMirrored ? 'is-active' : ''}
          onClick={() => setMirrored((mirrored) => !mirrored)}
          title={strings.trainer.mirrorHint}
        >
          {strings.trainer.mirror}
        </button>
      </div>

      <AlgText
        moves={shownMoves}
        triggers={triggers}
        onPlay={play}
        playLabel={strings.trainer.play}
      />

      <h3 className="case-detail__section">{strings.trainer.variants}</h3>
      <ul className="variants">
        {algorithms.map((algorithm) => (
          <li key={algorithm.id} className="variants__item">
            <label className="variants__pick">
              <input
                type="radio"
                name="variant"
                checked={algorithm.id === active?.id}
                onChange={() => void choose(algorithm.id)}
              />
              <span className="variants__moves">
                {isMirrored ? mirrorAlgText(algorithm.moves) : algorithm.moves}
              </span>
            </label>
            <span className="variants__source">
              {algorithm.source === 'pack' ? strings.trainer.packAlg : strings.trainer.ownAlg}
            </span>
            {algorithm.source === 'user' ? (
              <button type="button" onClick={() => void removeVariant(algorithm.id)}>
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
          void addVariant(draft);
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
    </div>
  );
}

function mirrorAlgText(moves: string): string {
  const parsed = parseAlg(moves);
  return parsed.ok ? formatAlg(mirrorAlg(parsed.moves)) : moves;
}
