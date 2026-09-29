import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Sheet } from './Sheet';

function Detail({ id }: { id: string }) {
  return (
    <Sheet key={id} label={`Solve ${id}`} onClose={() => {}}>
      <p>{id}</p>
    </Sheet>
  );
}

describe('Sheet', () => {
  it('rises in when it opens over the screen', () => {
    render(<Detail id="a" />);

    expect(screen.getByRole('dialog')).toHaveClass('is-entering');
  });

  it('stays put when it replaces a sheet that was already up', () => {
    const { rerender } = render(<Detail id="a" />);
    rerender(<Detail id="b" />);

    expect(screen.getByRole('dialog', { name: 'Solve b' })).not.toHaveClass('is-entering');
  });

  it('rises in again once the one before it has closed', () => {
    const { unmount } = render(<Detail id="a" />);
    unmount();
    render(<Detail id="b" />);

    expect(screen.getByRole('dialog')).toHaveClass('is-entering');
  });
});
