import { useRef, useState } from 'react';
import { CubeDiagram, type MarkedCorner } from '../../../components/CubeDiagram';
import { CROSS_SET_ID } from '../../../domain/alg/sets';
import { caseTitle } from '../../../domain/alg/case-name';
import type { TriggerDefinition } from '../../../domain/alg/triggers';
import { parseAlg } from '../../../domain/cube/notation';
import type { CubeOrder } from '../../../domain/cube/views';
import { CUBE_ORDER } from '../../../domain/puzzle/puzzles';
import { useCubeSkin } from '../../../hooks/use-cube-skin';
import { useLastGuide, useShowLearn } from '../../../hooks/use-guide-settings';
import { usePuzzle } from '../../../hooks/use-puzzle';
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
import { useActiveMethodId, useMethodList } from '../hooks/use-guide-method';
import {
  GUIDES,
  POCKET_LAYERS_GUIDE_ID,
  POCKET_ORTEGA_GUIDE_ID,
  PUZZLE_GUIDES,
  figureState,
  holdState,
  situationPicture,
  wayOut,
  type LearnSituation,
  type LearnStep,
  type SituationPicture,
} from '../steps';
import { SituationSheet } from './SituationSheet';

const anchorOf = (step: LearnStep) => `learn-${step.id}`;
/** What a guide that is no method is called; a method's guide goes by the method's name. */
const GUIDE_NAMES: Readonly<Record<string, string>> = strings.learn.guideNames;

/** What a guide says round its steps: how it opens, where it comes from, what follows it. */
interface GuideCopy {
  intro: string;
  source: string;
  sourceLink: string;
  href: string;
  /**
   * What comes after the guide: the trainer's sets for the method and the
   * phases its sessions are timed in — or, for a cube's first guide, a line
   * on where to go once it is known by heart.
   */
  next:
    | {
        lead: string;
        sets: readonly { name: string; text: string }[];
        more: string;
        hide: string;
      }
    | string;
}

const CFOP_COPY: GuideCopy = {
  intro: strings.learn.intro,
  source: strings.learn.source,
  sourceLink: strings.learn.sourceLink,
  href: 'http://badmephisto.com',
  next: strings.learn.hideHint,
};

