import { useEffect, useState } from 'react';
import { clearError, lastError, onError, type AppError } from '../lib/errors';
import { strings } from '../lib/strings';

/**
 * Shows the last failure. Without it a broken database or a rejected write
 * looks exactly like "nothing happened", which is impossible to diagnose from
 * a phone.
 */
export function ErrorBanner() {
  const [error, setError] = useState<AppError | null>(lastError);

  useEffect(() => onError(setError), []);

  if (!error) return null;

  return (
    <div className="error-banner" role="alert">
      <span>
        {error.context}: {error.message}
      </span>
      <button
        type="button"
        onClick={() => {
          clearError();
          setError(null);
        }}
      >
        {strings.errors.dismiss}
      </button>
    </div>
  );
}
