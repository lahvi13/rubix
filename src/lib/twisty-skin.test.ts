import { describe, expect, it } from 'vitest';
import { SIDE_SHADE } from './cube-skins';
import { sideLighting } from './twisty-skin';

describe('sideLighting', () => {
  const light = sideLighting(SIDE_SHADE);
  const shadeOf = (x: number, y: number) => light.base + light.x * x + light.y * y;

  // How each face the still picture shows faces the viewer (x right, y up).
  it.each([
    ['top', 0, Math.sqrt(2 / 3), 1],
    ['front', -Math.SQRT1_2, -Math.sqrt(1 / 6), SIDE_SHADE.front],
    ['right', Math.SQRT1_2, -Math.sqrt(1 / 6), SIDE_SHADE.right],
  ])('lights the %s face as the picture shades it', (_face, x, y, expected) => {
    expect(shadeOf(x, y)).toBeCloseTo(expected, 10);
  });
});
