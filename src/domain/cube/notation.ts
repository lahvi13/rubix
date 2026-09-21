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

const MOVE_BODY = String.raw`([UDLRFB]w|[udlrfb]|[UDLRFB]|[MES]|[xyz])(\d*)('?)`;
const MOVE_PATTERN = new RegExp(`^${MOVE_BODY}$`);

const WIDE_BY_LOWERCASE: Record<string, MoveFamily> = {
  u: 'Uw',
  d: 'Dw',
  l: 'Lw',
  r: 'Rw',
  f: 'Fw',
  b: 'Bw',
};

/**
 * A bracket the algorithm was written with, as the moves it holds: `[start,
 * end)`, the way a slice is written.
 */
export type MoveGroup = readonly [start: number, end: number];

export type ParseResult =
  | { ok: true; moves: Move[]; groups: MoveGroup[] }
  | { ok: false; token: string; index: number };

/**
 * Splits on whitespace. Brackets are grouping rather than repetition — that is
 * what every published algorithm uses them for — and they are kept, because
 * the grouping is half of how an algorithm is remembered: `(R U R' U) (R U2
 * R')` is two things to hold in the hand, not seven moves to recite.
 *
 * A bracket that never closes, or one that closes having never opened, is
 * simply not a group; the moves inside it still parse. Nothing about the cube
 * depends on them, so there is nothing to refuse.
 */
export function parseAlg(text: string): ParseResult {
  const tokens = text
    .replace(/[()[\]]/g, (bracket) => ` ${bracket} `)
    .replace(/[’‘`´]/g, "'")
    .split(/\s+/)
    .filter((token) => token !== '');

  const moves: Move[] = [];
  const groups: MoveGroup[] = [];
  const open: number[] = [];

  for (const [index, token] of tokens.entries()) {
    if (token === '(' || token === '[') {
      open.push(moves.length);
      continue;
    }
    if (token === ')' || token === ']') {
      const start = open.pop();
      // A group of nothing is not a group; nor is a stray closing bracket.
      if (start !== undefined && moves.length > start) groups.push([start, moves.length]);
      continue;
    }

    const move = parseMove(token);
    if (move !== null) {
      moves.push(move);
      continue;
    }
    const run = splitRun(token);
    if (run === null) return { ok: false, token, index };
    moves.push(...run);
  }

  return { ok: true, moves, groups };
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

/**
 * `RUR'U'`, typed on a phone where the space bar is one more reach per move.
 * Every move starts with a letter and ends before the next one, so the run
 * cuts one way only — `Rw` is a wide turn because `w` is never a move itself.
 * All of it has to be moves; one letter that is not, and so is the whole run.
 */
function splitRun(token: string): Move[] | null {
  const moves: Move[] = [];
  const pattern = new RegExp(MOVE_BODY, 'y');
  let match: RegExpExecArray | null;
  while (pattern.lastIndex < token.length && (match = pattern.exec(token)) !== null) {
    const move = parseMove(match[0]);
    if (move === null) return null;
    moves.push(move);
  }
  return pattern.lastIndex === token.length && moves.length > 0 ? moves : null;
}

/** Quarter turns are always written as 1, 2 or -1 — never U3 or U2'. */
function normaliseAmount(amount: number): number {
  const wrapped = ((amount % 4) + 4) % 4;
  if (wrapped === 3) return -1;
  return wrapped === 0 ? 0 : wrapped;
}

/**
 * `Rw` and `r` are the same turn, and published algorithms mix both. Written
 * out, only one spelling may win, or the same algorithm reads as two — the
 * short one, because that is what the packs are typed in.
 */
const SHORT_BY_WIDE: Partial<Record<MoveFamily, string>> = {
  Uw: 'u',
  Dw: 'd',
  Lw: 'l',
  Rw: 'r',
  Fw: 'f',
  Bw: 'b',
};

export function formatMove(move: Move): string {
  const family = SHORT_BY_WIDE[move.family] ?? move.family;
  if (move.amount === 2) return `${family}2`;
  return move.amount === -1 ? `${family}'` : family;
}

/**
 * Written out, with the brackets it was written with. Only groups that sit
 * inside the moves are drawn, and nesting is left alone rather than reproduced
 * — one bracket around a bracket helps nobody read anything.
 */
export function formatAlg(moves: readonly Move[], groups: readonly MoveGroup[] = []): string {
  const opens = new Set<number>();
  const closes = new Set<number>();
  for (const [start, end] of groups) {
    if (start < 0 || end > moves.length || end <= start) continue;
    if (opens.has(start) || closes.has(end)) continue;
    opens.add(start);
    closes.add(end);
  }

  const out: string[] = [];
  moves.forEach((move, index) => {
    const text = formatMove(move);
    out.push(opens.has(index) ? `(${text}` : text);
    if (closes.has(index + 1)) out[out.length - 1] += ')';
  });
  return out.join(' ');
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
