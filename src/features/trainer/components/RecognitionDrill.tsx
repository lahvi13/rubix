import { useCallback, useState, type ReactNode } from 'react';
import { CubeDiagram } from '../../../components/CubeDiagram';
import { PlayIcon, StopIcon } from '../../../components/Icons';
import type { DrillMode } from '../../../db/repositories/settings-repository';
import { caseTitle } from '../../../domain/alg/case-name';
import { formatAlg, type Move, type MoveGroup } from '../../../domain/cube/notation';
import { useCubeSkin } from '../../../hooks/use-cube-skin';
import { useSetting } from '../../../hooks/use-setting';
import { formatTime } from '../../../lib/format';
import { packLabel, strings } from '../../../lib/strings';
import { diagramFor } from '../case-view';
import { useAlgSets } from '../hooks/use-alg-cases';
import { useTriggers } from '../hooks/use-triggers';
import {
  useRecognition,
  type RecognitionOption,
  type RecognitionOutcome,
  type RecognitionProblem,
} from '../hooks/use-recognition';
import { AlgText } from './AlgText';
import { CasePlayer } from './CasePlayer';
import { CasePool } from './CasePool';
import { CaseStatsRow } from './CaseStats';
import { drillSummary } from '../drill-summary';
import { DrillLevels, DrillLooks, DrillModes, DrillSets, DrillSetup } from './DrillControls';

interface RecognitionDrillProps {
  mode: DrillMode;
  onMode: (mode: DrillMode) => void;
}

/**
 * Recognition: which case is on the cube, with nothing to perform.
 *
 * The question is drawn the way the case is met in a solve — the top and the
 * two faces you can see with the cube in your hands — and the cards are the
 * same charts the trainer shows, because that is the crossing the eye
 * actually has to make: from a cube in front of you to the picture you learned
 * it from. The two faces you cannot see are one tap away, at the cost of the
 * seconds it takes, which is exactly what turning the cube round costs.
 */
