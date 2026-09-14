import { afterEach, describe, expect, it, vi } from 'vitest';
import { isBrowserSupported, showUnsupportedBrowser } from './browser-support';
import { strings } from './strings';

/** A CSS object that supports everything except what `missing` names. */
function stubCss(missing: string | null) {
  vi.stubGlobal('CSS', {
    supports: (property: string, value?: string) => {
      const asked = value === undefined ? property : `${property}: ${value}`;
      return missing === null || !asked.includes(missing);
    },
  });
}

describe('isBrowserSupported', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('accepts a browser with everything the stylesheet uses', () => {
    stubCss(null);
    expect(isBrowserSupported()).toBe(true);
  });

  it.each(['light-dark', 'color-mix', 'dvh', ':has'])('turns away a browser without %s', (missing) => {
    stubCss(missing);
    expect(isBrowserSupported()).toBe(false);
  });

  it('turns away a browser that cannot even be asked', () => {
    vi.stubGlobal('CSS', undefined);
    expect(isBrowserSupported()).toBe(false);
  });
});

describe('showUnsupportedBrowser', () => {
  it('says what is wrong in place of the app', () => {
    const root = document.createElement('div');
    root.textContent = 'stale';

    showUnsupportedBrowser(root);

    expect(root.textContent).toContain(strings.unsupportedBrowser.title);
    expect(root.textContent).toContain('iOS 17.5');
    expect(root.textContent).not.toContain('stale');
  });
});
