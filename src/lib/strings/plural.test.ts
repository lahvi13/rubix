import { describe, expect, it } from 'vitest';
import { plural } from './plural';

/*
 * The one that surprises: only 2, 3 and 4 take the few form. Twenty-two does
 * not, which is why this is not written as a test of the last digit.
 */
describe('plural', () => {
  it.each([
    [0, 'dní'],
    [1, 'den'],
    [2, 'dny'],
    [4, 'dny'],
    [5, 'dní'],
    [11, 'dní'],
    [21, 'dní'],
    [22, 'dní'],
    [100, 'dní'],
  ])('%i takes the %s form', (count, expected) => {
    expect(plural(count, 'den', 'dny', 'dní')).toBe(expected);
  });
});
