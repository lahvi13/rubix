import { useRef, useState } from 'react';
import { CubeDiagram } from '../../../components/CubeDiagram';
import { CROSS_SET_ID } from '../../../db/seed/packs';
import { caseTitle } from '../../../domain/alg/case-name';
import type { TriggerDefinition } from '../../../domain/alg/triggers';
import { parseAlg } from '../../../domain/cube/notation';
import { solvedState } from '../../../domain/cube/state';
import { useCubeSkin } from '../../../hooks/use-cube-skin';
import { useSetting } from '../../../hooks/use-setting';
import type { CubeSkin } from '../../../lib/cube-skins';
import { strings } from '../../../lib/strings';
import {
  AlgText,
  CaseCard,
  CaseDetail,
  NotationReference,
  diagramFor,
  useSetCases,
  useTriggers,
  type CaseGroup,
  type Diagram,
  type TrainerCase,
} from '../../trainer';
import { useCurrentStep } from '../hooks/use-current-step';
import { LEARN_STEPS, holdState, type LearnStep } from '../steps';

const anchorOf = (step: LearnStep) => `learn-${step.id}`;
const STEP_IDS = LEARN_STEPS.map(anchorOf);

/** Which case sheet is open, and which set and group it belongs to. */
interface OpenCase {
  id: string;
  setId: string;
  group: string;
}

/**
 * One whole solve, explained in the order it happens.
 *
 * Deliberately not a page of pictures: every case on it is a real case out of
 * a real set, drawn by the same code as the trainer draws it, and playable. A
 * printed cheat sheet cannot be turned round and watched, and watching it turn
 * is most of what a first cube needs.
 *
 * Nothing here sends anybody to the drill. Practising one case against a clock
 * is what somebody does once they can already solve it, and this page is for
 * the days before that.
 */
export function LearnScreen() {
  const skin = useCubeSkin();
  const { definitions } = useTriggers();
  const [openCase, setOpenCase] = useState<OpenCase | null>(null);
  const [showNotation, setShowNotation] = useState(false);
  const [showLearn, setShowLearn] = useSetting('ui.showLearn');
  const [isExplained, setExplained] = useSetting('ui.learnExplanations');
  const nav = useRef<HTMLElement>(null);
  const [current, jumpTo] = useCurrentStep(STEP_IDS, nav);

  return (
    <main className="screen screen--scroll learn">
      {isExplained ? <p className="learn__intro">{strings.learn.intro}</p> : null}

      <div className="learn__tools">
        <button
          type="button"
          className={showNotation ? 'is-active' : ''}
          aria-expanded={showNotation}
          onClick={() => setShowNotation((shown) => !shown)}
        >
          {strings.trainer.notation}
        </button>
        <button
          type="button"
          className={isExplained ? 'is-active' : ''}
          aria-pressed={isExplained}
          onClick={() => setExplained(!isExplained)}
        >
          {strings.learn.explanations}
        </button>
      </div>

      {showNotation ? <NotationReference skin={skin} /> : null}

      {/* Numbers, not names: seven names do not fit across a phone, and the
          numbers are the ones every step is headed with. */}
      <nav ref={nav} className="learn__nav" aria-label={strings.learn.stepsNav}>
        {LEARN_STEPS.map((step, index) => (
          <button
            key={step.id}
            type="button"
            className={index === current ? 'is-active' : ''}
            aria-label={step.title}
            aria-current={index === current ? 'true' : undefined}
            onClick={() => jumpTo(index)}
          >
            {index + 1}
          </button>
        ))}
      </nav>

      {LEARN_STEPS.map((step, index) => (
        <StepSection
          key={step.id}
          id={anchorOf(step)}
          number={index + 1}
          step={step}
          isExplained={isExplained}
          skin={skin}
          triggers={definitions}
          onOpen={(id, setId, group) => setOpenCase({ id, setId, group })}
        />
      ))}

      {/* After the guide, not before it: the top of the page belongs to the
          steps, and Settings has the same switch for whoever looks there. */}
      <div className="learn__dismiss">
        <label className="toggle">
          <input
            type="checkbox"
            checked={!showLearn}
            onChange={(event) => setShowLearn(!event.target.checked)}
          />
          {strings.learn.hide}
        </label>
        {isExplained ? (
          <p className="learn__caption learn__caption--left">{strings.learn.hideHint}</p>
        ) : null}
      </div>

      <p className="learn__credit">
        {strings.learn.source}{' '}
        <a href="http://badmephisto.com" target="_blank" rel="noopener noreferrer">
          {strings.learn.sourceLink}
        </a>
      </p>

      {openCase !== null ? (
        <CaseDetail
          caseId={openCase.id}
          {...diagramFor(openCase.setId, openCase.group)}
          skin={skin}
          triggers={definitions}
          onClose={() => setOpenCase(null)}
        />
      ) : null}
    </main>
  );
}

interface StepSectionProps {
  id: string;
  number: number;
  step: LearnStep;
  /** Whether the step says what it is about, or only shows it. */
  isExplained: boolean;
  skin: CubeSkin;
  triggers: readonly TriggerDefinition[];
  onOpen: (caseId: string, setId: string, group: string) => void;
}

