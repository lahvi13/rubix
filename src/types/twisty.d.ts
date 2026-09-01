import type { DetailedHTMLProps, HTMLAttributes } from 'react';

/**
 * <twisty-player> is a custom element from cubing.js, so JSX needs to be told
 * it exists and which attributes it accepts.
 */
interface TwistyPlayerAttributes
  extends DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement> {
  alg?: string;
  puzzle?: string;
  visualization?: '2D' | '3D' | 'PG3D' | 'experimental-2D-LL';
  background?: 'none' | 'checkered';
  'control-panel'?: 'none' | 'auto';
  'hint-facelets'?: 'none' | 'floating';
  'experimental-setup-anchor'?: 'start' | 'end';
}

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'twisty-player': TwistyPlayerAttributes;
    }
  }
}
