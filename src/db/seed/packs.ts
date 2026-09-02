/**
 * The built-in algorithm packs. Static data, bundled with the app — a trainer
 * that needs the network to tell you what a T perm is would be useless on a
 * plane, which is where it gets used.
 */

import oll from './oll.json';
import f2l from './f2l.json';
import pll from './pll.json';

export interface PackCase {
  id: string;
  name: string;
  group: string | null;
  /** The algorithm that solves the case, in standard notation. */
  alg: string;
  /**
   * State the case starts from. Left out for every case whose setup is simply
   * the algorithm undone, which is nearly all of them.
   */
  setup?: string;
}

export interface AlgPack {
  packVersion: number;
  set: { id: string; name: string };
  cases: PackCase[];
}

/** Every pack is a 3x3x3 CFOP set; nothing else exists yet. */
export const PACK_PUZZLE = '333';
export const PACK_METHOD_ID = 'cfop';

export const PACKS: readonly AlgPack[] = [pll, oll, f2l];
