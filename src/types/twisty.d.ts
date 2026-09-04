import type { DetailedHTMLProps, HTMLAttributes } from 'react';

/**
 * <twisty-player> is a custom element from cubing.js, so JSX needs to be told
 * it exists, which attributes it accepts, and which of its methods we call.
 */
export interface TwistyPlayerElement extends HTMLElement {
  play(): void;
  pause(): void;
  jumpToStart(options?: { flash?: boolean }): void;
  jumpToEnd(options?: { flash?: boolean }): void;
  /** The player's own state — only the part we listen to. */
  experimentalModel: {
    currentMoveInfo: {
      addFreshListener(listener: (info: TwistyCurrentMoveInfo) => void): void;
      removeFreshListener(listener: (info: TwistyCurrentMoveInfo) => void): void;
    };
  };
}

/**
 * What the player is animating right now. `patternIndex` counts the moves of
 * the algorithm, so it is also the index of the move on screen — but only
 * while something is actually turning, which is what `currentMoves` says.
 */
export interface TwistyCurrentMoveInfo {
  patternIndex: number;
  currentMoves: readonly unknown[];
}

interface TwistyPlayerAttributes
  extends DetailedHTMLProps<HTMLAttributes<TwistyPlayerElement>, TwistyPlayerElement> {
  alg?: string;
  puzzle?: string;
  visualization?: '2D' | '3D' | 'PG3D' | 'experimental-2D-LL';
  background?: 'none' | 'checkered';
  'control-panel'?: 'none' | 'auto';
  'hint-facelets'?: 'none' | 'floating';
  'experimental-setup-alg'?: string;
  'experimental-setup-anchor'?: 'start' | 'end';
  'experimental-stickering'?: string;
  'tempo-scale'?: number;
}

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'twisty-player': TwistyPlayerAttributes;
    }
  }
}
