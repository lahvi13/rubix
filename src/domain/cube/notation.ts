/**
 * Move notation: text in, moves out. Pure — no cube state here, only the
 * grammar (see the notation reference on the trainer screen).
 */

export const FACES = ['U', 'D', 'L', 'R', 'F', 'B'] as const;
export type Face = (typeof FACES)[number];

export const SLICES = ['M', 'E', 'S'] as const;
export type Slice = (typeof SLICES)[number];

export const ROTATIONS = ['x', 'y', 'z'] as const;
export type Rotation = (typeof ROTATIONS)[number];

/** Canonical family: outer face (`R`), wide (`Rw`), slice (`M`) or rotation (`x`). */
export type MoveFamily = Face | `${Face}w` | Slice | Rotation;

export interface Move {
  family: MoveFamily;
  /** Quarter turns clockwise: 1, 2 or -1. Never 0. */
  amount: number;
  /** How the move was written, so the UI can echo the user's own notation. */
  text: string;
}

const MOVE_PATTERN = /^([UDLRFB]w|[udlrfb]|[UDLRFB]|[MES]|[xyz])(\d*)('?)$/;

const WIDE_BY_LOWERCASE: Record<string, MoveFamily> = {
  u: 'Uw',
  d: 'Dw',
  l: 'Lw',
  r: 'Rw',
  f: 'Fw',
  b: 'Bw',
};

export type ParseResult =
  | { ok: true; moves: Move[] }
  | { ok: false; token: string; index: number };

/**
 * Splits on whitespace; parentheses are grouping only and are dropped, because
 * every published algorithm uses them for readability, not for repetition.
 */
export function parseAlg(text: string): ParseResult {
  const tokens = text
    .replace(/[()[\]]/g, ' ')
    .replace(/[’‘`´]/g, "'")
    .replace(/’/g, "'")
    .split(/\s+/)
    .filter((token) => token !== '');

  const moves: Move[] = [];
  for (const [index, token] of tokens.entries()) {
    const move = parseMove(token);
    if (move === null) return { ok: false, token, index };
    moves.push(move);
  }
  return { ok: true, moves };
}

export function parseMove(token: string): Move | null {
  const match = MOVE_PATTERN.exec(token);
  if (!match) return null;

  const [, rawFamily = '', digits = '', prime = ''] = match;
  const family = WIDE_BY_LOWERCASE[rawFamily] ?? (rawFamily as MoveFamily);

  const turns = digits === '' ? 1 : Number(digits);
  if (turns < 1 || turns > 3) return null;

  const amount = normaliseAmount(prime === "'" ? -turns : turns);
  if (amount === 0) return null;

  return { family, amount, text: token };
}

/** Quarter turns are always written as 1, 2 or -1 — never U3 or U2'. */
function normaliseAmount(amount: number): number {
  const wrapped = ((amount % 4) + 4) % 4;
  if (wrapped === 3) return -1;
  return wrapped === 0 ? 0 : wrapped;
}

export function formatMove(move: Move): string {
  if (move.amount === 2) return `${move.family}2`;
  return move.amount === -1 ? `${move.family}'` : move.family;
}

export function formatAlg(moves: readonly Move[]): string {
  return moves.map(formatMove).join(' ');
}

/** Reversed order, every turn the other way — the setup for a case. */
export function invertAlg(moves: readonly Move[]): Move[] {
  return [...moves].reverse().map((move) => {
    const amount = normaliseAmount(-move.amount);
    return { family: move.family, amount, text: formatMove({ ...move, amount }) };
  });
}

export function isSameMove(a: Move, b: Move): boolean {
  return a.family === b.family && a.amount === b.amount;
}

const RIGHT_SIDE: readonly MoveFamily[] = ['R', 'Rw'];
const LEFT_SIDE: readonly MoveFamily[] = ['L', 'Lw'];
const TOP: readonly MoveFamily[] = ['U', 'Uw'];

/**
 * True when the algorithm turns one side of the cube and the top, and nothing
 * else — the shape of algorithm whose mirror is a real left-handed version of
 * itself. Mirroring anything else just swaps awkward for awkward.
 */
export function isOneHanded(moves: readonly Move[]): boolean {
  const sides = moves.map((move) => move.family).filter((family) => !TOP.includes(family));
  if (sides.length === 0) return false;

  return (
    sides.every((family) => RIGHT_SIDE.includes(family)) ||
    sides.every((family) => LEFT_SIDE.includes(family))
  );
}

const MIRRORED_FAMILY: Partial<Record<MoveFamily, MoveFamily>> = {
  R: 'L',
  L: 'R',
  Rw: 'Lw',
  Lw: 'Rw',
};

/**
 * The same case seen in a mirror (left and right swapped). Every turn goes the
 * other way; moves on the mirror plane keep their family and only change
 * direction. Useful for left-handed variants and for the cases whose sibling
 * is just this one flipped over.
 */
export function mirrorAlg(moves: readonly Move[]): Move[] {
  return moves.map((move) => {
    const family = MIRRORED_FAMILY[move.family] ?? move.family;
    const amount = normaliseAmount(-move.amount);
    return { family, amount, text: formatMove({ family, amount, text: '' }) };
  });
}
