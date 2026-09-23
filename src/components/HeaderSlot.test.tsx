import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { HeaderSlotContext } from './header-slot-context';
import { InHeader } from './HeaderSlot';

describe('InHeader', () => {
  it('draws into the header when there is one', () => {
    const slot = document.createElement('div');
    document.body.append(slot);
    render(
      <HeaderSlotContext.Provider value={slot}>
        <main>
          <InHeader>
            <button type="button">Solve it</button>
          </InHeader>
        </main>
      </HeaderSlotContext.Provider>,
    );

    expect(slot).toContainElement(screen.getByRole('button', { name: 'Solve it' }));
    expect(screen.getByRole('main')).not.toContainElement(screen.getByRole('button', { name: 'Solve it' }));
    slot.remove();
  });

  it('draws in place where there is no header', () => {
    render(
      <main>
        <InHeader>
          <button type="button">Solve it</button>
        </InHeader>
      </main>,
    );

    expect(screen.getByRole('main')).toContainElement(screen.getByRole('button', { name: 'Solve it' }));
  });
});
