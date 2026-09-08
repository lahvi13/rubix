import { useState } from 'react';
import { navigate } from '../../../app/router';
import { CubeDiagram } from '../../../components/CubeDiagram';
import { CROSS_SET_ID } from '../../../db/seed/packs';
import { caseTitle } from '../../../domain/alg/case-name';
import { parseAlg } from '../../../domain/cube/notation';
import type { TriggerDefinition } from '../../../domain/alg/triggers';
import { solvedState } from '../../../domain/cube/state';
import { useCubeSkin } from '../../../hooks/use-cube-skin';
import { useSetting } from '../../../hooks/use-setting';
import type { CubeSkin } from '../../../lib/cube-skins';
import { strings } from '../../../lib/strings';
import { AlgText, CaseCard, CaseDetail, diagramFor, useSetCases, useTriggers } from '../../trainer';
import type { TrainerCase } from '../../trainer';
import { LEARN_STEPS, type LearnStep } from '../steps';

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
    // The step, not the set it lives in: two of these steps are one half of a
    // two-look set, and drilling the other half is not what was asked for.
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
          onOpen={(id) => setOpenCase({ id, setId: step.setId, group: step.group ?? '' })}
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
  onOpen: (caseId: string) => void;
  onDrill: (setId: string, caseIds: readonly string[]) => void;
}

function StepSection({ number, step, skin, triggers, onOpen, onDrill }: StepSectionProps) {
  const groups = useSetCases(step.setId);
  const [showAll, setShowAll] = useState(false);
  const cases = (groups ?? [])
    .filter((group) => step.group === null || group.name === step.group)
    .flatMap((group) => group.cases);
  // The cross has no case to look at and no algorithm to read; what it needs
  // is a picture of the thing being made.
  const isCross = step.setId === CROSS_SET_ID;
  const keyCase =
    step.keyCaseId === null
      ? null
      : (cases.find((entry) => entry.algCase.id === step.keyCaseId) ?? null);
  const diagram = diagramFor(step.setId, step.group ?? '');

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
      ) : groups === undefined ? (
        <p className="learn__caption">{strings.learn.loading}</p>
      ) : (
        <>
          {keyCase === null || showAll ? null : (
            <>
              <KeyCase
                entry={keyCase}
                diagram={diagram}
                skin={skin}
                triggers={triggers}
                onOpen={() => onOpen(keyCase.algCase.id)}
              />
              <p className="learn__caption learn__caption--left">{strings.learn.keyHint}</p>
            </>
          )}

          {keyCase !== null && !showAll ? null : (
            <div className="case-grid">
              {cases.map((entry) => (
                <CaseCard
                  key={entry.algCase.id}
                  entry={entry}
                  diagram={diagram}
                  skin={skin}
                  showAlg
                  triggers={triggers}
                  onOpen={() => onOpen(entry.algCase.id)}
                />
              ))}
            </div>
          )}

          {/* Not a disclosure but a change of level: the step done the one way
              anybody can start with, or the step as somebody who wants it fast
              would learn it. */}
          {keyCase === null ? null : (
            <button
              type="button"
              className="learn__more"
              aria-expanded={showAll}
              onClick={() => setShowAll((shown) => !shown)}
            >
              {showAll ? strings.learn.hideCases : strings.learn.showCases}
            </button>
          )}
        </>
      )}

      <div className="learn__actions">
        <button
          type="button"
          onClick={() => onDrill(step.setId, cases.map((entry) => entry.algCase.id))}
        >
          {strings.learn.drillStep}
        </button>
      </div>
    </section>
  );
}

interface KeyCaseProps {
  entry: TrainerCase;
  diagram: ReturnType<typeof diagramFor>;
  skin: CubeSkin;
  triggers: readonly TriggerDefinition[];
  onOpen: () => void;
}

/**
 * The one algorithm a step can be got through with, given the room that says
 * so: wide, beside its cube, and readable at arm's length rather than at the
 * size of a thumbnail in a grid of seven.
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
