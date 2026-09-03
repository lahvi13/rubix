import { useState } from 'react';
import { CubeDiagram, type DiagramView } from '../../../components/CubeDiagram';
import type { Stickering } from '../../../domain/cube/views';
import { strings } from '../../../lib/strings';
import { FULL_SETS, TWO_LOOK_SETS } from '../../../db/seed/packs';
import { useAlgSets, useSetCases, type CaseGroup, type TrainerCase } from '../hooks/use-alg-cases';
import { useCubeSkin } from '../../../hooks/use-cube-skin';
import { useSetting } from '../../../hooks/use-setting';
import { useTriggers } from '../hooks/use-triggers';
import { CaseDetail } from './CaseDetail';
import { NotationReference } from './NotationReference';
import { TriggerPanel } from './TriggerPanel';

type Panel = 'none' | 'notation' | 'triggers';

interface Diagram {
  view: DiagramView;
  stickering: Stickering;
  /** What the animated player should dim, in cubing.js's own terms. */
  playerStickering: string;
}

/**
 * How each set is best looked at. Two-look sets differ per step: the first
 * look at OLL is about edges only, and the first look at PLL is about where
 * the corners go — showing everything would hide the one thing being read.
 */
function diagramFor(setId: string, group: string): Diagram {
  if (setId === '2look-oll') {
    return {
      view: 'lastLayer',
      stickering: group.includes('Edges') ? 'edgeOrientation' : 'orientation',
      playerStickering: 'OLL',
    };
  }
  if (setId === '2look-pll') {
    return {
      view: 'lastLayer',
      stickering: group.includes('Corners') ? 'corners' : 'edges',
      playerStickering: 'PLL',
    };
  }
  if (setId === 'oll') {
    return {
      view: 'lastLayer',
      stickering: 'orientation',
      playerStickering: 'OLL',
    };
  }
  if (setId === 'f2l') {
    return { view: 'isometric', stickering: 'pair', playerStickering: 'F2L' };
  }
  return { view: 'lastLayer', stickering: 'full', playerStickering: 'PLL' };
}

export function TrainerScreen() {
  const sets = useAlgSets();
  // Two-look sets hang off their full set rather than standing beside it.
  const fullSets = (sets ?? []).filter((set) => !Object.hasOwn(FULL_SETS, set.id));
  const [chosenSetId, setChosenSetId] = useState<string | null>(null);
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
                onOpen={() => setOpenCase({ id: entry.algCase.id, group: group.name })}
              />
            ))}
          </div>
        </section>
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
            caseId={openCase.id}
            {...diagramFor(setId ?? '', openCase.group)}
            skin={skin}
            triggers={definitions}
            onClose={() => setOpenCase(null)}
          />
        </>
      ) : null}
    </main>
  );
}

interface CaseCardProps {
  entry: TrainerCase;
  diagram: Diagram;
  skin: ReturnType<typeof useCubeSkin>;
  showAlg: boolean;
  onOpen: () => void;
}

function CaseCard({ entry, diagram, skin, showAlg, onOpen }: CaseCardProps) {
  return (
    <button type="button" className="case-card" onClick={onOpen}>
      <CubeDiagram
        className="case-card__diagram"
        state={entry.state}
        view={diagram.view}
        stickering={diagram.stickering}
        skin={skin}
        label={null}
      />
      <span className="case-card__name">{entry.algCase.name}</span>
      {showAlg && entry.algorithm ? (
        <span className="case-card__alg">{entry.algorithm.moves}</span>
      ) : null}
    </button>
  );
}
