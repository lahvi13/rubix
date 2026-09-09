import { useCallback, useState } from 'react';
import { CubeDiagram, type DiagramView } from '../../../components/CubeDiagram';
import { packAlgKind, type PackAlgKind } from '../../../db/seed/packs';
import { PlayIcon, StopIcon } from '../../../components/Icons';
import { Sheet, type SheetPaging } from '../../../components/Sheet';
import { formatAlg, parseAlg } from '../../../domain/cube/notation';
import { applyAlg, solvedState } from '../../../domain/cube/state';
import type { Stickering } from '../../../domain/cube/views';
import type { TriggerDefinition } from '../../../domain/alg/triggers';
import { caseAlias, caseTitle } from '../../../domain/alg/case-name';
import { useSetting } from '../../../hooks/use-setting';
import type { CubeSkin } from '../../../lib/cube-skins';
import { watchWrite } from '../../../lib/errors';
import { strings } from '../../../lib/strings';
import { useCaseDetail } from '../hooks/use-case-detail';
import { useCaseStat, useRecognitionStat } from '../hooks/use-case-stats';
import { useCaseAttempts } from '../hooks/use-case-attempts';
import { AlgText } from './AlgText';
import { AttemptList } from './AttemptList';
import { CaseStatsRow } from './CaseStats';
import { CasePlayer, type PlayerStickering } from './CasePlayer';

/** Why this algorithm is on offer, since more than one of them is built in. */
const PACK_LABELS: Record<PackAlgKind, string> = {
  main: strings.trainer.packAlg,
  grip: strings.trainer.packAlgGrip,
  other: strings.trainer.packAlgOther,
};

/** A case's place in a set: which one, and under which heading. */
export interface CaseInSet {
  id: string;
  group: string;
}

interface CaseDetailProps {
  caseId: string;
  view: DiagramView;
  stickering: Stickering;
  playerStickering: PlayerStickering;
  skin: CubeSkin;
  triggers: readonly TriggerDefinition[];
  /** The cases this one is among, in the order the set lays them out. */
  ordered?: readonly CaseInSet[];
  /** Opens another of them â how the sheet steps through the set. */
  onOpen?: (entry: CaseInSet) => void;
  onClose: () => void;
}

