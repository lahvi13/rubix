import { useState } from 'react';
import { CubeDiagram, type DiagramView } from '../../../components/CubeDiagram';
import { formatAlg, parseAlg } from '../../../domain/cube/notation';
import { applyAlg, solvedState } from '../../../domain/cube/state';
import type { Stickering } from '../../../domain/cube/views';
import type { TriggerDefinition } from '../../../domain/alg/triggers';
import { useSetting } from '../../../hooks/use-setting';
import type { CubeSkin } from '../../../lib/cube-skins';
import { strings } from '../../../lib/strings';
import { useCaseDetail } from '../hooks/use-case-detail';
import { AlgText } from './AlgText';
import { CasePlayer } from './CasePlayer';

interface CaseDetailProps {
  caseId: string;
  view: DiagramView;
  stickering: Stickering;
  playerStickering: string;
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
  const [draft, setDraft] = useState('');
  const [previewMode] = useSetting('ui.twistyMode');
  const [showRotationAlgs] = useSetting('trainer.showRotationAlgs');

  if (!algCase) return null;

  const setupMoves = parseAlg(algCase.setupAlg);
  const setup = setupMoves.ok ? setupMoves.moves : [];
  const state = applyAlg(solvedState(), setup);
  const canPlay = previewMode === '3D';
  // Hiding a variant must never hide the one being drilled.
  const shownAlgorithms = algorithms.filter(
    (algorithm) =>
      showRotationAlgs || algorithm.isActive === 1 || !algorithm.id.endsWith('-pack-grip'),
  );

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
        {isPlaying && canPlay ? (
          <CasePlayer
            // Performed exactly as written. The player paints white on top and
            // the diagrams draw the last layer yellow up, so the colours do not
            // match — but a cube that turns B where the algorithm says F is
            // worse than a cube of the wrong colour.
            setupAlg={formatAlg(setup)}
            alg={formatAlg(moves)}
            stickering={playerStickering}
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
        {canPlay ? (
          <button
            type="button"
            className="is-primary"
            onClick={isPlaying ? () => setPlaying(false) : play}
          >
            {isPlaying ? strings.trainer.stop : strings.trainer.play}
          </button>
        ) : null}
      </div>

      <AlgText
        moves={moves}
        triggers={triggers}
        onPlay={canPlay ? play : undefined}
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
                onChange={() => void choose(algorithm.id)}
              />
              <span className="variants__moves">{algorithm.moves}</span>
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
