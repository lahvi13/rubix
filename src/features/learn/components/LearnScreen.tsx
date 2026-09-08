import { useState } from 'react';
import { navigate } from '../../../app/router';
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
  diagramFor,
  useSetCases,
  useTriggers,
  type CaseGroup,
  type Diagram,
  type TrainerCase,
} from '../../trainer';
import { LEARN_STEPS, holdState, type LearnStep } from '../steps';

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
 * a real set, drawn by the same code as the trainer draws it, playable, and
 * drillable a step at a time. A printed cheat sheet cannot be practised, and
 * practising is the part that teaches the cube.
 */
export function LearnScreen() {
  const skin = useCubeSkin();
  const { definitions } = useTriggers();
  const [openCase, setOpenCase] = useState<OpenCase | null>(null);
  const [, setDrillSetId] = useSetting('trainer.drillSetId');
  const [, setDrillCaseIds] = useSetting('trainer.drillCaseIds');

  const drill = (setId: string, caseIds: readonly string[]): void => {
    setDrillSetId(setId);
    // The step, not the set it lives in: a step is often a handful of cases out
    // of a set that holds more, and drilling the rest is not what was asked for.
    setDrillCaseIds(caseIds);
    navigate('drill');
  };

  return (
    <main className="screen screen--scroll learn">
      <p className="learn__intro">{strings.learn.intro}</p>

      {LEARN_STEPS.map((step, index) => (
        <StepSection
          key={step.id}
          number={index + 1}
          step={step}
          skin={skin}
          triggers={definitions}
          onOpen={(id, setId, group) => setOpenCase({ id, setId, group })}
          onDrill={drill}
        />
      ))}

      {openCase !== null ? (
        <>
          <button
            type="button"
            className="app__scrim"
            aria-label={strings.history.close}
            onClick={() => setOpenCase(null)}
          />
          <CaseDetail
            key={openCase.id}
            caseId={openCase.id}
            {...diagramFor(openCase.setId, openCase.group)}
            skin={skin}
            triggers={definitions}
            onClose={() => setOpenCase(null)}
          />
        </>
      ) : null}
    </main>
  );
}

interface StepSectionProps {
  number: number;
  step: LearnStep;
  skin: CubeSkin;
  triggers: readonly TriggerDefinition[];
  onOpen: (caseId: string, setId: string, group: string) => void;
  onDrill: (setId: string, caseIds: readonly string[]) => void;
}

function StepSection({ number, step, skin, triggers, onOpen, onDrill }: StepSectionProps) {
  const groups = useSetCases(step.setId);
  // Two steps keep their quicker version in another set altogether, so which
  // level is on show decides both what is drawn and what gets drilled.
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
    <section className="learn__step">
      <h2 className="learn__title">
        <span className="learn__number" aria-hidden="true">
          {number}
        </span>
        {step.title}
      </h2>
      <p className="learn__text">{step.text}</p>

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
          <figcaption className="learn__caption">{strings.learn.crossCaption}</figcaption>
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

      <div className="learn__actions">
        <button
          type="button"
          onClick={() => onDrill(setId, shown.map((entry) => entry.algCase.id))}
        >
          {strings.learn.drillStep}
        </button>
      </div>
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
 * The one algorithm a step opens with, given the room that says so: wide,
 * beside its cube, and readable at arm's length rather than at the size of a
 * thumbnail in a grid of seven.
 */
function KeyCase({ entry, diagram, skin, triggers, onOpen }: KeyCaseProps) {
  const parsed = entry.algorithm ? parseAlg(entry.algorithm.moves) : null;

  return (
    <button type="button" className="case-card learn__key" onClick={onOpen}>
      <CubeDiagram
        className="learn__key-diagram"
        state={entry.state}
        view={diagram.view}
        stickering={diagram.stickering}
        skin={skin}
        label={null}
      />
      <span className="learn__key-body">
        <span className="case-card__name">{caseTitle(entry.algCase)}</span>
        {parsed?.ok ? <AlgText moves={parsed.moves} triggers={triggers} /> : null}
      </span>
    </button>
  );
}
