import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearError, forgetErrors, reportError } from '../lib/errors';
import { ErrorBanner } from './ErrorBanner';

afterEach(() => {
  clearError();
  forgetErrors();
});

describe('ErrorBanner', () => {
  it('offers the failed action back where there is one to offer', async () => {
    const user = userEvent.setup();
    const retry = vi.fn();
    render(<ErrorBanner />);

    act(() => reportError('Could not save the solve', new Error('QuotaExceededError'), retry));
    await user.click(screen.getByRole('button', { name: 'Try again' }));

    expect(retry).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('only dismisses a failure there is nothing to do again about', () => {
    render(<ErrorBanner />);

    act(() => reportError('Database unavailable', new Error('blocked')));

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Dismiss' })).toBeInTheDocument();
  });
});
