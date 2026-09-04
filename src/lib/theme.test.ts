import { describe, expect, it } from 'vitest';
import { isTheme, resolveTheme } from './theme';

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

describe('isTheme', () => {
  it.each(['system', 'light', 'dark'])('accepts %s', (value) => {
    expect(isTheme(value)).toBe(true);
  });

  it.each([null, undefined, 'Dark', '', 1])('rejects %s', (value) => {
    expect(isTheme(value)).toBe(false);
  });
});
