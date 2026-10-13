import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useScramble } from './use-scramble';

/** Each event's scrambles, numbered in the order they were asked for. */
const drawn = new Map<string, number>();

vi.mock('../lib/scramble-client', () => ({
  requestScramble: (eventId: string) => {
    const count = (drawn.get(eventId) ?? 0) + 1;
    drawn.set(eventId, count);
    return Promise.resolve(`${eventId} #${count}`);
  },
}));

describe('useScramble', () => {
  beforeEach(() => {
    drawn.clear();
  });

  it('shows one scramble and has the next one ready', async () => {
    const { result } = renderHook(() => useScramble('333'));

    await waitFor(() => expect(result.current.scramble).toBe('333 #1'));
    expect(drawn.get('333')).toBe(2);

    act(() => result.current.next());
    await waitFor(() => expect(result.current.scramble).toBe('333 #2'));
  });

  it('asks for nothing while it is switched off', async () => {
    renderHook(() => useScramble('333', false));

    await Promise.resolve();
    expect(drawn.size).toBe(0);
  });

  it("never shows one cube's scramble as another's when the event changes", async () => {
    const { result, rerender } = renderHook(({ eventId }) => useScramble(eventId), {
      initialProps: { eventId: '333' },
    });
    await waitFor(() => expect(result.current.scramble).toBe('333 #1'));

    rerender({ eventId: '222' });

    // Not the 3×3 scramble still on screen, and not the one waiting behind it.
    expect(result.current.scramble).toBeNull();
    await waitFor(() => expect(result.current.scramble).toBe('222 #1'));

    act(() => result.current.next());
    await waitFor(() => expect(result.current.scramble).toBe('222 #2'));
  });
});
