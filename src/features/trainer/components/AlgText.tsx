import type { CSSProperties } from 'react';
import { formatAlg, type Move } from '../../../domain/cube/notation';
import { segmentAlg, type TriggerDefinition } from '../../../domain/alg/triggers';

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
      style={colourOf(segment.trigger)}
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

/** React's style type does not know about custom properties; this one does. */
interface TriggerStyle extends CSSProperties {
  '--trigger-colour'?: string;
}

/**
 * The trigger's own colour, handed to CSS as a variable so the label and the
 * background stay in step. Triggers written before colours existed fall back
 * to the app's accent.
 */
function colourOf(trigger: TriggerDefinition | null): TriggerStyle | undefined {
  if (!trigger?.colour) return undefined;
  return { '--trigger-colour': trigger.colour };
}
