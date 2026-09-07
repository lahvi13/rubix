import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearUndo, offerUndo } from '../lib/undo';
import { UndoBar } from './UndoBar';

afterEach(() => {
  clearUndo();
  vi.useRealTimers();
});

describe('UndoBar', () => {
  it('stays out of the way until something is deleted', () => {
    render(<UndoBar />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('offers the way back and takes it', async () => {
    const undo = vi.fn();
    const user = userEvent.setup();
    render(<UndoBar />);

    act(() => offerUndo('Solve deleted.', undo));
    expect(screen.getByRole('status')).toHaveTextContent('Solve deleted.');

    await user.click(screen.getByRole('button', { name: /Undo/ }));

    expect(undo).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('counts down and gives up on its own', async () => {
    vi.useFakeTimers();
    const undo = vi.fn();
    render(<UndoBar />);

    act(() => offerUndo('Solve deleted.', undo));
    expect(screen.getByRole('button', { name: 'Undo (5)' })).toBeInTheDocument();

    // A second per turn of the loop: each tick is scheduled by the render the
    // one before it caused, so they cannot be advanced through in one go.
    await act(() => vi.advanceTimersByTimeAsync(1000));
    expect(screen.getByRole('button', { name: 'Undo (4)' })).toBeInTheDocument();

    for (let second = 0; second < 5; second += 1) {
      await act(() => vi.advanceTimersByTimeAsync(1000));
    }
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    // Letting the offer lapse is not the same as declining it, but it does
    // mean the delete stands.
    expect(undo).not.toHaveBeenCalled();
  });

  it('shows the newest offer rather than stacking them up', () => {
    render(<UndoBar />);

    act(() => offerUndo('Solve deleted.', vi.fn()));
    act(() => offerUndo('3 solves deleted.', vi.fn()));

    expect(screen.getAllByRole('status')).toHaveLength(1);
    expect(screen.getByRole('status')).toHaveTextContent('3 solves deleted.');
  });
});
