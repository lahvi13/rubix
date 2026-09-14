import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { holdBackForPanel, resetSheetHistory } from './sheet-history';

/** Lets the history traversals and the release's microtask all land. */
async function settle(): Promise<void> {
  for (let round = 0; round < 5; round++) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

function top(): unknown {
  return window.history.state;
}

function panelId(): number | null {
  const state: unknown = window.history.state;
  if (typeof state !== 'object' || state === null || !('rubixPanel' in state)) return null;
  const id: unknown = (state as { rubixPanel: unknown }).rubixPanel;
  return typeof id === 'number' ? id : null;
}

/** The reader's own press, as the browser delivers it. */
async function pressBack(): Promise<void> {
  window.history.back();
  await settle();
}

describe('sheet history', () => {
  beforeEach(async () => {
    resetSheetHistory();
    // Start every test on an entry that is none of ours.
    window.history.pushState(null, '');
    await settle();
  });

  afterEach(() => {
    resetSheetHistory();
  });

  it('closes the panel on top, and only that one, on back', async () => {
    const closeLower = vi.fn();
    const closeUpper = vi.fn();
    holdBackForPanel(closeLower);
    const lowerEntry = panelId();
    holdBackForPanel(closeUpper);

    await pressBack();

    expect(closeUpper).toHaveBeenCalledOnce();
    expect(closeLower).not.toHaveBeenCalled();
    expect(panelId()).toBe(lowerEntry);
  });

  it('takes the entry away when a panel is closed by a tap', async () => {
    const release = holdBackForPanel(vi.fn());
    release();
    await settle();

    expect(top()).toBeNull();
  });

  it('takes the entry away when a panel is closed above another that stays open', async () => {
    // The session picker dismissed while solves are being picked.
    const closePicking = vi.fn();
    holdBackForPanel(closePicking);
    const pickingEntry = panelId();
    const releasePicker = holdBackForPanel(vi.fn());

    releasePicker();
    await settle();

    expect(panelId()).toBe(pickingEntry);
    // Not read as a press: the panel beneath is still open.
    expect(closePicking).not.toHaveBeenCalled();

    // And the next press closes that one, rather than being spent on nothing.
    await pressBack();
    expect(closePicking).toHaveBeenCalledOnce();
    expect(top()).toBeNull();
  });

  it.each([
    ['lower first', true],
    ['upper first', false],
  ])('takes both entries away when two panels close in one commit, %s', async (_, isLowerFirst) => {
    const releaseLower = holdBackForPanel(vi.fn());
    const releaseUpper = holdBackForPanel(vi.fn());

    if (isLowerFirst) {
      releaseLower();
      releaseUpper();
    } else {
      releaseUpper();
      releaseLower();
    }
    await settle();

    expect(top()).toBeNull();
  });

  it('hands an entry over to a panel opening in the same commit', async () => {
    const length = window.history.length;
    const release = holdBackForPanel(vi.fn());
    const entry = panelId();

    release();
    const closeNext = vi.fn();
    holdBackForPanel(closeNext);
    await settle();

    expect(panelId()).toBe(entry);
    expect(window.history.length).toBe(length + 1);

    await pressBack();
    expect(closeNext).toHaveBeenCalledOnce();
  });

  it('hands over beneath a panel that stays open, too', async () => {
    holdBackForPanel(vi.fn());
    const release = holdBackForPanel(vi.fn());
    const entry = panelId();

    release();
    holdBackForPanel(vi.fn());
    await settle();

    expect(panelId()).toBe(entry);
  });

  it('steps over an entry whose panel is gone when back arrives at it', async () => {
    // Left behind before a reload, say: ours by its shape, held by nobody.
    window.history.pushState({ rubixPanel: 7 }, '');
    window.history.pushState(null, '');
    const close = vi.fn();
    const release = holdBackForPanel(close);
    release();
    await settle();

    await pressBack();

    expect(top()).toBeNull();
    expect(close).not.toHaveBeenCalled();
  });
});
