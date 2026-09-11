/**
 * The sequences worth seeing as one thing. An algorithm reads very differently
 * once `R U R' U'` is a word rather than four letters, which is the whole
 * point of highlighting them.
 *
 * Order matters: the longest match wins, so a trigger that contains another
 * one has to come first.
 *
 * One colour each, and no two of them the same: the colour is the only thing
 * telling two highlighted blocks apart inside one algorithm. The pair that
 * sits closest together in the palette is given to Sune and Anti-sune, which
 * are the two that can never turn up in the same algorithm.
 */

export interface PackTrigger {
  id: string;
  name: string;
  moves: string;
  colour: string;
}

export const TRIGGER_PACK: readonly PackTrigger[] = [
  { id: 'trigger-sune', name: 'Sune', moves: "R U R' U R U2 R'", colour: '#818cf8' },
  { id: 'trigger-antisune', name: 'Anti-sune', moves: "R U2 R' U' R U' R'", colour: '#c084fc' },
  { id: 'trigger-sexy', name: 'Sexy move', moves: "R U R' U'", colour: '#4ade80' },
  { id: 'trigger-sexy-left', name: 'Sexy move (left)', moves: "L' U' L U", colour: '#38bdf8' },
  { id: 'trigger-reverse-sexy', name: 'Reverse sexy', moves: "U R U' R'", colour: '#f0abfc' },
  { id: 'trigger-sledgehammer', name: 'Sledgehammer', moves: "R' F R F'", colour: '#fbbf24' },
  { id: 'trigger-hedgeslammer', name: 'Hedgeslammer', moves: "F R' F' R", colour: '#f87171' },
  { id: 'trigger-insert-right', name: 'Right insert', moves: "R U R'", colour: '#67e8f9' },
  { id: 'trigger-insert-left', name: 'Left insert', moves: "L' U' L", colour: '#f472b6' },
  { id: 'trigger-insert-front', name: 'Front insert', moves: "F' U' F", colour: '#fb923c' },
  // The two with a wide turn in place of the outer one. They are the same
  // shape in the hand and a different thing on the cube, so they are named
  // rather than left to read as a typo of the one above.
  { id: 'trigger-fat-sexy', name: 'Fat sexy', moves: "r U R' U'", colour: '#2dd4bf' },
  { id: 'trigger-fat-sledgehammer', name: 'Fat sledgehammer', moves: "r' F R F'", colour: '#a3e635' },
];

const PACK_TRIGGER_IDS = new Set(TRIGGER_PACK.map((trigger) => trigger.id));

/**
 * Whether this trigger shipped with the app.
 *
 * Asked of the id rather than of `source`, which says something else: editing
 * a built-in trigger makes it the reader's from then on, so that the app stops
 * updating it. That is about who owns the wording, not about where it came
 * from — and a built-in one that has been recoloured is still not theirs to
 * lose.
 */
export function isPackTrigger(id: string): boolean {
  return PACK_TRIGGER_IDS.has(id);
}
