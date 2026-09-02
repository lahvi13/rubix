import { useEffect, useRef, type ReactNode } from 'react';
import { strings } from '../lib/strings';

/** Long enough to read after looking away, short enough not to linger. */
const AUTO_HIDE_MS = 8000;

interface NoticeProps {
  children: ReactNode;
  onDismiss: () => void;
  /** 0 keeps the notice until it is dismissed. */
  autoHideMs?: number;
}

/**
 * Confirms that something happened. An export writes a file the page never
 * shows and a wipe leaves an empty screen behind — without a word on screen
 * both look exactly like a button that did nothing.
 */
export function Notice({ children, onDismiss, autoHideMs = AUTO_HIDE_MS }: NoticeProps) {
  const dismiss = useRef(onDismiss);

  useEffect(() => {
    dismiss.current = onDismiss;
  });

  // The callback is kept off the dependency list on purpose: a parent that
  // re-renders must not keep restarting the countdown.
  useEffect(() => {
    if (autoHideMs === 0) return;
    const handle = setTimeout(() => dismiss.current(), autoHideMs);
    return () => clearTimeout(handle);
  }, [autoHideMs]);

  return (
    <div className="notice" role="status">
      <div className="notice__body">{children}</div>
      <button type="button" onClick={onDismiss}>
        {strings.common.dismiss}
      </button>
    </div>
  );
}
