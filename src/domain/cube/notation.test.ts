import { describe, expect, it } from 'vitest';
import { formatAlg, parseAlg } from './notation';

function written(text: string): string | null {
  const parsed = parseAlg(text);
  return parsed.ok ? formatAlg(parsed.moves, parsed.groups) : null;
}

describe('parseAlg without spaces', () => {
  it.each<[string, string]>([
    ["RUR'U'", "R U R' U'"],
    ["RU2R'", "R U2 R'"],
    ["U2'R", "U2 R"],
    ["rUR'U'", "r U R' U'"],
    ["RwUR'", "r U R'"],
    ["yR'FRF'", "y R' F R F'"],
    ["MUM'", "M U M'"],
    ["(RUR'U)(RU'R')", "(R U R' U) (R U' R')"],
    ["R U R'U'", "R U R' U'"],
  ])('%s reads as %s', (text, expected) => {
    expect(written(text)).toBe(expected);
  });

  it.each(["RQR'", "R22", "R'2", 'w', "RU'w"])('refuses %s as a whole', (text) => {
    const parsed = parseAlg(text);

    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.token).toBe(text);
  });

  it('keeps each move as its own written text', () => {
    const parsed = parseAlg("RU'");

    expect(parsed.ok && parsed.moves.map((move) => move.text)).toEqual(['R', "U'"]);
  });
});
