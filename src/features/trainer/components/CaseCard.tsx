import { CubeDiagram } from '../../../components/CubeDiagram';
import { caseTitle } from '../../../domain/alg/case-name';
import { parseAlg } from '../../../domain/cube/notation';
import type { TriggerDefinition } from '../../../domain/alg/triggers';
import type { CubeSkin } from '../../../lib/cube-skins';
import type { Diagram } from '../case-view';
import type { TrainerCase } from '../hooks/use-alg-cases';
import { AlgText } from './AlgText';

interface CaseCardProps {
  entry: TrainerCase;
  diagram: Diagram;
  skin: CubeSkin;
  showAlg: boolean;
  triggers: readonly TriggerDefinition[];
  onOpen: () => void;
}

/** One case in a grid of them: the name, the cube, and how it is solved. */
export function CaseCard({ entry, diagram, skin, showAlg, triggers, onOpen }: CaseCardProps) {
  // Read top down, the same way the case sheet reads: which case this is, the
  // cube it is, and how it is solved.
  const parsed = showAlg && entry.algorithm ? parseAlg(entry.algorithm.moves) : null;

  return (
    <button type="button" className="case-card" onClick={onOpen}>
      <span className="case-card__name">{caseTitle(entry.algCase)}</span>
      <CubeDiagram
        className="case-card__diagram"
        state={entry.state}
        view={diagram.view}
        stickering={diagram.stickering}
        skin={skin}
        label={null}
      />
      {parsed?.ok ? <AlgText moves={parsed.moves} triggers={triggers} compact /> : null}
    </button>
  );
}
