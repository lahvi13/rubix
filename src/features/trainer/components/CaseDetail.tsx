import { useCallback, useRef, useState } from 'react';
import { CubeDiagram, type DiagramView } from '../../../components/CubeDiagram';
import { packAlgKind, type PackAlgKind } from '../../../db/seed/packs';
import { PlayIcon, StopIcon } from '../../../components/Icons';
import { Sheet, type SheetPaging } from '../../../components/Sheet';
import { formatAlg, parseAlg } from '../../../domain/cube/notation';
import { applyAlg, solvedState } from '../../../domain/cube/state';
import type { Stickering } from '../../../domain/cube/views';
import type { TriggerDefinition } from '../../../domain/alg/triggers';
import { caseAlias, caseTitle } from '../../../domain/alg/case-name';
import type { CubeSkin } from '../../../lib/cube-skins';
import { watchWrite } from '../../../lib/errors';
import { packLabel, strings } from '../../../lib/strings';
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
  slot: strings.trainer.packAlgSlot,
  orient: strings.trainer.packAlgOrient,
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
  /** The whole-cube rotation the set is looked at through; see `case-view`. */
  orientation: string;
  skin: CubeSkin;
  triggers: readonly TriggerDefinition[];
  /** The cases this one is among, in the order the set lays them out. */
  ordered?: readonly CaseInSet[];
  /** Opens another of them — how the sheet steps through the set. */
  onOpen?: (entry: CaseInSet) => void;
  onClose: () => void;
}