const GUIDE_COPY: Readonly<Record<string, GuideCopy>> = {
  cfop: CFOP_COPY,
  roux: {
    intro: strings.learn.rouxIntro,
    source: strings.learn.rouxSource,
    sourceLink: strings.learn.rouxSourceLink,
    href: 'https://sites.google.com/view/kianroux/',
    next: strings.learn.rouxNext,
  },
  zz: {
    intro: strings.learn.zzIntro,
    source: strings.learn.zzSource,
    sourceLink: strings.learn.zzSourceLink,
    href: 'https://www.zzmethod.com/',
    next: strings.learn.zzNext,
  },
  [POCKET_LAYERS_GUIDE_ID]: {
    intro: strings.learn.pocket.intro,
    source: strings.learn.pocket.source,
    sourceLink: strings.learn.pocket.sourceLink,
    href: 'https://jperm.net/2x2',
    next: strings.learn.pocket.hideHint,
  },
  [POCKET_ORTEGA_GUIDE_ID]: {
    intro: strings.learn.ortega.intro,
    source: strings.learn.ortega.source,
    sourceLink: strings.learn.ortega.sourceLink,
    href: 'https://jperm.net/2x2/faster',
    next: strings.learn.ortega.hideHint,
  },
};

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
  // The guide is the cube's: its guides, its pictures, and its own switch for
  // whether it is on the menu at all.
  const [puzzle] = usePuzzle();
  const order = CUBE_ORDER[puzzle];
  const guideIds = PUZZLE_GUIDES[puzzle];
  const fallback = guideIds[0] ?? '';
  const [showLearn, setShowLearn] = useShowLearn(puzzle);
  const [isExplained, setExplained] = useSetting('ui.learnExplanations');
  // The guide read last. Until one has been picked, the one for the method
  // being timed in: somebody who made a Roux session wants Roux explained.
  // Not the session's every time — a method is learned from here long before
  // it is timed, and the page kept going back to the one already known.
  const activeMethodId = useActiveMethodId();
  const methods = useMethodList();
  const [lastMethodId, setLastMethodId] = useLastGuide(puzzle);
  const wanted = lastMethodId !== '' ? lastMethodId : (activeMethodId ?? fallback);
  const methodId = guideIds.includes(wanted) ? wanted : fallback;
  const copy = GUIDE_COPY[methodId] ?? CFOP_COPY;
  const nameOf = (id: string) =>
    methods?.find((method) => method.id === id)?.name ?? GUIDE_NAMES[id] ?? id;

  return (
    <main className="screen screen--scroll learn">
      {/* A choice of one is no choice: the row comes with the second guide. */}
      {guideIds.length < 2 ? null : (
        <div className="learn__methods" role="group" aria-label={strings.learn.method}>
          {guideIds.map((id) => (
            <button
              key={id}
              type="button"
              className={id === methodId ? 'is-active' : ''}
              aria-pressed={id === methodId}
              onClick={() => setLastMethodId(id)}
            >
              {nameOf(id)}
            </button>
          ))}
        </div>
      )}

      {isExplained ? (
        <p className="learn__intro">{copy.intro}</p>
      ) : null}

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

      {showNotation ? <NotationReference skin={skin} order={order} /> : null}

      {/* Keyed by the method: the other guide is a different page, and the
          step being read is worked out afresh for it. */}
      <GuideSteps
        key={methodId}
        steps={GUIDES[methodId] ?? []}
        isExplained={isExplained}
        skin={skin}
        order={order}
        triggers={definitions}
        onOpen={(id, setId, group) => setOpenCase({ id, setId, group })}
      />

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
        {!isExplained ? null : typeof copy.next === 'string' ? (
          <p className="learn__caption learn__caption--left">{copy.next}</p>
        ) : (
          <>
            <p className="learn__caption learn__caption--left">{copy.next.lead}</p>
            <ul className="learn__sets">
              {copy.next.sets.map((set) => (
                <li key={set.name}>
                  <strong>{set.name}</strong> — {set.text}
                </li>
              ))}
            </ul>
            <p className="learn__caption">{copy.next.more}</p>
            <p className="learn__caption learn__caption--left">{copy.next.hide}</p>
          </>
        )}
      </div>

      <p className="learn__credit">
        {copy.source}{' '}
        <a href={copy.href} target="_blank" rel="noopener noreferrer">
          {copy.sourceLink}
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

interface GuideStepsProps {
  steps: readonly LearnStep[];
  isExplained: boolean;
  skin: CubeSkin;
  order: CubeOrder;
  triggers: readonly TriggerDefinition[];
  onOpen: (caseId: string, setId: string, group: string) => void;
}

/** One method's steps, with the row of numbers that jumps between them. */
function GuideSteps({ steps, isExplained, skin, order, triggers, onOpen }: GuideStepsProps) {
  const nav = useRef<HTMLElement>(null);
  const [read, jumpTo] = useCurrentStep(steps.map(anchorOf), nav);
  // Above the first step is still the first step: the guide starts at its top.
  const current = Math.max(read, 0);

  return (
    <>
      {/* Numbers, not names: seven names do not fit across a phone, and the
          numbers are the ones every step is headed with. */}
      <nav ref={nav} className="learn__nav" aria-label={strings.learn.stepsNav}>
        {steps.map((step, index) => (
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

      {steps.map((step, index) => (
        <StepSection
          key={step.id}
          id={anchorOf(step)}
          number={index + 1}
          step={step}
          isExplained={isExplained}
          skin={skin}
          order={order}
          triggers={triggers}
          onOpen={onOpen}
        />
      ))}
    </>
  );
}

interface StepSectionProps {
  id: string;
  number: number;
  step: LearnStep;
  /** Whether the step says what it is about, or only shows it. */
  isExplained: boolean;
  skin: CubeSkin;
  /** 2 on the 2×2, whose every picture is the corners of the state drawn. */
  order: CubeOrder;
  triggers: readonly TriggerDefinition[];
  onOpen: (caseId: string, setId: string, group: string) => void;
}

function StepSection({
  id,
  number,
  step,
  isExplained,
  skin,
  order,
  triggers,
  onOpen,
}: StepSectionProps) {
  const groups = useSetCases(step.setId);
  // Two steps keep their quicker version in another set altogether, so which
  // level is on show decides what is drawn.
  const advancedGroups = useSetCases(step.advanced?.setId ?? null);
  const [showAll, setShowAll] = useState(false);
  const [showMore, setShowMore] = useState(false);

  const isAdvanced = showAll && step.advanced !== null;
  const shown = isAdvanced
    ? casesOf(advancedGroups, step.advanced?.group ?? null, [])
    : casesOf(groups, step.group, step.caseIds);

  const setId = (isAdvanced ? step.advanced?.setId : step.setId) ?? step.setId ?? '';
  const group = (isAdvanced ? step.advanced?.group : step.group) ?? '';
  const diagram = diagramFor(setId, group);
  const picture = situationPicture(step);

  // The cross has no case of its own in any set; what it needs is a picture
  // of the thing being made, and of where its pieces start. Roux's second
  // block and its last edges are taught the same way, from situations alone.
  const isCross = step.setId === CROSS_SET_ID;
  const hasCases = step.setId !== null && !isCross;
  const isLoading = groups === undefined || (step.advanced !== null && advancedGroups === undefined);

  const cards = (list: readonly LearnSituation[]) => (
    <div className="learn__situations">
      {list.map((situation) => (
        <Situation
          key={wayOut(situation)}
          situation={situation}
          picture={picture}
          skin={skin}
          order={order}
          triggers={triggers}
        />
      ))}
    </div>
  );
  const situations = step.situations.length === 0 ? null : cards(step.situations);

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

      {/* What to look for, as pictures: the cube beside the one line that
          says what it shows. Kept with the explanations folded — the line is
          the rule, not a comment on it. */}
      {step.rules === undefined ? null : (
        <div className="learn__rules">
          {step.rules.map((rule) => (
            <figure key={rule.text} className="learn__rule">
              <CubeDiagram
                className="learn__rule-diagram"
                state={holdState({ alg: '', text: '' }, rule.standing)}
                view={rule.view}
                stickering={rule.stickering}
                skin={skin}
                order={order}
                label={null}
              />
              <figcaption className="learn__rule-text">{rule.text}</figcaption>
            </figure>
          ))}
        </div>
      )}

      {/* The rules' example, straight under them: the cube to try them on,
          the moves that make that cube, and the same cube with the answer. */}
      {step.figures?.map((figure) => (
        <figure key={figure.caption} className="learn__figure">
          <CubeDiagram
            className={figure.picture.view === 'net' ? 'learn__net' : 'learn__goal'}
            state={figureState(figure)}
            view={figure.picture.view}
            stickering={figure.picture.stickering}
            skin={skin}
            order={order}
            label={null}
          />
          {figure.isSetupShown ? (
            <AlgText moves={movesOf(figure.setup)} triggers={triggers} />
          ) : null}
          {isExplained ? <figcaption className="learn__caption">{figure.caption}</figcaption> : null}
        </figure>
      ))}

      {/* A step with a case of its own opens on that case, and its situations
          are the ways to it: they go under it, further down. */}
      {hasCases ? null : situations}

      {/* The long way round, for whoever wants it: the step is its first
          pictures, and these are how to reach them from anywhere. */}
      {step.more === undefined ? null : (
        <div className="learn__ways">
          <button
            type="button"
            className="learn__more"
            aria-expanded={showMore}
            onClick={() => setShowMore((shown) => !shown)}
          >
            {showMore ? step.more.hide : step.more.show}
          </button>
          {!showMore ? null : (
            <>
              {isExplained ? (
                <p className="learn__caption learn__caption--left">{step.more.lead}</p>
              ) : null}
              {cards(step.more.situations)}
            </>
          )}
        </div>
      )}

      {/* The goal last: what the moves above add up to. */}
      {step.goal === undefined ? null : (
        <figure className="learn__figure">
          <CubeDiagram
            className={step.goal.picture.view === 'net' ? 'learn__net' : 'learn__goal'}
            state={holdState({ alg: '', text: '' }, step.goal.picture.standing)}
            view={step.goal.picture.view}
            stickering={step.goal.picture.stickering}
            skin={skin}
            order={order}
            label={null}
          />
          {isExplained ? (
            <figcaption className="learn__caption">{step.goal.caption}</figcaption>
          ) : null}
        </figure>
      )}

      {!hasCases ? null : isLoading ? (
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
                order={order}
                mark={isAdvanced ? null : step.markedCorner}
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
                        // Stood like the case above it, or the same cube would
                        // wear other colours two pictures down.
                        state={holdState(hold, diagram.orientation)}
                        view={diagram.view}
                        stickering={diagram.stickering}
                        skin={skin}
                        order={order}
                        mark={step.markedCorner}
                        label={null}
                      />
                      <figcaption className="learn__caption learn__caption--left">
                        {hold.text}
                      </figcaption>
                    </figure>
                  ))}
                </div>
              )}
              {situations}
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
  picture: SituationPicture;
  skin: CubeSkin;
  order: CubeOrder;
  triggers: readonly TriggerDefinition[];
}

/**
 * Where a piece can be, and the moves that take it home — a cross edge, a
 * Roux pair, the last edges: a card like every case on the page, which opens
 * its own sheet to play them.
 */
function Situation({ situation, picture, skin, order, triggers }: SituationProps) {
  const [isOpen, setOpen] = useState(false);

  const card = (
    <>
      <span className="case-card__name">{situation.text}</span>
      <span className="learn__case-row">
        <CubeDiagram
          className="learn__case-diagram"
          state={holdState(situation, picture.standing)}
          view={picture.view}
          stickering={picture.stickering}
          skin={skin}
          order={order}
          label={null}
        />
        <AlgText moves={movesOf(situation.shown ?? situation.alg)} triggers={triggers} />
      </span>
    </>
  );

  // The cube that plays a situation is cubing.js's 3×3. A 2×2's card is the
  // picture and the moves and opens nothing: played on that cube it would be
  // another puzzle in other colours.
  if (order !== 3) return <div className="case-card learn__case learn__case--still">{card}</div>;

  return (
    <>
      <button type="button" className="case-card learn__case" onClick={() => setOpen(true)}>
        {card}
      </button>
      {isOpen ? (
        <SituationSheet
          situation={situation}
          picture={picture}
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
  order: CubeOrder;
  mark: MarkedCorner | null;
  triggers: readonly TriggerDefinition[];
  onOpen: () => void;
}

/**
 * A case as the guide shows it: its name across the top, then the cube and
 * the moves side by side, readable at arm's length rather than at the size of
 * a thumbnail.
 */
function LearnCase({ entry, diagram, skin, order, mark, triggers, onOpen }: LearnCaseProps) {
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
          order={order}
          mark={mark}
          label={null}
        />
        {parsed?.ok ? (
          <AlgText moves={parsed.moves} groups={parsed.groups} triggers={triggers} caseName={name} />
        ) : null}
      </span>
    </button>
  );
}
