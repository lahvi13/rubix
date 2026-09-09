import { describe, expect, it } from 'vitest';
import { isPullDown, readSwipe, type SwipeDirection } from './swipe';

const BOUNDS = { width: 412 };
const from = { x: 200, y: 400 };

describe('readSwipe', () => {
  it.each<[string, { x: number; y: number }, { x: number; y: number }, SwipeDirection | null]>([
    ['a firm drag left is the next one', from, { x: 120, y: 405 }, 'next'],
    ['a firm drag right is the one before', from, { x: 280, y: 395 }, 'previous'],
    ['a short drag is aiming, not swiping', from, { x: 160, y: 400 }, null],
    ['exactly at the threshold is still short', from, { x: 141, y: 400 }, null],
    ['a drag more down than across is a scroll', from, { x: 120, y: 300 }, null],
    // The case that matters: scrolling the sheet must never skip a page.
    ['a long scroll with a little sideways drift', from, { x: 250, y: 40 }, null],
    ['a diagonal that is decisively across still counts', from, { x: 100, y: 430 }, 'next'],
    ['starting in the left edge belongs to the system', { x: 8, y: 400 }, { x: 200, y: 400 }, null],
    ['starting in the right edge does too', { x: 406, y: 400 }, { x: 200, y: 400 }, null],
    ['just inside the edge is ours', { x: 30, y: 400 }, { x: 200, y: 400 }, 'previous'],
    ['no movement at all is a tap', from, from, null],
  ])('%s', (_name, start, end, expected) => {
    expect(readSwipe(start, end, BOUNDS)).toBe(expected);
  });
});

describe('isPullDown', () => {
  const from = { x: 200, y: 300 };

  it.each<[string, { x: number; y: number }, boolean]>([
    ['a firm drag down puts the panel away', { x: 205, y: 400 }, true],
    ['a short drag is a tap that slipped', { x: 200, y: 340 }, false],
    ['exactly at the threshold is still short', { x: 200, y: 359 }, false],
    ['upwards is not a pull down', { x: 200, y: 200 }, false],
    ['a drag more across than down is a swipe', { x: 320, y: 380 }, false],
    ['a diagonal that is decisively down still counts', { x: 240, y: 420 }, true],
    ['no movement at all is a tap', from, false],
  ])('%s', (_name, end, expected) => {
    expect(isPullDown(from, end)).toBe(expected);
  });
});
