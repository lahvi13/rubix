import { describe, expect, it } from 'vitest';
import {
  contrast,
  luminance,
  mix,
  parseHex,
  shiftToContrast,
  softenToContrast,
  toHex,
  type Rgb,
} from './colour';

const WHITE: Rgb = { r: 255, g: 255, b: 255 };
const BLACK: Rgb = { r: 0, g: 0, b: 0 };

function hex(value: string): Rgb {
  const parsed = parseHex(value);
  if (!parsed) throw new Error(`not a colour: ${value}`);
  return parsed;
}

describe('parseHex', () => {
  it.each([
    ['#ffffff', WHITE],
    ['#000', BLACK],
    ['#F2D024', { r: 242, g: 208, b: 36 }],
    [' #25b05a ', { r: 37, g: 176, b: 90 }],
  ])('%s', (value, expected) => {
    expect(parseHex(value)).toEqual(expected);
  });

  it.each(['', 'ffffff', '#ffff', '#gggggg', 'red', 'rgb(0 0 0)'])('rejects %j', (value) => {
    expect(parseHex(value)).toBeNull();
  });
});

describe('toHex', () => {
  it.each([
    [WHITE, '#ffffff'],
    [{ r: 37.4, g: 175.6, b: 90 }, '#25b05a'],
    [{ r: -3, g: 300, b: 0 }, '#00ff00'],
  ])('%j is %s', (rgb, expected) => {
    expect(toHex(rgb)).toBe(expected);
  });
});

describe('mix', () => {
  it.each([
    [1, '#ffffff'],
    [0, '#000000'],
    [0.5, '#808080'],
    [2, '#ffffff'],
    [-1, '#000000'],
  ])('white at %s over black is %s', (amount, expected) => {
    expect(toHex(mix(WHITE, BLACK, amount))).toBe(expected);
  });
});

describe('contrast', () => {
  it('spans 1 to 21', () => {
    expect(luminance(WHITE)).toBeCloseTo(1);
    expect(luminance(BLACK)).toBe(0);
    expect(contrast(WHITE, BLACK)).toBeCloseTo(21);
    expect(contrast(WHITE, WHITE)).toBeCloseTo(1);
  });

  it('does not care which side is the ground', () => {
    expect(contrast(hex('#d63a3a'), WHITE)).toBeCloseTo(contrast(WHITE, hex('#d63a3a')));
  });

  // Published WCAG figures, so the formula is checked against something other
  // than itself.
  it.each([
    ['#767676', 4.54],
    ['#595959', 7.0],
  ])('%s on white is %s', (value, expected) => {
    expect(contrast(hex(value), WHITE)).toBeCloseTo(expected, 1);
  });
});

describe('shiftToContrast', () => {
  const paper = hex('#fafbfc');
  const floor = hex('#0b0d12');

  it('leaves a colour that is already readable alone', () => {
    const green = hex('#15874a');
    expect(shiftToContrast(green, paper, floor, 4)).toEqual(green);
  });

  it.each(['#f2d024', '#e8811c', '#25b05a', '#f4f4f4', '#ffe600'])(
    'darkens %s just far enough to read on paper',
    (value) => {
      const shifted = shiftToContrast(hex(value), paper, floor, 4);
      expect(contrast(shifted, paper)).toBeGreaterThanOrEqual(4);
      // Not a step further than it had to: a little less of the shift and it
      // would no longer reach the target.
      expect(contrast(mix(shifted, hex(value), 0.98), paper)).toBeLessThan(4.1);
    },
  );

  it('keeps the hue of what it darkens', () => {
    const shifted = shiftToContrast(hex('#f2d024'), paper, floor, 4);
    expect(shifted.r).toBeGreaterThan(shifted.g);
    expect(shifted.g).toBeGreaterThan(shifted.b);
  });

  it('settles for the far end when even that falls short', () => {
    expect(shiftToContrast(WHITE, WHITE, hex('#eeeeee'), 4)).toEqual(hex('#eeeeee'));
  });
});

describe('softenToContrast', () => {
  const ground = hex('#171a21');

  it('leaves a colour that is already quiet enough alone', () => {
    const blue = hex('#2f6fd0');
    expect(softenToContrast(blue, ground, 6)).toEqual(blue);
  });

  it.each(['#f4f4f4', '#ffffff', '#eef0f4'])('dims %s just far enough', (value) => {
    const softened = softenToContrast(hex(value), ground, 6);
    expect(contrast(softened, ground)).toBeLessThanOrEqual(6);
    // Not a step further than it had to: a little more of the colour back and
    // it would stand out past the target.
    expect(contrast(mix(softened, hex(value), 0.98), ground)).toBeGreaterThan(5.9);
  });
});
