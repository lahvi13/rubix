import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useKeyCapture } from './use-key-capture';

function press(target: HTMLElement, key: string): void {
  target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
  target.dispatchEvent(new KeyboardEvent('keyup', { key, bubbles: true }));
}

describe('useKeyCapture', () => {
  const underneath = vi.fn();
  const elements: HTMLElement[] = [];
  const add = (tag: string) => {
    const element = document.createElement(tag);
    document.body.append(element);
    elements.push(element);
    return element;
  };

  // What the timer does: listen on the window, in the bubbling phase.
  window.addEventListener('keydown', underneath);
  afterEach(() => {
    underneath.mockClear();
    elements.splice(0).forEach((element) => element.remove());
  });

  it('keeps a key pressed on a button from whatever listens underneath', () => {
    renderHook(() => useKeyCapture(true, vi.fn()));

    press(add('button'), ' ');

    expect(underneath).not.toHaveBeenCalled();
  });

  it.each(['input', 'textarea'])('lets a field (%s) keep its keys, so Enter reaches its handler', (tag) => {
    renderHook(() => useKeyCapture(true, vi.fn()));
    const field = add(tag);
    const onKey = vi.fn();
    field.addEventListener('keydown', onKey);

    press(field, 'Enter');

    expect(onKey).toHaveBeenCalledOnce();
  });

  it.each(['button', 'input'])('closes on Escape from a %s', (tag) => {
    const onEscape = vi.fn();
    renderHook(() => useKeyCapture(true, onEscape));

    press(add(tag), 'Escape');

    expect(onEscape).toHaveBeenCalledOnce();
  });

  it('does nothing while inactive', () => {
    const onEscape = vi.fn();
    renderHook(() => useKeyCapture(false, onEscape));

    press(add('button'), 'Escape');

    expect(onEscape).not.toHaveBeenCalled();
    expect(underneath).toHaveBeenCalledOnce();
  });
});
