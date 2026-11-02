import { goalOf, verifyAlg, type Auf, type CaseGoal } from '../../../domain/alg/verify';
import { formatAlg, formatMove, parseAlg, type Move, type MoveGroup } from '../../../domain/cube/notation';
import type { CubeState } from '../../../domain/cube/state';
import type { CubeOrder, Stickering } from '../../../domain/cube/views';
import type { DiagramView } from '../../../components/CubeDiagram';
import { useSetting } from '../../../hooks/use-setting';
import { skinById, type CubeSkin } from '../../../lib/cube-skins';
import { diagramFor } from '../case-view';
import { paperLook, TWO_LOOK_SECTIONS, TWO_LOOK_SHEET, type SheetKind, type SheetSection } from '../cheat-sheet';
import { useSetCases, type CaseGroup, type TrainerCase } from './use-alg-cases';

export interface SheetCase {
  entry: TrainerCase;
  /** The algorithm as printed, after the turn in brackets; empty when there is none. */
  moves: Move[];
  groups: MoveGroup[];
  /**
   * The turn of the top layer to make first, printed in brackets in front of
   * the algorithm. Null when the algorithm does not solve the case at all —
   * kept before the check existed — and there is no turn to say.
   */
  preAuf: Auf | null;
}

export interface SheetSectionView {
  section: SheetSection;
  /** How its cases are drawn: on paper, or in the trainer's own colours. */
  look: { view: DiagramView; stickering: Stickering; skin: CubeSkin; order: CubeOrder };
  cases: SheetCase[];
}

/**
 * A sheet as it prints, each case with the algorithm the trainer has chosen
 * for it. Nothing is chosen here: the sheet is a view of the trainer, and a
 * different algorithm on paper is chosen there.
 *
 * In colour the cases look as they do on the trainer's cards, in the reader's
 * skin as a light page draws it — paper is white whatever the theme.
 */
export function useCheatSheet(kind: SheetKind, isColour: boolean): SheetSectionView[] | undefined {
  const isTwoLook = kind === TWO_LOOK_SHEET;
  const first = useSetCases(isTwoLook ? '2look-oll' : kind);
  const second = useSetCases(isTwoLook ? '2look-pll' : null);
  const [skinId] = useSetting('ui.cubeSkin');
  if (first === undefined || second === undefined) return undefined;

  const sections: { section: SheetSection; groups: CaseGroup[] }[] = isTwoLook
    ? TWO_LOOK_SECTIONS.map((section) => ({
        section,
        groups: section.setId === '2look-oll' ? first : second,
      }))
    : first.map((group) => ({
        section: { setId: kind, group: group.name, heading: [group.name] },
        groups: first,
      }));
  const paper = skinById(skinId, 'light');

  return sections.map(({ section, groups }) => {
    const goal = goalOf(section.setId, section.group);
    const cases = groups.find((group) => group.name === section.group)?.cases ?? [];
    const { view, stickering, order } = diagramFor(section.setId, section.group);
    return {
      section,
      look: isColour
        ? { view, stickering, skin: paper, order }
        : { view: 'lastLayer', order, ...paperLook(section.setId, section.group) },
      cases: cases.map((entry) => ({
        entry,
        ...printed(entry.state, entry.algorithm?.moves ?? null, goal, view === 'lastLayer'),
      })),
    };
  });
}

/**
 * The algorithm split the way the sheet prints it: on a last-layer case, a
 * turn of the top layer it opens with goes in brackets in front — `(U) L' U2
 * L …` — because it is not part of what the hands learn but the way the case
 * is picked up. Only a turn that really is that: the rest has to solve the
 * case from the turned side. Lower down a U turn is part of the algorithm —
 * it is what sets an F2L pair up — and stays where it is written.
 */
function printed(
  state: CubeState,
  alg: string | null,
  goal: CaseGoal | null,
  isLastLayer: boolean,
): Omit<SheetCase, 'entry'> {
  const parsed = alg === null ? null : parseAlg(alg);
  if (!parsed?.ok) return { moves: [], groups: [], preAuf: null };

  const whole = { moves: parsed.moves, groups: parsed.groups };
  if (goal === null) return { ...whole, preAuf: null };

  const [first, ...rest] = parsed.moves;
  if (isLastLayer && first?.family === 'U' && rest.length > 0) {
    const turn = formatMove(first);
    const verdict = verifyAlg(state, formatAlg(rest), goal);
    if (verdict.ok && verdict.preAuf === turn) {
      const groups = parsed.groups
        .map(([start, end]): MoveGroup => [Math.max(start - 1, 0), end - 1])
        .filter(([start, end]) => end > start);
      return { moves: rest, groups, preAuf: verdict.preAuf };
    }
  }
  const verdict = verifyAlg(state, formatAlg(parsed.moves), goal);
  return { ...whole, preAuf: verdict.ok ? verdict.preAuf : null };
}
