import { act, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { strings } from '../lib/strings';
import { MoreSheet } from './MoreSheet';
import { useRoute } from './router';
import { TabBar } from './TabBar';

/** The bar and its More sheet, wired the way App wires them. */
function Shell() {
  const route = useRoute();
  const [isMoreOpen, setMoreOpen] = useState(false);
  return (
    <>
      <p data-testid="route">{route}</p>
      <TabBar route={route} isShown isMoreOpen={isMoreOpen} onMore={() => setMoreOpen(true)} />
      {isMoreOpen ? (
        <MoreSheet
          routes={['learn', 'drill', 'settings', 'data', 'about']}
          route={route}
          onClose={() => setMoreOpen(false)}
        />
      ) : null}
    </>
  );
}

describe('TabBar', () => {
  afterEach(() => {
    window.location.hash = '';
  });

  it('marks the screen it is on', () => {
    act(() => {
      window.location.hash = '#/stats';
    });
    render(<Shell />);

    expect(screen.getByRole('button', { name: strings.nav.stats })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByRole('button', { name: strings.nav.timer })).not.toHaveAttribute(
      'aria-current',
    );
  });

  // The drill has no tab: found under More, it is More that is lit there.
  it('lights More on a screen the bar has no tab for', () => {
    act(() => {
      window.location.hash = '#/drill';
    });
    render(<Shell />);

    expect(screen.getByRole('button', { name: strings.nav.more })).toHaveClass('is-active');
  });

  it('goes to a screen from More and puts the sheet away', () => {
    render(<Shell />);

    fireEvent.click(screen.getByRole('button', { name: strings.nav.more }));
    fireEvent.click(screen.getByRole('button', { name: strings.nav.settings }));

    expect(screen.getByTestId('route')).toHaveTextContent('settings');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
