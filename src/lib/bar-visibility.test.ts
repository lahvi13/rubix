import { describe, expect, it } from 'vitest';
import { BAR_SHOWN, scrollBar } from './bar-visibility';

/** The bar after scrolling through each position in turn, from the top. */
function after(positions: readonly number[]): boolean {
  return positions.reduce(scrollBar, BAR_SHOWN).isShown;
}

describe('scrollBar', () => {
  it.each<[string, number[], boolean]>([
    ['untouched, it shows', [], true],
    ['a long scroll down puts it away', [100, 200, 400], false],
    ['a few pixels down is a resting thumb', [200, 150, 165, 180], true],
    ['heading back up brings it back', [100, 300, 600, 560], true],
    ['a small wobble upwards does not', [100, 300, 600, 590], false],
    ['wobbling up and down does not add up to a run', [200, 150, 175, 150, 175, 150, 175], true],
    ['near the top it always shows', [100, 400, 700, 30], true],
    ['down, back up, then down again hides it again', [100, 400, 300, 500], false],
    ['bouncing past the top shows it', [400, 800, -20], true],
  ])('%s', (_name, positions, expected) => {
    expect(after(positions)).toBe(expected);
  });
});
