import { useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CubeDiagram } from '../../../components/CubeDiagram';
import { PreviousIcon } from '../../../components/Icons';
import { caseTitle } from '../../../domain/alg/case-name';
import { useBackToClose } from '../../../hooks/use-back-to-close';
import { useCubeSkin } from '../../../hooks/use-cube-skin';
import { useKeyCapture } from '../../../hooks/use-key-capture';
import { packLabel, strings } from '../../../lib/strings';
import { diagramFor } from '../case-view';
import { sheetPages } from '../cheat-sheet';
import { useCheatSheet, type SheetCase, type SheetSectionView } from '../hooks/use-cheat-sheet';
import { useSheetFit } from '../hooks/use-sheet-fit';
import { useTriggers } from '../hooks/use-triggers';
import { AlgText } from './AlgText';
import { CaseDetail, type CaseInSet } from './CaseDetail';

interface CheatSheetProps {
  onClose: () => void;
}

/**
 * Two-look OLL and PLL on a sheet of A4, to print and keep beside the cube.
 *
 * The preview is the sheet itself — the page as it will come out of the
 * printer, black on white whatever the theme — so there is nothing to compare
 * and nothing to set. What it prints is what the trainer has chosen: a tap on
 * a case opens the trainer's own sheet for it, and an algorithm picked there
 * is the one on paper and the one drilled.
 *
 * Over the whole screen and outside the app's tree, so that printing can
 * leave out everything that is not the paper (cheat-sheet.css).
 */
export function CheatSheet({ onClose }: CheatSheetProps) {
  const sections = useCheatSheet();
  const { definitions } = useTriggers();
  const skin = useCubeSkin();
  const [openCase, setOpenCase] = useState<(CaseInSet & { setId: string }) | null>(null);
  const frame = useRef<HTMLDivElement>(null);

  useBackToClose(onClose);
  // The case's own sheet takes Escape while it is up; one press, one panel.
  useKeyCapture(openCase === null, onClose);

  // Whatever changes how long the sheet runs: the algorithms, the names the
  // reader gave the cases, and which triggers break the lines.
  const contentKey = JSON.stringify([
    sections?.map(({ cases }) =>
      cases.map(({ entry, preAuf }) => [entry.algCase.label, entry.algorithm?.moves, preAuf]),
    ),
    definitions.map((definition) => definition.id),
  ]);
  const isSplit = useSheetFit(frame, contentKey);

  // Stepping in the case's sheet runs through the set the case is in.
  const ordered = useMemo(
    () =>
      openCase === null
        ? []
        : (sections ?? [])
            .filter(({ section }) => section.setId === openCase.setId)
            .flatMap(({ section, cases }) =>
              cases.map(({ entry }) => ({ id: entry.algCase.id, group: section.group })),
            ),
    [sections, openCase],
  );

  const pages = sheetPages(isSplit).map((page) =>
    page.flatMap((section) => sections?.filter((view) => view.section === section) ?? []),
  );

  const caseCard = ({ section }: SheetSectionView, { entry, moves, groups, preAuf }: SheetCase) => {
    return (
      <button
        key={entry.algCase.id}
        type="button"
        className="cheat-sheet__case"
        onClick={() => setOpenCase({ setId: section.setId, id: entry.algCase.id, group: section.group })}
      >
        <span className="cheat-sheet__name">{packLabel(caseTitle(entry.algCase))}</span>
        <CubeDiagram
          className="cheat-sheet__diagram"
          state={entry.state}
          view="lastLayer"
          stickering={section.stickering}
          skin={section.skin}
          label={null}
          // A picture still loading when the printer is asked prints as a hole.
          isEager
        />
        {/* Seen, not read out, as on a case card: the case's sheet reads it. */}
        {moves.length > 0 ? (
          <span className="cheat-sheet__alg" aria-hidden="true">
            {preAuf === null || preAuf === '' ? null : (
              <span className="cheat-sheet__auf">({preAuf})</span>
            )}
            <AlgText moves={moves} groups={groups} triggers={definitions} compact />
          </span>
        ) : null}
      </button>
    );
  };

  return createPortal(
    <div className="cheat-sheet" role="dialog" aria-modal="true" aria-label={strings.cheatSheet.label}>
      <div className="cheat-sheet__bar">
        <button type="button" onClick={onClose}>
          <PreviousIcon />
          {strings.cheatSheet.back}
        </button>
        <button type="button" className="is-primary" onClick={() => window.print()}>
          {strings.cheatSheet.print}
        </button>
      </div>

      <div className="cheat-sheet__frame" ref={frame}>
        {sections === undefined
          ? null
          : pages.map((page) => (
              <div key={page.map((view) => view.section.group).join()} className="cheat-sheet__slot">
                <article className="cheat-sheet__page">
                  <div className="cheat-sheet__content">
                    {page.map((view) => (
                      <section key={`${view.section.setId} ${view.section.group}`} className="cheat-sheet__section">
                        <h2 className="cheat-sheet__heading">
                          {packLabel(view.section.setName)} · {packLabel(view.section.group)}
                        </h2>
                        <div className="cheat-sheet__grid">
                          {view.cases.map((sheetCase) => caseCard(view, sheetCase))}
                        </div>
                      </section>
                    ))}
                  </div>
                </article>
              </div>
            ))}
      </div>

      {openCase === null ? null : (
        <CaseDetail
          caseId={openCase.id}
          ordered={ordered}
          onOpen={(next) => setOpenCase({ ...next, setId: openCase.setId })}
          {...diagramFor(openCase.setId, openCase.group)}
          skin={skin}
          triggers={definitions}
          onClose={() => setOpenCase(null)}
        />
      )}
    </div>,
    document.body,
  );
}
