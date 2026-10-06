import { useRef, useState } from 'react';
import { CubeDiagram } from '../../../components/CubeDiagram';
import { CROSS_SET_ID } from '../../../domain/alg/sets';
import { caseTitle } from '../../../domain/alg/case-name';
import type { TriggerDefinition } from '../../../domain/alg/triggers';
import { parseAlg } from '../../../domain/cube/notation';
import { solvedState } from '../../../domain/cube/state';
import { useCubeSkin } from '../../../hooks/use-cube-skin';
import { useSetting } from '../../../hooks/use-setting';
import type { CubeSkin } from '../../../lib/cube-skins';
import { packLabel, strings } from '../../../lib/strings';
import {
  AlgText,
  CaseDetail,
  NotationReference,
  diagramFor,
  useSetCases,
  useTriggers,
  type CaseGroup,
  type Diagram,
  type TrainerCase,
} from '../../trainer';
import { useCurrentStep } from '../../../hooks/use-current-step';
import { LEARN_STEPS, holdState, type LearnSituation, type LearnStep } from '../steps';
import { SituationSheet } from './SituationSheet';

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
  const [read, jumpTo] = useCurrentStep(STEP_IDS, nav);
  // Above the first step is still the first step: the guide starts at its top.
  const current = Math.max(read, 0);

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

  // The cross has no case of its own in any set; what it needs is a picture
  // of the thing being made, and of where its pieces start.
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
      {/* Short lines to act on, not prose: the reader has a cube in both hands
          and looks up for the next move, not the next paragraph. */}
      {isExplained ? (
        <ul className="learn__points">
          {step.points.map((point) => (
            <li key={point}>{point}</li>
          ))}
          {step.warning === undefined ? null : (
            <li className="learn__aside">
              <strong>{strings.learn.warning}</strong> {step.warning}
            </li>
          )}
          {step.tip === undefined ? null : (
            <li className="learn__aside">
              <strong>{strings.learn.tip}</strong> {step.tip}
            </li>
          )}
        </ul>
      ) : null}

      {step.situations.length === 0 ? null : (
        <div className="learn__situations">
          {step.situations.map((situation) => (
            <Situation key={situation.alg} situation={situation} skin={skin} triggers={triggers} />
          ))}
        </div>
      )}

      {/* The goal last: what the moves above add up to. */}
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
      ) : null}

      {isCross ? null : isLoading ? (
        <p className="learn__caption">{strings.learn.loading}</p>
      ) : (
        <>
          {/* One shape for every case on the page, one or seven: the cube
              beside the moves, at a size read with a cube in both hands. A
              grid of thumbnails beside a step of wide cards made the guide
              change scale halfway through, and a thumbnail broke an algorithm
              of eight moves over three lines. */}
          <div className="learn__cases">
            {shown.map((entry) => (
              <LearnCase
                key={entry.algCase.id}
                entry={entry}
                diagram={diagram}
                skin={skin}
                triggers={triggers}
                onOpen={() => onOpen(entry.algCase.id, setId, group)}
              />
            ))}
          </div>

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

interface SituationProps {
  situation: LearnSituation;
  skin: CubeSkin;
  triggers: readonly TriggerDefinition[];
}

/**
 * Where a cross edge can be, and the moves that take it down: a card like
 * every case on the page, which opens its own sheet to play them.
 */
function Situation({ situation, skin, triggers }: SituationProps) {
  const [isOpen, setOpen] = useState(false);

  return (
    <>
      <button type="button" className="case-card learn__case" onClick={() => setOpen(true)}>
        <span className="case-card__name">{situation.text}</span>
        <span className="learn__case-row">
          <CubeDiagram
            className="learn__case-diagram"
            state={holdState(situation)}
            view="isometric"
            stickering="cross"
            skin={skin}
            label={null}
          />
          <AlgText moves={movesOf(situation.alg)} triggers={triggers} />
        </span>
      </button>
      {isOpen ? (
        <SituationSheet
          situation={situation}
          skin={skin}
          triggers={triggers}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}

function movesOf(alg: string) {
  const parsed = parseAlg(alg);
  return parsed.ok ? parsed.moves : [];
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

interface LearnCaseProps {
  entry: TrainerCase;
  diagram: Diagram;
  skin: CubeSkin;
  triggers: readonly TriggerDefinition[];
  onOpen: () => void;
}

/**
 * A case as the guide shows it: its name across the top, then the cube and
 * the moves side by side, readable at arm's length rather than at the size of
 * a thumbnail.
 */
function LearnCase({ entry, diagram, skin, triggers, onOpen }: LearnCaseProps) {
  const parsed = entry.algorithm ? parseAlg(entry.algorithm.moves) : null;
  const name = packLabel(caseTitle(entry.algCase));

  return (
    <button type="button" className="case-card learn__case" onClick={onOpen}>
      <span className="case-card__name">{name}</span>
      <span className="learn__case-row">
        <CubeDiagram
          className="learn__case-diagram"
          state={entry.state}
          view={diagram.view}
          stickering={diagram.stickering}
          skin={skin}
          label={null}
        />
        {parsed?.ok ? (
          <AlgText moves={parsed.moves} groups={parsed.groups} triggers={triggers} caseName={name} />
        ) : null}
      </span>
    </button>
  );
}
