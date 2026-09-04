import type { CSSProperties } from 'react';

/** React's style type does not know about custom properties; this one does. */
export interface TriggerStyle extends CSSProperties {
  '--trigger-colour'?: string;
}

/**
 * A trigger's own colour, handed to CSS as a variable rather than set as a
 * colour outright. The stylesheet is then free to darken it for the light
 * theme — these are palette colours picked to glow on a dark background — and
 * to keep a label and the block behind it in step.
 */
export function triggerStyle(colour: string | null | undefined): TriggerStyle | undefined {
  if (!colour) return undefined;
  return { '--trigger-colour': colour };
}
