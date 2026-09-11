import { CubeDiagram } from '../../../components/CubeDiagram';
import type { DrillMode } from '../../../db/repositories/settings-repository';
import { caseTitle } from '../../../domain/alg/case-name';
import { formatAlg, type Move } from '../../../domain/cube/notation';
import { useCubeSkin } from '../../../hooks/use-cube-skin';
import { useSetting } from '../../../hooks/use-setting';
import { formatTime } from '../../../lib/format';
import { strings } from '../../../lib/strings';
import { diagramFor } from '../case-view';
import { useAlgSets } from '../hooks/use-alg-cases';
import { useTriggers } from '../hooks/use-triggers';
import { useRecognitionStats } from '../hooks/use-case-stats';
import {
  useRecognition,
  type RecognitionOption,
  type RecognitionOutcome,
  type RecognitionProblem,
} from '../hooks/use-recognition';
import { AlgText } from './AlgText';
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
  const stats = useRecognitionStats(caseIds);

  const { question, outcome } = recognition;
  // The whole set is the answer's own chart: same view, same stickering as the
  // case list, so a card is recognisable as the thing that was learned.
  const chart = question === null ? null : diagramFor(setId, question.answer.group ?? '');

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

          {/* Both of the things you do to a cube on this screen, in one row
              under it: turn it round while the question is open, and move on
              once it is answered. Fixed where the hand already goes, rather
              than at the far end of the cards — those are what you were just
              reading, and the answer is read from the top down. */}
          <div className="recognition__actions">
            <button
              type="button"
              className={recognition.isTurned ? 'is-active recognition__turn' : 'recognition__turn'}
              onClick={recognition.turn}
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
            <Verdict outcome={outcome} title={caseTitle(question.answer)} />
          )}

          {outcome === null ? null : (
            <Solution
              moves={question.algorithm}
              auf={question.auf}
              triggers={definitions}
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
  auf: Move[] | null;
  triggers: ReturnType<typeof useTriggers>['definitions'];
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
function Solution({ moves, auf, triggers }: SolutionProps) {
  if (moves.length === 0) return null;

  return (
    <div className="recognition__solution">
      {auf === null || auf.length === 0 ? null : (
        <span className="recognition__auf" title={strings.recognition.aufHint}>
          {formatAlg(auf)}
        </span>
      )}
      <AlgText moves={moves} triggers={triggers} />
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
      <span className="case-card__name">{caseTitle(option.algCase)}</span>
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
