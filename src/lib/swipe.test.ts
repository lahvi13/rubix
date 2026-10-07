import { describe, expect, it } from 'vitest';
import {
  closesMenu,
  isMenuDrag,
  isPullDown,
  isPullUp,
  isSheetDismissed,
  opensMenu,
  readSheetDrag,
  readSwipe,
  type SwipeDirection,
} from './swipe';

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

describe('isPullUp', () => {
  const from = { x: 200, y: 400 };

  it.each<[string, { x: number; y: number }, boolean]>([
    ['a firm drag up pulls the panel open', { x: 205, y: 300 }, true],
    ['a short drag is a tap that slipped', { x: 200, y: 360 }, false],
    ['exactly at the threshold is still short', { x: 200, y: 341 }, false],
    ['downwards is not a pull up', { x: 200, y: 500 }, false],
    ['a drag more across than up is a swipe', { x: 320, y: 320 }, false],
    ['a diagonal that is decisively up still counts', { x: 240, y: 280 }, true],
    ['no movement at all is a tap', from, false],
  ])('%s', (_name, end, expected) => {
    expect(isPullUp(from, end)).toBe(expected);
  });
});

describe('opensMenu', () => {
  it.each<[string, { x: number; y: number }, { x: number; y: number }, boolean]>([
    ['a firm drag right from near the edge', { x: 60, y: 400 }, { x: 200, y: 410 }, true],
    ['the edge of the zone still counts', { x: 100, y: 400 }, { x: 240, y: 400 }, true],
    ['just past it does not', { x: 101, y: 400 }, { x: 241, y: 400 }, false],
    ['the same drag begun mid-screen', { x: 160, y: 400 }, { x: 300, y: 400 }, false],
    ['leftwards never opens it', { x: 180, y: 400 }, { x: 40, y: 400 }, false],
    // The edge is the system's back gesture; the app never hears it anyway.
    ['from the very edge belongs to the system', { x: 10, y: 400 }, { x: 200, y: 400 }, false],
    ['a scroll with a sideways drift', { x: 60, y: 600 }, { x: 140, y: 200 }, false],
    ['too short to be meant', { x: 60, y: 400 }, { x: 110, y: 400 }, false],
  ])('%s', (_name, start, end, expected) => {
    expect(opensMenu(start, end, BOUNDS)).toBe(expected);
  });
});

describe('closesMenu', () => {
  it.each<[string, { x: number; y: number }, { x: number; y: number }, boolean]>([
    ['a firm drag left anywhere', { x: 300, y: 400 }, { x: 150, y: 400 }, true],
    ['rightwards leaves it open', { x: 100, y: 400 }, { x: 300, y: 400 }, false],
    ['a scroll through a long menu', { x: 100, y: 600 }, { x: 60, y: 300 }, false],
  ])('%s', (_name, start, end, expected) => {
    expect(closesMenu(start, end, BOUNDS)).toBe(expected);
  });
});

describe('isMenuDrag', () => {
  it.each<[string, { x: number; y: number }, { x: number; y: number }, boolean, boolean]>([
    ['rightwards from the zone, menu shut', { x: 50, y: 400 }, { x: 70, y: 402 }, false, true],
    ['still inside the slop', { x: 50, y: 400 }, { x: 55, y: 400 }, false, false],
    ['rightwards from mid-screen', { x: 150, y: 400 }, { x: 200, y: 400 }, false, false],
    ['mostly down is a scroll', { x: 50, y: 400 }, { x: 70, y: 440 }, false, false],
    ['leftwards with the menu shut', { x: 70, y: 400 }, { x: 40, y: 400 }, false, false],
    ['from the system strip', { x: 10, y: 400 }, { x: 60, y: 400 }, false, false],
    ['leftwards anywhere, menu open', { x: 300, y: 400 }, { x: 260, y: 405 }, true, true],
    ['rightwards with the menu open', { x: 50, y: 400 }, { x: 90, y: 400 }, true, false],
  ])('%s', (_name, start, now, isOpen, expected) => {
    expect(isMenuDrag(start, now, BOUNDS, isOpen)).toBe(expected);
  });
});

describe('readSheetDrag', () => {
  it.each<[string, { x: number; y: number }, 'pull' | 'other' | null]>([
    ['still inside the slop is a tap so far', { x: 203, y: 404 }, null],
    ['downwards is a pull', { x: 202, y: 420 }, 'pull'],
    ['down and a little across is still a pull', { x: 210, y: 415 }, 'pull'],
    ['across is somebody else’s gesture', { x: 230, y: 405 }, 'other'],
    ['upwards is not a pull', { x: 200, y: 380 }, 'other'],
  ])('%s', (_name, now, expected) => {
    expect(readSheetDrag(from, now)).toBe(expected);
  });
});

describe('isSheetDismissed', () => {
  it.each<[string, number, number, number, boolean]>([
    ['a quarter of the sheet down goes', 150, 600, 0, true],
    ['less than that springs back', 140, 600, 0.1, false],
    ['a short sheet still asks for a real drag', 40, 120, 0, false],
    ['a short sheet dragged firmly goes', 60, 120, 0, true],
    ['a flick goes however short', 40, 600, 0.8, true],
    ['a flick that barely moved is a tap that slipped', 20, 600, 2, false],
  ])('%s', (_name, draggedPx, heightPx, velocity, expected) => {
    expect(isSheetDismissed(draggedPx, heightPx, velocity)).toBe(expected);
  });
});
