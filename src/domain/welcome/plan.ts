/**
 * What the two questions a new install asks set the app up as. Pure: the
 * answer in, the settings and the screen to land on out — applying them is the
 * welcome hook's business.
 *
 * Somebody who cannot solve yet is learning, so they get the guide of the
 * method they picked and land in it. Somebody who can is getting faster: the
 * guide leaves the bar to make room for the drill, and they land in the
 * trainer on the short route through their method's last step — the two-look
 * OLL of CFOP, the two-look CMLL of Roux. ZZ has no sets in the trainer yet,
 * so a ZZ solver lands on the timer.
 */

import { CMLL_SET_ID } from '../alg/sets';

export const WELCOME_METHODS = ['cfop', 'roux', 'zz'] as const;
export type WelcomeMethod = (typeof WELCOME_METHODS)[number];

export type WelcomeAnswer =
  | { canSolve: false; method: WelcomeMethod }
  /** null: they solve, and do not know what to call how. */
  | { canSolve: true; method: WelcomeMethod | null };

export type WelcomeScreen = 'learn' | 'trainer' | 'timer';

export interface WelcomePlan {
  /** Whether the beginner's guide keeps its place on the bar. */
  showLearn: boolean;
  /** The guide that opens when the guide is opened. */
  guide: WelcomeMethod;
  /** The set the trainer opens on, on its two-look route; null leaves it be. */
  trainerSetId: string | null;
  /** The method the first session times phases by, while it is still empty. */
  sessionMethod: WelcomeMethod;
  screen: WelcomeScreen;
}

/** Where a solver of each method starts in the trainer; ZZ has nowhere yet. */
const TRAINER_SET: Readonly<Record<WelcomeMethod, string | null>> = {
  cfop: 'oll',
  roux: CMLL_SET_ID,
  zz: null,
};

export function welcomePlan(answer: WelcomeAnswer): WelcomePlan {
  // Not knowing the method's name is the most common answer of all, and the
  // one every tutorial out there teaches.
  const method = answer.method ?? 'cfop';
  if (!answer.canSolve) {
    return { showLearn: true, guide: method, trainerSetId: null, sessionMethod: method, screen: 'learn' };
  }
  const trainerSetId = TRAINER_SET[method];
  return {
    showLearn: false,
    guide: method,
    trainerSetId,
    sessionMethod: method,
    screen: trainerSetId === null ? 'timer' : 'trainer',
  };
}
