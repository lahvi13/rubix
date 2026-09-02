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
  colour: string;
}

export const TRIGGER_PACK: readonly PackTrigger[] = [
  { id: 'trigger-sune', name: 'Sune', moves: "R U R' U R U2 R'", colour: '#e879f9' },
  { id: 'trigger-antisune', name: 'Anti-sune', moves: "R U2 R' U' R U' R'", colour: '#22d3ee' },
  { id: 'trigger-sexy', name: 'Sexy move', moves: "R U R' U'", colour: '#4ade80' },
  { id: 'trigger-sexy-left', name: 'Sexy move (left)', moves: "L' U' L U", colour: '#60a5fa' },
  { id: 'trigger-reverse-sexy', name: 'Reverse sexy', moves: "U R U' R'", colour: '#a78bfa' },
  { id: 'trigger-sledgehammer', name: 'Sledgehammer', moves: "R' F R F'", colour: '#fbbf24' },
  { id: 'trigger-hedgeslammer', name: 'Hedgeslammer', moves: "F R' F' R", colour: '#f97316' },
  { id: 'trigger-insert-right', name: 'Right insert', moves: "R U R'", colour: '#38bdf8' },
  { id: 'trigger-insert-left', name: 'Left insert', moves: "L' U' L", colour: '#c084fc' },
  { id: 'trigger-insert-front', name: 'Front insert', moves: "F' U' F", colour: '#f472b6' },
];