export function RecognitionDrill({ mode, onMode }: RecognitionDrillProps) {
  const sets = useAlgSets();
  const [setId, setSetId] = useSetting('trainer.drillSetId');
  const [selectedIds, setSelectedIds] = useSetting('trainer.drillCaseIds');
  const recognition = useRecognition(setId, selectedIds);
  const skin = useCubeSkin();
  const { definitions } = useTriggers();

  const caseIds = (recognition.cases ?? []).map((entry) => entry.algCase.id);
  const { stats } = recognition;

  const { question, outcome } = recognition;
  // The whole set is the answer's own chart: same view, same stickering as the
  // case list, so a card is recognisable as the thing that was learned.
  const chart = question === null ? null : diagramFor(setId, question.answer.group ?? '');

  // Tied to the question it was asked for, so moving on puts the next case's
  // picture up without anything having to remember to stop the cube.
  const questionKey = question === null ? null : `${question.answer.id} ${question.scramble}`;
  const [playing, setPlaying] = useState<{ key: string; token: number } | null>(null);
  const [playingMove, setPlayingMove] = useState<number | null>(null);
  const stopPlaying = useCallback(() => setPlaying(null), []);
  const isPlaying = outcome !== null && playing !== null && playing.key === questionKey;

  const play = (): void => {
    if (questionKey === null) return;
    // The cube plays from the angle the question was asked at — the one the
    // AUF was worked out for — so a cube turned round comes back first.
    if (recognition.isTurned) recognition.turn();
    setPlaying((current) => ({ key: questionKey, token: (current?.token ?? 0) + 1 }));
  };
  const turn = (): void => {
    stopPlaying();
    recognition.turn();
  };

  const picture =
    question === null || chart === null ? null : (
      <CubeDiagram
        className="recognition__cube"
        state={recognition.isTurned ? question.turnedState : question.state}
        // Never the flat last-layer chart: that one shows all four sides
        // at once, which is the one thing a cube in your hands does not.
        view="isometric"
        stickering={chart.stickering}
        skin={skin}
        label={strings.recognition.question}
      />
    );

  return (
    <main className="screen screen--scroll">
      <div className="drill__bar">
        <DrillSets sets={sets ?? []} setId={setId} onSet={setSetId} />

        <DrillSetup summary={drillSummary(setId, mode, caseIds, selectedIds)}>
          <DrillLevels setId={setId} onSet={setSetId} />
          <DrillLooks setId={setId} onSet={setSetId} />
          <DrillModes mode={mode} onMode={onMode} canRecognise />
          <CasePool
            cases={recognition.cases}
            selectedIds={selectedIds}
            stats={stats}
            onSelect={setSelectedIds}
          />
        </DrillSetup>
      </div>

      {question === null || chart === null ? (
        <p className="drill__hint">{problemText(recognition.problem)}</p>
      ) : (
        <section className="recognition">
          {/* The cube is the button, as the timer's scramble preview is: it is
              where the moves are played, and a button of its own in the row
              under it cost the row a third control. Only once the question is
              over — before that there is nothing to play. */}
          <Stage
            canPlay={outcome !== null && question.algorithm.length > 0}
            isPlaying={isPlaying}
            onClick={isPlaying ? stopPlaying : play}
          >
            {isPlaying ? (
              <CasePlayer
                // The scramble that drew the picture, so the cube starts exactly
                // where the question left it, and the AUF goes first.
                setupAlg={question.scramble}
                alg={formatAlg([...(question.auf ?? []), ...question.algorithm])}
                stickering={chart.playerStickering}
                replayToken={playing.token}
                onMove={setPlayingMove}
                onFinished={stopPlaying}
                placeholder={picture}
              />
            ) : (
              picture
            )}
          </Stage>

          {/* Both of the things you do to a cube on this screen, in one row
              under it: turn it round while the question is open, and move on
              once it is answered. Fixed where the hand already goes, rather
              than at the far end of the cards — those are what you were just
              reading, and the answer is read from the top down. */}
          <div className="recognition__actions">
            <button
              type="button"
              className={recognition.isTurned ? 'is-active recognition__turn' : 'recognition__turn'}
              onClick={turn}
            >
              {recognition.isTurned ? strings.recognition.turnBack : strings.recognition.turn}
            </button>
            {outcome === null ? null : (
              <button type="button" className="is-primary" onClick={recognition.next}>
                {strings.recognition.next}
              </button>
            )}
          </div>

          {/* One line, never two. The cube and six cards have to be taken in
              together on a phone, and a sentence explaining a picture that
              explains itself was costing the bottom row of cards. What is left
              is the two things the picture cannot say: that a question is being
              asked, and that the cube has been turned round — without which the
              picture is simply wrong about which sides you are looking at. */}
          {outcome === null ? (
            <p className="recognition__prompt">
              {recognition.isTurned
                ? strings.recognition.turnedHint
                : strings.recognition.question}
            </p>
          ) : (
            <Verdict outcome={outcome} title={packLabel(caseTitle(question.answer))} />
          )}

          {outcome === null ? null : (
            <Solution
              moves={question.algorithm}
              groups={question.groups}
              auf={question.auf}
              triggers={definitions}
              onPlay={play}
              playingMove={isPlaying ? playingMove : null}
            />
          )}

          <div className="case-grid recognition__options">
            {question.options.map((option) => (
              <OptionCard
                key={option.algCase.id}
                option={option}
                setId={setId}
                skin={skin}
                outcome={outcome}
                answerId={question.answer.id}
                onChoose={() => recognition.answer(option.algCase.id)}
              />
            ))}
          </div>

          {outcome === null ? null : <CaseStatsRow stats={stats?.get(question.answer.id)} />}
        </section>
      )}
    </main>
  );
}

interface StageProps {
  canPlay: boolean;
  isPlaying: boolean;
  onClick: () => void;
  children: ReactNode;
}

