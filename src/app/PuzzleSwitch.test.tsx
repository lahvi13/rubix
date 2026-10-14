import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PuzzleMenu, PuzzleSwitch } from './PuzzleSwitch';

describe('PuzzleSwitch', () => {
  it('says which cube the app is on, and opens the cubes', async () => {
    const onToggle = vi.fn();
    const user = userEvent.setup();

    render(<PuzzleSwitch puzzle="222" isOpen={false} onToggle={onToggle} />);
    const button = screen.getByRole('button', { name: 'Cube: 2×2. Switch cube' });
    expect(button).toHaveAttribute('aria-expanded', 'false');
    // A face of the cube: two squares a side for the 2×2.
    expect(button.querySelectorAll('rect')).toHaveLength(4);
    await user.click(button);

    expect(onToggle).toHaveBeenCalled();
  });

  it('draws the 3×3 as three squares a side', () => {
    render(<PuzzleSwitch puzzle="333" isOpen onToggle={vi.fn()} />);

    const button = screen.getByRole('button', { name: 'Cube: 3×3. Switch cube' });
    expect(button.querySelectorAll('rect')).toHaveLength(9);
    expect(button).toHaveAttribute('aria-expanded', 'true');
  });
});

describe('PuzzleMenu', () => {
  it('lists the cubes, each drawn, with the one in use marked', () => {
    render(<PuzzleMenu puzzle="333" onPick={vi.fn()} onClose={vi.fn()} />);

    expect(screen.getByRole('button', { name: '3×3' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '2×2' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('group', { name: 'Cube' }).querySelectorAll('img')).toHaveLength(2);
  });

  it('switches to the cube that was picked and closes', async () => {
    const onPick = vi.fn();
    const onClose = vi.fn();
    const user = userEvent.setup();

    render(<PuzzleMenu puzzle="333" onPick={onPick} onClose={onClose} />);
    await user.click(screen.getByRole('button', { name: '2×2' }));

    expect(onPick).toHaveBeenCalledWith('222');
    expect(onClose).toHaveBeenCalled();
  });

  it('closes when the screen around it is tapped', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();

    render(<PuzzleMenu puzzle="333" onPick={vi.fn()} onClose={onClose} />);
    await user.click(screen.getByRole('button', { name: 'Close menu' }));

    expect(onClose).toHaveBeenCalled();
  });
});