export function CaseDetail({
  caseId,
  view,
  stickering,
  playerStickering,
  orientation,
  skin,
  triggers,
  ordered,
  onOpen,
  onClose,
}: CaseDetailProps) {
  const { algCase, algorithms, active, moves, groups, choose, addVariant, editVariant, removeVariant, rename, forgetRecognition } =
    useCaseDetail(caseId);
  const [replayToken, setReplayToken] = useState(0);
  // The sheet used to be keyed by case id so that stepping to the next one
  // built a fresh panel. That took the panel out of the document and put a
  // new one back a paint later, once its case had been read — and the screen
  // underneath showed through the gap. It stays mounted now, holding the
  // case it is showing until the next one has arrived, and clears what
  // belonged to the old one here instead.
  const [shownId, setShownId] = useState(caseId);
  const [isPlaying, setPlaying] = useState(false);
  // Which move the player is turning, so the written algorithm can follow along.
  const [playingMove, setPlayingMove] = useState<number | null>(null);
  const [draft, setDraft] = useState('');
  /**
   * The algorithm the box was filled from. The user's own is rewritten in
   * place; a built-in one is only a starting point, and saving adds a copy.
   */
  const [editing, setEditing] = useState<{ id: string; isOwn: boolean } | null>(null);
  const draftInput = useRef<HTMLTextAreaElement>(null);
  /**
   * What is in the rename box. Null means nobody has touched it, and the box
   * shows whatever the case is called — the case arrives from the database a
   * render later than this state could be seeded from it.
   */
  const [nameDraft, setNameDraft] = useState<string | null>(null);
  // What the algorithm leaves behind — a solved cube, or an oriented last
  // layer waiting for the next step — is the one thing on this screen nobody
  // came to look at, so the case comes back by itself. Kept stable: the player
  // subscribes to it.
  const stopPlaying = useCallback(() => setPlaying(false), []);
  const stats = useCaseStat(caseId);
  const recognition = useRecognitionStat(caseId);
  const attempts = useCaseAttempts(caseId);

  if (shownId !== caseId) {
    setShownId(caseId);
    setDraft('');
    setEditing(null);
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

  const title = packLabel(caseTitle(algCase));
  const alias = caseAlias(algCase);
  const label = algCase.label ?? '';
  const shownName = nameDraft ?? label;

  // The rotation is part of the setup here, so the still picture and the cube
  // that replaces it are stood the same way round.
  const setupMoves = parseAlg(`${orientation} ${algCase.setupAlg}`);
  const setup = setupMoves.ok ? setupMoves.moves : [];
  const state = applyAlg(solvedState(), setup);
  // Playing does not ask about the flat/3D setting: that one is about the
  // still picture, and nothing but a turning cube shows what the moves do.
  const play = (): void => {
    setPlaying(true);
    setReplayToken((token) => token + 1);
  };

  const draftError = draft.trim() !== '' && !parseAlg(draft).ok;
  const isEditingOwn = editing?.isOwn === true;

  const startEditing = (algorithm: { id: string; moves: string; source: 'pack' | 'user' }): void => {
    setDraft(algorithm.moves);
    setEditing({ id: algorithm.id, isOwn: algorithm.source === 'user' });
    draftInput.current?.focus();
  };
  const stopEditing = (): void => {
    setDraft('');
    setEditing(null);
  };

  return (
    <Sheet label={title} className="case-detail" paging={paging} onClose={onClose}>
      {/* The name belongs to the picture under it, not to the panel: read
          together they say which case this is. */}
      {/* Which family it belongs to — for OLL that is how the case is
          recognised in the first place, so it belongs above the name. */}
      {inSet === null ? null : <p className="case-detail__group">{packLabel(inSet.group)}</p>}
      <h2 className="case-detail__name">{title}</h2>
      {/* Under a name of the reader's own, the pack's stays visible: it is
          what every chart and video out there calls this case. */}
      {alias === null ? null : <p className="case-detail__alias">{packLabel(alias)}</p>}

      <div className="case-detail__stage">
        {isPlaying ? (
          <CasePlayer
            // Performed exactly as written — the player is stood yellow up
            // first, the set's own rotation is already at the head of the
            // setup, and a rotation moves the pieces, not the letters.
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
        groups={groups}
        triggers={triggers}
        onPlay={play}
        playingMove={isPlaying ? playingMove : null}
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
                onChange={() => watchWrite(() => choose(algorithm.id), strings.trainer.chooseAlgorithm)}
              />
              <span className="variants__moves">{algorithm.moves}</span>
            </label>
            <div className="variants__meta">
              <span
                className={
                  algorithm.source === 'pack' && packAlgKind(algorithm.id) === 'slot'
                    ? 'variants__source is-slot'
                    : 'variants__source'
                }
              >
                {algorithm.source === 'pack'
                  ? PACK_LABELS[packAlgKind(algorithm.id)]
                  : strings.trainer.ownAlg}
              </span>
              <button
                type="button"
                className={editing?.id === algorithm.id ? 'is-active' : ''}
                aria-pressed={editing?.id === algorithm.id}
                onClick={() => startEditing(algorithm)}
              >
                {strings.trainer.editAlg}
              </button>
              {algorithm.source === 'user' ? (
                <button
                  type="button"
                  onClick={() => {
                    if (editing?.id === algorithm.id) stopEditing();
                    watchWrite(() => removeVariant(algorithm.id), strings.trainer.removeAlgorithm);
                  }}
                >
                  {strings.solve.delete}
                </button>
              ) : null}
            </div>
          </li>
        ))}
      </ul>

      <form
        className="variants__add variants__add--alg"
        onSubmit={(event) => {
          event.preventDefault();
          if (draft.trim() === '' || draftError) return;
          if (editing !== null && editing.isOwn) {
            const id = editing.id;
            watchWrite(() => editVariant(id, draft), strings.trainer.saveAlgorithm);
          } else {
            watchWrite(() => addVariant(draft), strings.trainer.addAlgorithm);
          }
          stopEditing();
        }}
      >
        {/* Several lines rather than one, because an algorithm is edited in
            the middle — a bracket around the fourth move — and a single line
            on a phone shows only its first few. */}
        <textarea
          ref={draftInput}
          rows={2}
          value={draft}
          onChange={(event) => {
            // A line break means nothing in an algorithm, so Enter is the add
            // it would be in a one-line field. Read off the input rather than
            // the key: an open sheet keeps every keydown to itself.
            const input = event.nativeEvent;
            if (
              input instanceof InputEvent &&
              (input.inputType === 'insertLineBreak' || input.inputType === 'insertParagraph')
            ) {
              event.currentTarget.form?.requestSubmit();
              return;
            }
            setDraft(event.target.value.replace(/\s*\n\s*/g, ' '));
          }}
          placeholder={strings.trainer.ownAlgPlaceholder}
          aria-label={strings.trainer.ownAlgPlaceholder}
          className={draftError ? 'is-invalid' : ''}
          // Moves are not words: a keyboard that corrects them or offers to
          // finish them only puts back what was just typed.
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="done"
        />
        <button type="submit" disabled={draft.trim() === '' || draftError}>
          {isEditingOwn ? strings.trainer.saveAlg : strings.trainer.addAlg}
        </button>
        {editing === null ? null : (
          <button type="button" onClick={stopEditing}>
            {strings.trainer.cancelEdit}
          </button>
        )}
      </form>
      {draftError ? <p className="detail__error">{strings.trainer.invalidAlg}</p> : null}
      {editing !== null && !editing.isOwn ? (
        <p className="detail__hint">{strings.trainer.editPackHint}</p>
      ) : null}

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
