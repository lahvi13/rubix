import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { strings } from '../lib/strings';
import { MoreSheet } from './MoreSheet';
import { ROUTES, useRoute } from './router';
import { TabBar } from './TabBar';
import { isTab, tabRoutes } from './tab-routes';

const FACES = { U: '#fff', D: '#ff0', F: '#0f0', B: '#00f', L: '#f80', R: '#f00' } as const;

/** The bar and its More sheet, wired the way App wires them. */
function Shell({ showLearn }: { showLearn: boolean }) {
  const route = useRoute();
  const [isMoreOpen, setMoreOpen] = useState(false);
  const tabs = tabRoutes(showLearn);
  return (
    <>
      <p data-testid="route">{route}</p>
      <TabBar
        route={route}
        tabs={tabs}
        isShown
        isMoreOpen={isMoreOpen}
        onMore={() => setMoreOpen(true)}
      />
      {isMoreOpen ? (
        <MoreSheet
          routes={ROUTES.filter((target) => !isTab(target, tabs))}
          route={route}
          faces={FACES}
          onClose={() => setMoreOpen(false)}
        />
      ) : null}
    </>
  );
}

const tab = (name: string) => screen.getByRole('button', { name });

describe('TabBar', () => {
  afterEach(() => {
    window.location.hash = '';
  });

  it('marks the screen it is on', () => {
    act(() => {
      window.location.hash = '#/stats';
    });
    render(<Shell showLearn />);

    expect(tab(strings.nav.stats)).toHaveAttribute('aria-current', 'page');
    expect(tab(strings.nav.timer)).not.toHaveAttribute('aria-current');
  });

  it('keeps the guide under the thumb while it is switched on', () => {
    render(<Shell showLearn />);

    expect(tab(strings.nav.learn)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: strings.nav.drill })).not.toBeInTheDocument();
  });

  it('gives its place to the drill once the guide is off', () => {
    render(<Shell showLearn={false} />);

    expect(tab(strings.nav.drill)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: strings.nav.learn })).not.toBeInTheDocument();
  });

  it('lights More on a screen the bar has no tab for', () => {
    act(() => {
      window.location.hash = '#/history';
    });
    render(<Shell showLearn />);

    expect(tab(strings.nav.more)).toHaveClass('is-active');
  });

  it('goes to a screen from More and puts the card away', () => {
    render(<Shell showLearn={false} />);

    fireEvent.click(tab(strings.nav.more));
    fireEvent.click(tab(strings.nav.history));

    expect(screen.getByTestId('route')).toHaveTextContent('history');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('closes the card from the X of its name', () => {
    render(<Shell showLearn />);

    fireEvent.click(tab(strings.nav.more));
    const close = within(screen.getByRole('dialog')).getByText('X');
    expect(close).toHaveAccessibleName(strings.history.close);
    fireEvent.click(close);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
