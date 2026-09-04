import { describe, expect, it } from 'vitest';
import { DEFAULT_APPEARANCE, isFont, isSize, isTheme, resolveTheme } from './appearance';

describe('resolveTheme', () => {
  it.each([
    ['system', true, 'dark'],
    ['system', false, 'light'],
    ['dark', false, 'dark'],
    ['light', true, 'light'],
  ] as const)('%s with prefersDark=%s is %s', (theme, dark, expected) => {
    expect(resolveTheme(theme, dark)).toBe(expected);
  });
});

describe('guards', () => {
  it.each(['system', 'light', 'dark'])('%s is a theme', (value) => {
    expect(isTheme(value)).toBe(true);
  });

  it.each(['sans', 'mono', 'system'])('%s is a font', (value) => {
    expect(isFont(value)).toBe(true);
  });

  it.each(['small', 'medium', 'large'])('%s is a size', (value) => {
    expect(isSize(value)).toBe(true);
  });

  it.each([null, undefined, 'Dark', '', 1])('%s is none of them', (value) => {
    expect(isTheme(value)).toBe(false);
    expect(isFont(value)).toBe(false);
    expect(isSize(value)).toBe(false);
  });
});

describe('defaults', () => {
  it('are values the guards accept', () => {
    expect(isTheme(DEFAULT_APPEARANCE.theme)).toBe(true);
    expect(isFont(DEFAULT_APPEARANCE.font)).toBe(true);
    expect(isSize(DEFAULT_APPEARANCE.textSize)).toBe(true);
    expect(isSize(DEFAULT_APPEARANCE.clockSize)).toBe(true);
  });
});
