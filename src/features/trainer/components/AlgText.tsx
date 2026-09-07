import { Fragment } from 'react';
import { formatMove, type Move } from '../../../domain/cube/notation';
import { segmentAlg, type TriggerDefinition } from '../../../domain/alg/triggers';
import { triggerStyle } from './trigger-colour';

interface AlgTextProps {
  moves: readonly Move[];
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

/**
 * An algorithm with its triggers named. Four symbols the eye already reads as
 * one move become one labelled block, which is how the algorithm is actually
 * remembered.
 */
export function AlgText({
  moves,
  triggers,
  onPlay,
  playLabel,
  playingMove,
  compact = false,
}: AlgTextProps) {
  const segments = segmentAlg(moves, triggers);

  // The player counts moves through the whole algorithm, so each segment has to
  // know how many came before it. A handful of segments; the sum is cheap.
  const startOf = (index: number): number =>
    segments.slice(0, index).reduce((count, segment) => count + segment.moves.length, 0);

  const content = segments.map((segment, index) => {
    const offset = startOf(index);

    return (
      <span
        key={`${index}-${segment.trigger?.id ?? 'loose'}`}
        className={segment.trigger ? 'alg__part alg__part--trigger' : 'alg__part'}
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
