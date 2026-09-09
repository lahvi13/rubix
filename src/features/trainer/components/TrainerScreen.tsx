import { useMemo, useState } from 'react';
import { strings } from '../../../lib/strings';
import { BEGINNER_SET_ID, CROSS_SET_ID, FULL_SETS, TWO_LOOK_SETS } from '../../../db/seed/packs';
import { navigate } from '../../../app/router';
import { diagramFor } from '../case-view';
import { useAlgSets, useSetCases, type CaseGroup } from '../hooks/use-alg-cases';
import { useCubeSkin } from '../../../hooks/use-cube-skin';
import { useSetting } from '../../../hooks/use-setting';
import { useTriggers } from '../hooks/use-triggers';
import { CaseCard } from './CaseCard';
import { CaseDetail } from './CaseDetail';
import { NotationReference } from './NotationReference';
import { SetSummary } from './SetSummary';
import { TriggerPanel } from './TriggerPanel';

type Panel = 'none' | 'notation' | 'triggers';

export function TrainerScreen() {
  const sets = useAlgSets();
  // Two-look sets hang off their full set rather than standing beside it, and
  // the cross is a set only in the sense that it can be drilled — there is no
  // case to look at and no algorithm to read. The beginner set is left out for
  // a different reason: it belongs to a walk through one solve, and offering
  // it here beside F2L would read as a choice between two ways of doing the
  // same step, which is not what it is.
  const fullSets = (sets ?? []).filter(
    (set) =>
      !Object.hasOwn(FULL_SETS, set.id) &&
      set.id !== CROSS_SET_ID &&
      set.id !== BEGINNER_SET_ID,
  );
  const [chosenSetId, setChosenSetId] = useState<string | null>(null);
  const [, setDrillSetId] = useSetting('trainer.drillSetId');
  const [twoLookDefault] = useSetting('trainer.twoLookDefault');
  const [showAlgs] = useSetting('trainer.showAlgs');
  const [chosenLook, setChosenLook] = useState<boolean | null>(null);
  const isTwoLook = chosenLook ?? twoLookDefault;

  const baseSetId = chosenSetId ?? fullSets[0]?.id ?? null;
  const twoLookId = baseSetId === null ? undefined : TWO_LOOK_SETS[baseSetId];
  const setId = isTwoLook && twoLookId !== undefined ? twoLookId : baseSetId;

  const fullGroups = useSetCases(baseSetId);
  const twoLookGroups = useSetCases(twoLookId ?? null);
  const groups = isTwoLook && twoLookId !== undefined ? twoLookGroups : fullGroups;
  // Nothing has answered yet is not the same as there is nothing to show.
  const isLoading = sets === undefined || groups === undefined;
  const skin = useCubeSkin();
  const { definitions } = useTriggers();
  const [openCase, setOpenCase] = useState<{ id: string; group: string } | null>(null);
  // A set is what gets studied, so stepping runs across its groups rather
  // than stopping at the end of one.
  const ordered = useMemo(
    () =>
      (groups ?? []).flatMap((group) =>
        group.cases.map((entry) => ({ id: entry.algCase.id, group: group.name })),
      ),
    [groups],
  );
  const [panel, setPanel] = useState<Panel>('none');

  const countOf = (list: CaseGroup[] | undefined): number =>
    (list ?? []).reduce((count, group) => count + group.cases.length, 0);

  return (
    <main className="screen screen--scroll">
      <div className="trainer__sets">
        {fullSets.map((set) => (
          <button
            key={set.id}
            type="button"
            className={set.id === baseSetId ? 'is-active' : ''}
            onClick={() => {
              setChosenSetId(set.id);
              // Back to whatever the settings say; the set button is not a
              // vote on how to solve the last layer.
              setChosenLook(null);
              setOpenCase(null);
            }}
          >
            {set.name}
          </button>
        ))}
        <span className="trainer__spacer" />
        {/* The drill opens on whatever is being looked at, two-look included. */}
        <button
          type="button"
          disabled={setId === null}
          onClick={() => {
            if (setId !== null) setDrillSetId(setId);
            navigate('drill');
          }}
        >
          {strings.trainer.drillSet}
        </button>
        <button
          type="button"
          className={panel === 'notation' ? 'is-active' : ''}
          onClick={() => setPanel((current) => (current === 'notation' ? 'none' : 'notation'))}
        >
          {strings.trainer.notation}
        </button>
        <button
          type="button"
          className={panel === 'triggers' ? 'is-active' : ''}
          onClick={() => setPanel((current) => (current === 'triggers' ? 'none' : 'triggers'))}
        >
          {strings.trainer.triggers}
        </button>
      </div>

      {twoLookId !== undefined ? (
        <div className="trainer__looks">
          <button
            type="button"
            className={isTwoLook ? 'is-active' : ''}
            onClick={() => {
              setChosenLook(true);
              setOpenCase(null);
            }}
          >
            {strings.trainer.twoLook} <span>{countOf(twoLookGroups)}</span>
          </button>
          <button
            type="button"
            className={isTwoLook ? '' : 'is-active'}
            onClick={() => {
              setChosenLook(false);
              setOpenCase(null);
            }}
          >
            {strings.trainer.fullSet} <span>{countOf(fullGroups)}</span>
          </button>
        </div>
      ) : null}

      <SetSummary groups={groups} onOpen={(id, group) => setOpenCase({ id, group })} />

      {panel === 'notation' ? <NotationReference skin={skin} /> : null}
      {panel === 'triggers' ? <TriggerPanel /> : null}

      {isLoading ? <p className="data-section__hint">{strings.trainer.loading}</p> : null}
      {!isLoading && groups.length === 0 ? (
        <p className="data-section__hint">{strings.trainer.empty}</p>
      ) : null}

      {(groups ?? []).map((group) => (
        <section key={group.name} className="trainer__group">
          <h2 className="trainer__group-title">{group.name}</h2>
          <div className="case-grid">
            {group.cases.map((entry) => (
              <CaseCard
                key={entry.algCase.id}
                entry={entry}
                diagram={diagramFor(setId ?? '', group.name)}
                skin={skin}
                showAlg={showAlgs}
                triggers={definitions}
                onOpen={() => setOpenCase({ id: entry.algCase.id, group: group.name })}
              />
            ))}
          </div>
        </section>
      ))}

      {openCase !== null ? (
        <CaseDetail
          caseId={openCase.id}
          ordered={ordered}
          onOpen={setOpenCase}
          {...diagramFor(setId ?? '', openCase.group)}
          skin={skin}
          triggers={definitions}
          onClose={() => setOpenCase(null)}
        />
      ) : null}
    </main>
  );
}
