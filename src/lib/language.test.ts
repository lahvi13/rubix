import { afterEach, describe, expect, it, vi } from 'vitest';
import { currentLanguage, defaultLanguage, isLanguage, storeLanguage } from './language';

function browserAsks(...tags: string[]): void {
  vi.spyOn(navigator, 'languages', 'get').mockReturnValue(tags);
}

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('defaultLanguage', () => {
  it.each([
    [['cs'], 'cs'],
    [['cs-CZ'], 'cs'],
    [['CS-cz'], 'cs'],
    [['en-GB'], 'en'],
    [['sk-SK', 'cs-CZ'], 'cs'],
    // Nothing on offer is a language the app has: English, which it is written in.
    [['de-DE', 'fr'], 'en'],
    [[], 'en'],
  ])('reads %j as %s', (tags, expected) => {
    browserAsks(...tags);
    expect(defaultLanguage()).toBe(expected);
  });
});

describe('currentLanguage', () => {
  it('prefers what the reader chose over what the browser asks for', () => {
    browserAsks('en-GB');
    storeLanguage('cs');
    expect(currentLanguage()).toBe('cs');
  });

  it('falls back to the browser when nothing was chosen', () => {
    browserAsks('cs-CZ');
    expect(currentLanguage()).toBe('cs');
  });

  it('ignores a stored value it does not know', () => {
    browserAsks('en-GB');
    localStorage.setItem('rubix.language', 'de');
    expect(currentLanguage()).toBe('en');
  });

  it('survives storage being denied', () => {
    browserAsks('cs-CZ');
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('denied');
    });
    expect(() => storeLanguage('en')).not.toThrow();
    expect(currentLanguage()).toBe('cs');
  });
});

describe('isLanguage', () => {
  it.each([
    ['cs', true],
    ['en', true],
    ['de', false],
    ['', false],
    [null, false],
    [{}, false],
  ])('%s', (value, expected) => {
    expect(isLanguage(value)).toBe(expected);
  });
});
