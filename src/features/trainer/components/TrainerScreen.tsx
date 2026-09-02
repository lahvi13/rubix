import { useState } from 'react';
import { CubeDiagram, type DiagramView } from '../../../components/CubeDiagram';
import type { Stickering } from '../../../domain/cube/views';
import { strings } from '../../../lib/strings';
import { useAlgSets, useSetCases, type TrainerCase } from '../hooks/use-alg-cases';
import { useCubeSkin } from '../hooks/use-cube-skin';
import { useTriggers } from '../hooks/use-triggers';
import { CaseDetail } from './CaseDetail';
import { NotationReference } from './NotationReference';
import { TriggerPanel } from './TriggerPanel';

type Panel = 'none' | 'notation' | 'triggers';

/** How each set is best looked at. */
function diagramFor(setId: string): { view: DiagramView; stickering: Stickering } {
  if (setId === 'oll') return { view: 'lastLayer', stickering: 'orientation' };
  if (setId === 'f2l') return { view: 'isometric', stickering: 'pair' };
  return { view: 'lastLayer', stickering: 'full' };
}

export function TrainerScreen() {
  const sets = useAlgSets();
  const [chosenSetId, setChosenSetId] = useState<string | null>(null);
  const setId = chosenSetId ?? sets[0]?.id ?? null;

  const groups = useSetCases(setId);
  const skin = useCubeSkin();
  const { definitions } = useTriggers();
  const [openCaseId, setOpenCaseId] = useState<string | null>(null);
  const [panel, setPanel] = useState<Panel>('none');

  const { view, stickering } = diagramFor(setId ?? '');

  return (
    <main className="screen screen--scroll">
      <div className="trainer__sets">
        {sets.map((set) => (
          <button
            key={set.id}
            type="button"
            className={set.id === setId ? 'is-active' : ''}
            onClick={() => {
              setChosenSetId(set.id);
              setOpenCaseId(null);
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

      {panel === 'notation' ? <NotationReference skin={skin} /> : null}
      {panel === 'triggers' ? <TriggerPanel /> : null}

      {groups.length === 0 ? <p className="data-section__hint">{strings.trainer.empty}</p> : null}

      {groups.map((group) => (
        <section key={group.name} className="trainer__group">
          <h2 className="trainer__group-title">{group.name}</h2>
          <div className="case-grid">
            {group.cases.map((entry) => (
              <CaseCard
                key={entry.algCase.id}
                entry={entry}
                view={view}
                stickering={stickering}
                skin={skin}
                onOpen={() => setOpenCaseId(entry.algCase.id)}
              />
            ))}
          </div>
        </section>
      ))}

      {openCaseId !== null ? (
        <>
          <button
            type="button"
            className="app__scrim"
            aria-label={strings.history.close}
            onClick={() => setOpenCaseId(null)}
          />
          <CaseDetail
            caseId={openCaseId}
            view={view}
            stickering={stickering}
            skin={skin}
            triggers={definitions}
            onClose={() => setOpenCaseId(null)}
          />
        </>
      ) : null}
    </main>
  );
}

interface CaseCardProps {
  entry: TrainerCase;
  view: DiagramView;
  stickering: Stickering;
  skin: ReturnType<typeof useCubeSkin>;
  onOpen: () => void;
}

function CaseCard({ entry, view, stickering, skin, onOpen }: CaseCardProps) {
  return (
    <button type="button" className="case-card" onClick={onOpen}>
      <CubeDiagram
        className="case-card__diagram"
        state={entry.state}
        view={view}
        stickering={stickering}
        skin={skin}
        label={null}
      />
      <span className="case-card__name">{entry.algCase.name}</span>
    </button>
  );
}
