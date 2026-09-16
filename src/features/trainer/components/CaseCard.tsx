import { CubeDiagram } from '../../../components/CubeDiagram';
import { caseTitle } from '../../../domain/alg/case-name';
import { parseAlg } from '../../../domain/cube/notation';
import type { TriggerDefinition } from '../../../domain/alg/triggers';
import type { CubeSkin } from '../../../lib/cube-skins';
import { packLabel, strings } from '../../../lib/strings';
import type { Diagram } from '../case-view';
import type { TrainerCase } from '../hooks/use-alg-cases';
import { AlgText } from './AlgText';

interface CaseCardProps {
  entry: TrainerCase;
  diagram: Diagram;
  skin: CubeSkin;
  showAlg: boolean;
  /**
   * Whether to say what the reader has done to this case: their own algorithm
   * on it, or one that costs a slot. Off where the cards are not the reader's
   * own collection to keep — the guide walks cases, it does not curate them.
   */
  showMarks?: boolean;
  triggers: readonly TriggerDefinition[];
  onOpen: () => void;
}

/** One case in a grid of them: the name, the cube, and how it is solved. */
export function CaseCard({
  entry,
  diagram,
  skin,
  showAlg,
  showMarks = false,
  triggers,
  onOpen,
}: CaseCardProps) {
  // Read top down, the same way the case sheet reads: which case this is, the
  // cube it is, and how it is solved.
  const parsed = showAlg && entry.algorithm ? parseAlg(entry.algorithm.moves) : null;
  const marks = !showMarks
    ? []
    : [
        entry.isOwnAlgorithm ? { kind: 'own', label: strings.trainer.markOwn } : null,
        entry.costsASlot ? { kind: 'slot', label: strings.trainer.markCostsSlot } : null,
      ].filter((mark) => mark !== null);

  return (
    <button type="button" className="case-card" onClick={onOpen}>
      <span className="case-card__name">{packLabel(caseTitle(entry.algCase))}</span>
      {/*
        A dot rather than a word: a card is the width of a thumb and the name
        already has it. What it means is one tap away — the sheet the card
        opens says it in words, beside the algorithm it is about — so the dot
        only has to be worth looking at, not self-explanatory. The label is
        read out, after the name and with a space between, so the card is
        called "F2L 7 breaks another slot" rather than one run-on word. It sits
        here rather than above for that reason alone; it is drawn in the corner
        either way.
      */}
      {marks.length === 0 ? null : (
        <>
          {' '}
          <span className="case-card__marks">
            {marks.map((mark) => (
              <span key={mark.kind} className={`case-card__mark is-${mark.kind}`}>
                <span className="visually-hidden">{mark.label}</span>
              </span>
            ))}
          </span>
        </>
      )}
      <CubeDiagram
        className="case-card__diagram"
        state={entry.state}
        view={diagram.view}
        stickering={diagram.stickering}
        skin={skin}
        label={null}
      />
      {parsed?.ok ? <AlgText moves={parsed.moves} groups={parsed.groups} triggers={triggers} compact /> : null}
    </button>
  );
}
