import { Fragment } from 'react';
import { formatMove, type Move, type MoveGroup } from '../../../domain/cube/notation';
import { segmentAlg, type AlgSegment, type TriggerDefinition } from '../../../domain/alg/triggers';
import { triggerStyle } from './trigger-colour';

interface AlgTextProps {
  moves: readonly Move[];
  /**
   * The brackets the algorithm was written with. Where no trigger claims them
   * they are drawn as blocks of their own — unnamed, because nobody named
   * them, but the way the author held the algorithm all the same.
   */
  groups?: readonly MoveGroup[];
  triggers: readonly TriggerDefinition[];
  /** Called when the reader taps the algorithm — they want to see it run. */
  onPlay?: () => void;
  playLabel?: string;
  /**
   * Which move the cube is turning, while the algorithm is being played. The
   * reader is watching a cube and reading along; this is what keeps their
   * place.
   */
  playingMove?: number | null;
  /**
   * The list version: the blocks in their colours, without the names above
   * them. A case card is a thumb wide — there is no room for a word over every
   * trigger — and the colour is what the name was learned as.
   */
  compact?: boolean;
}

function partClass(segment: AlgSegment): string {
  if (segment.trigger) return 'alg__part alg__part--trigger';
  return segment.isGroup ? 'alg__part alg__part--group' : 'alg__part';
}

/**
 * An algorithm with its triggers named. Four symbols the eye already reads as
 * one move become one labelled block, which is how the algorithm is actually
 * remembered.
 */
export function AlgText({
  moves,
  groups,
  triggers,
  onPlay,
  playLabel,
  playingMove,
  compact = false,
}: AlgTextProps) {
  const segments = segmentAlg(moves, triggers, groups);

  // The player counts moves through the whole algorithm, so each segment has to
  // know how many came before it. A handful of segments; the sum is cheap.
  const startOf = (index: number): number =>
    segments.slice(0, index).reduce((count, segment) => count + segment.moves.length, 0);

  const content = segments.map((segment, index) => {
    const offset = startOf(index);

    return (
      <span
        key={`${index}-${segment.trigger?.id ?? 'loose'}`}
        className={partClass(segment)}
        style={triggerStyle(segment.trigger?.colour)}
      >
        {segment.trigger && !compact ? (
          <span className="alg__label">{segment.trigger.name}</span>
        ) : null}
        <span className="alg__moves">
          {segment.moves.map((move, position) => (
            <Fragment key={offset + position}>
              {position > 0 ? ' ' : null}
              <span
                className="alg__move"
                aria-current={offset + position === playingMove ? 'step' : undefined}
              >
                {formatMove(move)}
              </span>
            </Fragment>
          ))}
        </span>
      </span>
    );
  });

  const className = compact ? 'alg alg--compact' : 'alg';

  if (!onPlay) return <span className={className}>{content}</span>;

  return (
    <button type="button" className={`${className} alg--play`} onClick={onPlay} title={playLabel}>
      {content}
    </button>
  );
}
