import type { DetailedHTMLProps, HTMLAttributes } from 'react';
import type { StickeringMask } from '../lib/twisty-stickering';

/**
 * <twisty-player> is a custom element from cubing.js, so JSX needs to be told
 * it exists, which attributes it accepts, and which of its methods we call.
 */
export interface TwistyPlayerElement extends HTMLElement {
  play(): void;
  pause(): void;
  jumpToStart(options?: { flash?: boolean }): void;
  jumpToEnd(options?: { flash?: boolean }): void;
  /**
   * A stickering worked out by us rather than named — see
   * lib/twisty-stickering.ts for why the names do not fit. Despite the name,
   * it takes the whole mask, orbits and all.
   */
  experimentalStickeringMaskOrbits: StickeringMask;
  /**
   * The three.js object of the cube being drawn, once there is one. Left as
   * unknown on purpose: lib/twisty-skin.ts checks what it gets before using it.
   */
  experimentalCurrentThreeJSPuzzleObject(): Promise<unknown>;
  /** The player's own state — only the part we listen to. */
  experimentalModel: {
    currentMoveInfo: TwistyProp<TwistyCurrentMoveInfo>;
    playingInfo: TwistyProp<{ playing: boolean }>;
  };
}

/**
 * What the player is animating right now. `patternIndex` counts the moves of
 * the algorithm, so it is also the index of the move on screen — but only
 * while something is actually turning, which is what `currentMoves` says.
 */
/** One value of the player's state, as something to subscribe to. */
export interface TwistyProp<T> {
  addFreshListener(listener: (value: T) => void): void;
  removeFreshListener(listener: (value: T) => void): void;
}

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
  /** Where the camera stands, in degrees; see lib/twisty-camera.ts. */
  'camera-latitude'?: number;
  'camera-longitude'?: number;
}

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'twisty-player': TwistyPlayerAttributes;
    }
  }
}
