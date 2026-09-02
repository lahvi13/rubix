import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ErrorBoundary } from './ErrorBoundary';

function Bomb(): never {
  throw new Error('dynamically imported module failed');
}

describe('ErrorBoundary', () => {
  it('renders its children while nothing throws', () => {
    render(
      <ErrorBoundary>
        <p>alive</p>
      </ErrorBoundary>,
    );
    expect(screen.getByText('alive')).toBeInTheDocument();
  });

  it('shows the reload screen instead of a blank page when rendering throws', () => {
    // React logs the caught error; that noise is expected here.
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>,
    );

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reload' })).toBeInTheDocument();

    consoleError.mockRestore();
  });
});
