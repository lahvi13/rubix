import { describe, expect, it } from 'vitest';
import { diagramFor } from './case-view';
import { parseAlg } from '../../domain/cube/notation';
import { applyAlg, solvedState } from '../../domain/cube/state';
import { isometricView } from '../../domain/cube/views';

/** The cube a card draws, built the way `useSetCases` builds it. */
function stateFor(setId: string, group: string, setupAlg: string) {
  const { orientation } = diagramFor(setId, group);
  const parsed = parseAlg(`${orientation} ${setupAlg}`);
  if (!parsed.ok) throw new Error(`unparsed setup: ${orientation} ${setupAlg}`);
  return applyAlg(solvedState(), parsed.moves);
}

describe('diagramFor', () => {
  it('stands an F2L cube with the red face in front and the green one right', () => {
    const view = isometricView(stateFor('f2l', 'Cross colour on top', ''), 'firstTwoLayers');

    // Centres cannot move, so they say which way the cube is turned: on a
    // solved cube stood green in front, red is the left face.
    expect(view.front[4]).toBe('L');
    expect(view.right[4]).toBe('F');
  });

  it('leaves the case itself where it was, and only repaints it', () => {
    const setup = "R U R' U'";
    const turned = isometricView(stateFor('f2l', 'Cross colour on top', setup), 'firstTwoLayers');
    const plain = isometricView(stateFor('pll', '', setup), 'firstTwoLayers');

    // Which stickers are dimmed is the shape of the case. The rotation goes in
    // front of the setup, so the pair stays in the slot it was built in and
    // only the colours around it change.
    const mask = (cells: readonly (string | null)[]) => cells.map((cell) => cell !== null);
    expect(mask(turned.top)).toEqual(mask(plain.top));
    expect(mask(turned.front)).toEqual(mask(plain.front));
    expect(mask(turned.right)).toEqual(mask(plain.right));
  });

  it('leaves the last layer facing the way every chart draws it', () => {
    for (const [setId, group] of [
      ['pll', ''],
      ['oll', ''],
      ['2look-pll', '1 / Corners'],
    ] as const) {
      expect(diagramFor(setId, group).orientation).toBe('');
    }
  });
});