export function CaseDetail({
  caseId,
  view,
  stickering,
  playerStickering,
  skin,
  triggers,
  ordered,
  onOpen,
  onClose,
}: CaseDetailProps) {
  const { algCase, algorithms, active, moves, choose, addVariant, removeVariant, rename, forgetRecognition } =
    useCaseDetail(caseId);
  const [replayToken, setReplayToken] = useState(0);
  // The sheet used to be keyed by case id so that stepping to the next one
  // built a fresh panel. That took the panel out of the document and put a
  // new one back a paint later, once its case had been read â and the screen
  // underneath showed through the gap. It stays mounted now, holding the
  // case it is showing until the next one has arrived, and clears what
  // belonged to the old one here instead.
  const [shownId, setShownId] = useState(caseId);
  const [isPlaying, setPlaying] = useState(false);
  // Which move the player is turning, so the written algorithm can follow along.
  const [playingMove, setPlayingMove] = useState<number | null>(null);
  const [draft, setDraft] = useState('');
  /**
   * What is in the rename box. Null means nobody has touched it, and the box
   * shows whatever the case is called — the case arrives from the database a
   * render later than this state could be seeded from it.
   */
  const [nameDraft, setNameDraft] = useState<string | null>(null);
  const [showRotationAlgs] = useSetting('trainer.showRotationAlgs');
  // The algorithm leaves the cube solved, which is the one thing on this
  // screen nobody came to look at, so the case comes back by itself. Kept
  // stable: the player subscribes to it.
  const stopPlaying = useCallback(() => setPlaying(false), []);
  const stats = useCaseStat(caseId);
  const recognition = useRecognitionStat(caseId);
  const attempts = useCaseAttempts(caseId);

  if (shownId !== caseId) {
    setShownId(caseId);
    setDraft('');
    setNameDraft(null);
    setPlaying(false);
    setPlayingMove(null);
  }

  if (!algCase) return null;

  // Counted from the case on screen, not the one asked for: the query holds
  // the previous case for a tick, and reading the id would have the count
  // and the heading describe one case over another one's picture.
  const at = ordered?.findIndex((entry) => entry.id === algCase.id) ?? -1;
  const inSet = at < 0 || ordered === undefined ? null : ordered[at] ?? null;
  const step = (to: number) => {
    const next = ordered?.[to];
    if (next && onOpen) onOpen(next);
  };
  const paging: SheetPaging | undefined =
    inSet === null || ordered === undefined
      ? undefined
      : {
          position: at + 1,
          total: ordered.length,
          onPrevious: at > 0 ? () => step(at - 1) : null,
          onNext: at < ordered.length - 1 ? () => step(at + 1) : null,
        };

  const title = caseTitle(algCase);
  const alias = caseAlias(algCase);
  const label = algCase.label ?? '';
  const shownName = nameDraft ?? label;

  const setupMoves = parseAlg(algCase.setupAlg);
  const setup = setupMoves.ok ? setupMoves.moves : [];
  const state = applyAlg(solvedState(), setup);
  // Hiding a variant must never hide the one being drilled. Only the grips are
  // hidden: an algorithm offered because it is a different solution is exactly
  // what this list is for.
  const shownAlgorithms = algorithms.filter(
    (algorithm) =>
      showRotationAlgs || algorithm.isActive === 1 || packAlgKind(algorithm.id) !== 'grip',
  );

  // Playing does not ask about the flat/3D setting: that one is about the
  // still picture, and nothing but a turning cube shows what the moves do.
  const play = (): void => {
    setPlaying(true);
    setReplayToken((token) => token + 1);
  };

  const draftError = draft.trim() !== '' && !parseAlg(draft).ok;

  return (
    <Sheet label={title} className="case-detail" paging={paging} onClose={onClose}>
      {/* The name belongs to the picture under it, not to the panel: read
          together they say which case this is. */}
      {/* Which family it belongs to â for OLL that is how the case is
          recognised in the first place, so it belongs above the name. */}
      {inSet === null ? null : <p className="case-detail__group">{inSet.group}</p>}
      <h2 className="case-detail__name">{title}</h2>
      {/* Under a name of the reader's own, the pack's stays visible: it is
          what every chart and video out there calls this case. */}
      {alias === null ? null : <p className="case-detail__alias">{alias}</p>}

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
            label={title}
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
              {algorithm.source === 'pack'
                ? PACK_LABELS[packAlgKind(algorithm.id)]
                : strings.trainer.ownAlg}
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

      <h3 className="case-detail__section">{strings.trainer.rename}</h3>
      <form
        className="variants__add"
        onSubmit={(event) => {
          event.preventDefault();
          watchWrite(() => rename(shownName), strings.trainer.renaming);
        }}
      >
        <input
          value={shownName}
          onChange={(event) => setNameDraft(event.target.value)}
          placeholder={strings.trainer.renamePlaceholder}
          aria-label={strings.trainer.rename}
        />
        <button type="submit" disabled={shownName.trim() === label}>
          {strings.trainer.renameSave}
        </button>
      </form>
      <p className="detail__hint">{strings.trainer.renameHint}</p>

      <h3 className="case-detail__section">{strings.recognition.caseStats}</h3>
      <CaseStatsRow stats={recognition} />
      {recognition === undefined || recognition.attempts === 0 ? null : (
        <button
          type="button"
          className="is-danger"
          onClick={() => watchWrite(forgetRecognition, strings.recognition.forgetting)}
        >
          {strings.recognition.forget}
        </button>
      )}

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
    </Sheet>
  );
}
