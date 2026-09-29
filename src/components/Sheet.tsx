import { useEffect, useState, type ReactNode } from 'react';
import { useBackToClose } from '../hooks/use-back-to-close';
import { useKeyCapture } from '../hooks/use-key-capture';
import { useSwipe } from '../hooks/use-swipe';
import { strings } from '../lib/strings';
import { CloseIcon, NextIcon, PreviousIcon } from './Icons';

/** One of a sequence, and the way through it. */
export interface SheetPaging {
  /** Counting from one, the way it is read. */
  position: number;
  total: number;
  /** Null at the ends — there is nothing that way. */
  onPrevious: (() => void) | null;
  onNext: (() => void) | null;
}

interface SheetProps {
  /** What the panel is, for anyone who cannot see it. */
  label: string;
  /** The panel's own class, added to the shared one. */
  className?: string;
  onClose: () => void;
  /** Given, the panel is one of a sequence and can be stepped through. */
  paging?: SheetPaging;
  children: ReactNode;
}

/**
 * How many sheets are up. A sheet that replaces another in one commit —
 * stepping to the next solve remounts the detail, moving a solve turns it into
 * the session picker — renders while the one it replaces is still counted, so
 * it knows not to rise in from the edge again or fade its wash in over the one
 * already there, which would read as the screen flickering on every step.
 */
let openSheets = 0;

function useArrival(): boolean {
  const [isArriving] = useState(() => openSheets === 0);
  useEffect(() => {
    openSheets += 1;
    return () => {
      openSheets -= 1;
    };
  }, []);
  return isArriving;
}

/**
 * A panel over the screen, with everything that makes it one: the wash that
 * dims what it covers and closes it when tapped, the keyboard held so a Space
 * meant for a button here does not start a solve underneath, the back gesture
 * closing it rather than leaving the screen, and the bar carrying the way out.
 *
 * All of it lives here because it used to live at each call site, and one of
 * them had already drifted — the solve detail shipped without a wash, which is
 * why the list above it read as still being the page.
 */
export function Sheet({ label, className, onClose, paging, children }: SheetProps) {
  useKeyCapture(true, onClose);
  useBackToClose(onClose);
  const isArriving = useArrival();
  const entering = isArriving ? ' is-entering' : '';

  const swipe = useSwipe((direction) => {
    const step = direction === 'next' ? paging?.onNext : paging?.onPrevious;
    step?.();
  });

  return (
    <>
      <button
        type="button"
        className={`app__scrim sheet-scrim${entering}`}
        aria-label={strings.history.close}
        onClick={onClose}
      />
      <aside
        className={className === undefined ? `detail${entering}` : `detail${entering} ${className}`}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        {...(paging === undefined ? {} : swipe)}
      >
        <div className="sheet__bar">
          {paging === undefined ? null : (
            <div className="sheet__pager">
              <button
                type="button"
                className="sheet__step"
                aria-label={strings.sheet.previous}
                disabled={paging.onPrevious === null}
                onClick={() => paging.onPrevious?.()}
              >
                <PreviousIcon />
              </button>
              <span className="sheet__position">
                {strings.sheet.position(paging.position, paging.total)}
              </span>
              <button
                type="button"
                className="sheet__step"
                aria-label={strings.sheet.next}
                disabled={paging.onNext === null}
                onClick={() => paging.onNext?.()}
              >
                <NextIcon />
              </button>
            </div>
          )}
          <button
            type="button"
            className="detail__close"
            onClick={onClose}
            aria-label={strings.history.close}
          >
            <CloseIcon />
          </button>
        </div>
        {children}
      </aside>
    </>
  );
}