function StepSection({ id, number, step, isExplained, skin, triggers, onOpen }: StepSectionProps) {
  const groups = useSetCases(step.setId);
  // Two steps keep their quicker version in another set altogether, so which
  // level is on show decides what is drawn.
  const advancedGroups = useSetCases(step.advanced?.setId ?? null);
  const [showAll, setShowAll] = useState(false);

  const isAdvanced = showAll && step.advanced !== null;
  const shown = isAdvanced
    ? casesOf(advancedGroups, step.advanced?.group ?? null, [])
    : casesOf(groups, step.group, step.caseIds);

  const setId = (isAdvanced ? step.advanced?.setId : step.setId) ?? step.setId;
  const group = (isAdvanced ? step.advanced?.group : step.group) ?? '';
  const diagram = diagramFor(setId, group);
  const only = shown.length === 1 ? shown[0] : undefined;

  // The cross has no case to look at and no algorithm to read; what it needs
  // is a picture of the thing being made.
  const isCross = step.setId === CROSS_SET_ID;
  const isLoading = groups === undefined || (step.advanced !== null && advancedGroups === undefined);

  return (
    <section id={id} className="learn__step">
      <h2 className="learn__title">
        <span className="learn__number" aria-hidden="true">
          {number}
        </span>
        {step.title}
      </h2>
      {isExplained ? <p className="learn__text">{step.text}</p> : null}

      {isCross ? (
        <figure className="learn__figure">
          <CubeDiagram
            className="learn__net"
            state={solvedState()}
            view="net"
            stickering="cross"
            skin={skin}
            label={null}
          />
          {isExplained ? (
            <figcaption className="learn__caption">{strings.learn.crossCaption}</figcaption>
          ) : null}
        </figure>
      ) : isLoading ? (
        <p className="learn__caption">{strings.learn.loading}</p>
      ) : (
        <>
          {/* One algorithm gets the width to be read at; a handful of them are
              a grid, the way the trainer lays cases out. */}
          {only === undefined ? (
            <div className="case-grid">
              {shown.map((entry) => (
                <CaseCard
                  key={entry.algCase.id}
                  entry={entry}
                  diagram={diagram}
                  skin={skin}
                  showAlg
                  triggers={triggers}
                  onOpen={() => onOpen(entry.algCase.id, setId, group)}
                />
              ))}
            </div>
          ) : (
            <KeyCase
              entry={only}
              diagram={diagram}
              skin={skin}
              triggers={triggers}
              onOpen={() => onOpen(only.algCase.id, setId, group)}
            />
          )}

          {isAdvanced ? null : (
            <>
              {step.keyText === null ? null : (
                <p className="learn__caption learn__caption--left">{step.keyText}</p>
              )}
              {step.holds.length === 0 ? null : (
                <div className="learn__holds">
                  {step.holds.map((hold) => (
                    <figure key={hold.alg} className="learn__hold">
                      <CubeDiagram
                        className="learn__hold-diagram"
                        state={holdState(hold)}
                        view={diagram.view}
                        stickering={diagram.stickering}
                        skin={skin}
                        label={null}
                      />
                      <figcaption className="learn__caption learn__caption--left">
                        {hold.text}
                      </figcaption>
                    </figure>
                  ))}
                </div>
              )}
            </>
          )}

          {/* Not a disclosure but a change of level: the step done the one way
              anybody can start with, or the step as somebody who wants it fast
              would learn it. */}
          {step.advanced === null ? null : (
            <button
              type="button"
              className="learn__more"
              aria-expanded={showAll}
              onClick={() => setShowAll((all) => !all)}
            >
              {showAll ? strings.learn.hideCases : strings.learn.showCases}
            </button>
          )}
        </>
      )}
    </section>
  );
}

/** The cases of one group, in the order the step asks for them. */
function casesOf(
  groups: CaseGroup[] | undefined,
  group: string | null,
  wanted: readonly string[],
): TrainerCase[] {
  const cases = (groups ?? [])
    .filter((candidate) => group === null || candidate.name === group)
    .flatMap((candidate) => candidate.cases);
  if (wanted.length === 0) return cases;
  return wanted.flatMap((id) => cases.filter((entry) => entry.algCase.id === id));
}

interface KeyCaseProps {
  entry: TrainerCase;
  diagram: Diagram;
  skin: CubeSkin;
  triggers: readonly TriggerDefinition[];
  onOpen: () => void;
}

/**
 * The one algorithm a step opens with, given the room that says so: its name
 * across the top, then the cube and the moves side by side, readable at arm's
 * length rather than at the size of a thumbnail in a grid of seven.
 */
function KeyCase({ entry, diagram, skin, triggers, onOpen }: KeyCaseProps) {
  const parsed = entry.algorithm ? parseAlg(entry.algorithm.moves) : null;

  return (
    <button type="button" className="case-card learn__key" onClick={onOpen}>
      <span className="case-card__name">{caseTitle(entry.algCase)}</span>
      <span className="learn__key-row">
        <CubeDiagram
          className="learn__key-diagram"
          state={entry.state}
          view={diagram.view}
          stickering={diagram.stickering}
          skin={skin}
          label={null}
        />
        {parsed?.ok ? <AlgText moves={parsed.moves} groups={parsed.groups} triggers={triggers} /> : null}
      </span>
    </button>
  );
}
