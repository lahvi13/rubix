import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { strings } from '../lib/strings';
import { TimerDisplay } from './TimerDisplay';

const handlers = { onPointerDown: () => {}, onPointerUp: () => {} };

/** Answers every media query as a mouse-and-keyboard device would, or not. */
function pointerIsFine(matches: boolean) {
  vi.spyOn(window, 'matchMedia').mockImplementation((media: string) => ({
    media,
    matches,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }));
}

function renderIdle(inspectionEnabled = false) {
  render(
    <TimerDisplay
      state={{ status: 'idle', lastRawMs: null }}
      displayMs={null}
      inspectionMs={null}
      armed={false}
      inspectionEnabled={inspectionEnabled}
      touchHandlers={handlers}
    />,
  );
}

describe('TimerDisplay hint', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each<[boolean, boolean, string]>([
    [false, false, strings.timer.holdToStart],
    [true, false, strings.timer.keys.holdToStart],
    [false, true, strings.timer.inspectionHint],
    [true, true, strings.timer.keys.inspectionHint],
  ])('with a fine pointer %s and inspection %s says "%s"', (isFine, inspection, hint) => {
    pointerIsFine(isFine);
    renderIdle(inspection);

    expect(screen.getByText(hint)).toBeInTheDocument();
  });
});