function Stage({ canPlay, isPlaying, onClick, children }: StageProps) {
  if (!canPlay) return <div className="recognition__stage">{children}</div>;

  const label = isPlaying ? strings.trainer.stop : strings.trainer.play;
  return (
    <button
      type="button"
      className="recognition__stage"
      aria-label={label}
      title={label}
      onClick={onClick}
    >
      {children}
      <span className="recognition__play" aria-hidden="true">
        {isPlaying ? <StopIcon /> : <PlayIcon />}
      </span>
    </button>
  );
}

function problemText(problem: RecognitionProblem | null): string {
  switch (problem) {
    case 'tooFew':
      return strings.recognition.tooFew;
    case 'empty':
      return strings.recognition.empty;
    default:
      return strings.trainer.loading;
  }
}

interface VerdictProps {
  outcome: RecognitionOutcome;
  title: string;
}

/**
 * Right or wrong, and how long it took. The case is named either way: getting
 * it right and still not knowing what it is called is the state this mode
 * exists to get people out of.
 */
function Verdict({ outcome, title }: VerdictProps) {
  return (
    <p
      className={
        outcome.isCorrect ? 'recognition__verdict is-correct' : 'recognition__verdict is-wrong'
      }
      role="status"
    >
      <span className="recognition__mark">
        {outcome.isCorrect ? strings.recognition.correct : strings.recognition.wrong}
      </span>{' '}
      <span className="recognition__answer">{title}</span>{' '}
      <span className="recognition__time">{formatTime(outcome.elapsedMs)}</span>
    </p>
  );
}

interface SolutionProps {
  moves: Move[];
  groups: MoveGroup[];
  auf: Move[] | null;
  triggers: ReturnType<typeof useTriggers>['definitions'];
  onPlay: () => void;
  /** Counted through the AUF and the algorithm together, as the cube plays them. */
  playingMove: number | null;
}

/**
 * How the case is solved — from where it was just shown, not from where the
 * chart draws it.
 *
 * The turn in front is kept apart from the algorithm rather than run together
 * with it. It belongs to this one question: the same case a quarter turn round
 * wants a different one, and an algorithm learned with somebody's AUF welded
 * on is an algorithm that only works from one angle.
 */
function Solution({ moves, groups, auf, triggers, onPlay, playingMove }: SolutionProps) {
  if (moves.length === 0) return null;

  const aufLength = auf?.length ?? 0;
  const isTurningAuf = playingMove !== null && playingMove < aufLength;

  return (
    <div className="recognition__solution">
      {auf === null || auf.length === 0 ? null : (
        <span
          className="recognition__auf"
          title={strings.recognition.aufHint}
          aria-current={isTurningAuf ? 'step' : undefined}
        >
          {formatAlg(auf)}
        </span>
      )}
      <AlgText
        moves={moves}
        groups={groups}
        triggers={triggers}
        onPlay={onPlay}
        playLabel={strings.trainer.play}
        playingMove={playingMove === null || isTurningAuf ? null : playingMove - aufLength}
      />
    </div>
  );
}

interface OptionCardProps {
  option: RecognitionOption;
  setId: string;
  skin: ReturnType<typeof useCubeSkin>;
  outcome: RecognitionOutcome | null;
  answerId: string;
  onChoose: () => void;
}

/** One card to pick: the case as the trainer draws it, and what it is called. */
function OptionCard({ option, setId, skin, outcome, answerId, onChoose }: OptionCardProps) {
  const diagram = diagramFor(setId, option.algCase.group ?? '');
  const isAnswer = option.algCase.id === answerId;
  const isChosen = outcome?.chosenId === option.algCase.id;

  const state =
    outcome === null ? '' : isAnswer ? ' is-correct' : isChosen ? ' is-wrong' : ' is-dimmed';

  return (
    <button type="button" className={`case-card${state}`} onClick={onChoose}>
      <span className="case-card__name">{packLabel(caseTitle(option.algCase))}</span>
      <CubeDiagram
        className="case-card__diagram"
        state={option.state}
        view={diagram.view}
        stickering={diagram.stickering}
        skin={skin}
        label={null}
      />
    </button>
  );
}
