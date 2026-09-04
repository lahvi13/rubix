import { formatAlg, type Move } from '../../../domain/cube/notation';
import { segmentAlg, type TriggerDefinition } from '../../../domain/alg/triggers';
import { triggerStyle } from './trigger-colour';

interface AlgTextProps {
  moves: readonly Move[];
  triggers: readonly TriggerDefinition[];
  /** Called when the reader taps the algorithm — they want to see it run. */
  onPlay?: () => void;
  playLabel?: string;
}

/**
 * An algorithm with its triggers named. Four symbols the eye already reads as
 * one move become one labelled block, which is how the algorithm is actually
 * remembered.
 */
export function AlgText({ moves, triggers, onPlay, playLabel }: AlgTextProps) {
  const segments = segmentAlg(moves, triggers);

  const content = segments.map((segment, index) => (
    <span
      key={`${index}-${segment.trigger?.id ?? 'loose'}`}
      className={segment.trigger ? 'alg__part alg__part--trigger' : 'alg__part'}
      style={triggerStyle(segment.trigger?.colour)}
    >
      {segment.trigger ? <span className="alg__label">{segment.trigger.name}</span> : null}
      <span className="alg__moves">{formatAlg(segment.moves)}</span>
    </span>
  ));

  if (!onPlay) return <span className="alg">{content}</span>;

  return (
    <button type="button" className="alg alg--play" onClick={onPlay} title={playLabel}>
      {content}
    </button>
  );
}
