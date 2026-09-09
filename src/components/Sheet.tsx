import type { ReactNode } from 'react';
import { useKeyCapture } from '../hooks/use-key-capture';
import { strings } from '../lib/strings';

interface SheetProps {
  /** What the panel is, for anyone who cannot see it. */
  label: string;
  /** The panel's own class, added to the shared one. */
  className?: string;
  onClose: () => void;
  children: ReactNode;
}

/**
 * A panel over the screen, with everything that makes it one: the wash that
 * dims what it covers and closes it when tapped, the keyboard held so a Space
 * meant for a button here does not start a solve underneath.
 *
 * All of it lives here because it used to live at each call site, and one of
 * them had already drifted — the solve detail shipped without a wash, which is
 * why the list above it read as still being the page.
 */
export function Sheet({ label, className, onClose, children }: SheetProps) {
  useKeyCapture(true, onClose);

  return (
    <>
      <button
        type="button"
        className="app__scrim sheet-scrim"
        aria-label={strings.history.close}
        onClick={onClose}
      />
      <aside
        // `detail` is what this codebase already calls a sheet's box.
        className={className === undefined ? 'detail' : `detail ${className}`}
        role="dialog"
        aria-modal="true"
        aria-label={label}
      >
        {children}
      </aside>
    </>
  );
}
