import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { navigate, useRoute } from './router';

function ShownRoute() {
  return <p>{useRoute()}</p>;
}

describe('router', () => {
  afterEach(() => {
    window.location.hash = '';
  });

  // hashchange is dispatched later; anything drawn in between would show the
  // old screen with the menu already gone.
  it('switches the screen in the same update as the click, not on hashchange', () => {
    render(<ShownRoute />);

    act(() => navigate('stats'));

    expect(screen.getByText('stats')).toBeInTheDocument();
  });

  it('follows the hash when it changes from outside, as on a back press', async () => {
    render(<ShownRoute />);

    await act(async () => {
      window.location.hash = '#/settings';
      await new Promise((resolve) => window.addEventListener('hashchange', resolve, { once: true }));
    });

    expect(screen.getByText('settings')).toBeInTheDocument();
  });
});
