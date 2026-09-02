/**
 * The sequences worth seeing as one thing. An algorithm reads very differently
 * once `R U R' U'` is a word rather than four letters, which is the whole
 * point of highlighting them.
 *
 * Order matters: the longest match wins, so a trigger that contains another
 * one has to come first.
 */

export interface PackTrigger {
  id: string;
  name: string;
  moves: string;
}

export const TRIGGER_PACK: readonly PackTrigger[] = [
  { id: 'trigger-sune', name: 'Sune', moves: "R U R' U R U2 R'" },
  { id: 'trigger-antisune', name: 'Anti-sune', moves: "R U2 R' U' R U' R'" },
  { id: 'trigger-sexy', name: 'Sexy move', moves: "R U R' U'" },
  { id: 'trigger-sexy-left', name: 'Sexy move (left)', moves: "L' U' L U" },
  { id: 'trigger-reverse-sexy', name: 'Reverse sexy', moves: "U R U' R'" },
  { id: 'trigger-sledgehammer', name: 'Sledgehammer', moves: "R' F R F'" },
  { id: 'trigger-hedgeslammer', name: 'Hedgeslammer', moves: "F R' F' R" },
  { id: 'trigger-insert-right', name: 'Right insert', moves: "R U R'" },
  { id: 'trigger-insert-left', name: 'Left insert', moves: "L' U' L" },
  { id: 'trigger-insert-front', name: 'Front insert', moves: "F' U' F" },
];
