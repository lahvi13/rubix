import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PuzzleSheet, PuzzleSwitch } from './PuzzleSwitch';

describe('PuzzleSwitch', () => {
  it('says which cube the app is on, and opens the list', async () => {
    const onOpen = vi.fn();
    const user = userEvent.setup();

    render(<PuzzleSwitch puzzle="222" onOpen={onOpen} />);
    const button = screen.getByRole('button', { name: 'Cube: 2×2. Switch cube' });
    expect(button).toHaveTextContent('2×2');
    await user.click(button);

    expect(onOpen).toHaveBeenCalled();
  });
});

describe('PuzzleSheet', () => {
  it('lists the cubes with the one in use marked', () => {
    render(<PuzzleSheet puzzle="333" onPick={vi.fn()} onClose={vi.fn()} />);

    expect(screen.getByRole('button', { name: '3×3' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '2×2' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('switches to the cube that was picked and closes', async () => {
    const onPick = vi.fn();
    const onClose = vi.fn();
    const user = userEvent.setup();

    render(<PuzzleSheet puzzle="333" onPick={onPick} onClose={onClose} />);
    await user.click(screen.getByRole('button', { name: '2×2' }));

    expect(onPick).toHaveBeenCalledWith('222');
    expect(onClose).toHaveBeenCalled();
  });
});
