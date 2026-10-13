import { describe, expect, it } from 'vitest';
import { phaseColour, phaseFace, phaseFillColour, phaseInkColour } from './phase-colours';

const CFOP = ['cross', 'f2l', 'oll', 'pll'];
const ROUX = ['fb', 'sb', 'cmll', 'lse'];
const ZZ = ['eocross', 'f2l', 'll'];

const facesOf = (phases: readonly string[]) => phases.map((_, index) => phaseFace(phases, index));

describe('the colour of a phase', () => {
  it('runs from the white face to the yellow one by position', () => {
    // The skins hold the cube yellow up, so white is the bottom face.
    expect(facesOf(CFOP)).toEqual(['D', 'F', 'L', 'U']);
  });

  it('gives a method it has never heard of a face per phase, the ends as ever', () => {
    const phases = ['one', 'two', 'three', 'four', 'five', 'six'];

    expect(facesOf(phases)).toEqual(['D', 'F', 'L', 'R', 'B', 'U']);
    expect(new Set(facesOf(phases)).size).toBe(6);
  });

  it("colours Roux's first block blue, and leaves the rest where they stand", () => {
    // Blue is the back face of a cube held yellow up and green in front.
    expect(facesOf(ROUX)).toEqual(['B', 'F', 'L', 'U']);
  });

  it("colours ZZ's EOCross orange, and its pairs and last layer as CFOP's", () => {
    expect(facesOf(ZZ)).toEqual(['R', 'F', 'U']);
    expect(phaseFace(ZZ, 1)).toBe(phaseFace(CFOP, 1));
    expect(phaseFace(ZZ, 2)).toBe(phaseFace(CFOP, 3));
  });

  it('opens every method on a colour of its own, and repeats none within one', () => {
    const first = [CFOP, ROUX, ZZ].map((phases) => phaseFace(phases, 0));

    expect(new Set(first).size).toBe(3);
    for (const phases of [CFOP, ROUX, ZZ]) expect(new Set(facesOf(phases)).size).toBe(phases.length);
  });

  it('reads a phase by its key whether handed keys or the phases themselves', () => {
    const phases = ROUX.map((key, order) => ({ key, label: key.toUpperCase(), order }));

    expect(ROUX.map((_, index) => phaseColour(phases, index))).toEqual(
      ROUX.map((_, index) => phaseColour(ROUX, index)),
    );
  });

  it('hands out the ink, the fill and the lettering of the same face', () => {
    expect(phaseColour(ROUX, 0)).toBe('var(--phase-mid-4)');
    expect(phaseFillColour(ROUX, 0)).toBe('var(--phase-fill-mid-4)');
    expect(phaseInkColour(ROUX, 0)).toBe('var(--phase-ink-mid-4)');
  });

  it('treats a phase it cannot find as the first, rather than leave a hole in the bar', () => {
    expect(phaseColour(CFOP, -1)).toBe('var(--phase-first)');
  });

  it('does not take a key for a colour because an object happens to have it', () => {
    expect(phaseFace(['constructor', 'toString', 'valueOf'], 1)).toBe('F');
  });
});
