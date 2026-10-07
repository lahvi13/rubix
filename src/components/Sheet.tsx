import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { useBackToClose } from '../hooks/use-back-to-close';
import { useKeyCapture } from '../hooks/use-key-capture';
import { useSheetDrag } from '../hooks/use-sheet-drag';
import { slideIn, useSwipe } from '../hooks/use-swipe';
import { strings } from '../lib/strings';
import type { SwipeDirection } from '../lib/swipe';
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
  /**
   * Drawn at the end of the bar instead of the cross. Whatever it is, it has
   * to close the panel — the bar's end is where the way out is looked for.
   */
  closeControl?: ReactNode;
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

/**
 * The step just taken, for whichever sheet draws the page it led to. Stepping
 * through solves remounts the sheet, stepping through cases does not; held out
 * here, both find it. Dated, so a step that changed nothing cannot animate a
 * page opened long after.
 */
let pendingStep: { direction: SwipeDirection; at: number } | null = null;
const STEP_FRESH_MS = 1000;

function takeStep(): SwipeDirection | null {
  const step = pendingStep;
  pendingStep = null;
  return step !== null && performance.now() - step.at < STEP_FRESH_MS ? step.direction : null;
}

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
export function Sheet({ label, className, onClose, paging, closeControl, children }: SheetProps) {
  useKeyCapture(true, onClose);
  useBackToClose(onClose);
  const isArriving = useArrival();
  const entering = isArriving ? ' is-entering' : '';

  const panel = useRef<HTMLElement>(null);
  const bar = useRef<HTMLDivElement>(null);
  const scrim = useRef<HTMLButtonElement>(null);
  const drag = useSheetDrag(panel, bar, scrim, onClose);

  const stepper = (direction: SwipeDirection) =>
    (direction === 'next' ? paging?.onNext : paging?.onPrevious) ?? null;
  const step = (direction: SwipeDirection) => {
    const go = stepper(direction);
    if (go === null) return;
    pendingStep = { direction, at: performance.now() };
    go();
  };
  const swipe = useSwipe(panel, (direction) => stepper(direction) !== null, step);

  const position = paging?.position;
  // Before paint, or the new page shows for a frame where it ends up before
  // sliding in from the side.
  useLayoutEffect(() => {
    const direction = takeStep();
    if (direction !== null && panel.current !== null) slideIn(panel.current, direction);
  }, [position]);

  return (
    <>
      <button
        ref={scrim}
        type="button"
        className={`app__scrim sheet-scrim${entering}`}
        aria-label={strings.history.close}
        onClick={onClose}
      />
      <aside
        ref={panel}
        className={className === undefined ? `detail${entering}` : `detail${entering} ${className}`}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        {...(paging === undefined ? {} : swipe)}
      >
        {/* The bar is what a sheet is dragged down by, so it cannot scroll:
            on the scrolling panel the browser claims the drag long before it
            is a pull. The grip says so, and takes a tap as well — the same
            grip the timer's list of solves is put away with. */}
        <div ref={bar} className="sheet__bar" {...drag}>
          <button
            type="button"
            className="sheet__grip"
            tabIndex={-1}
            aria-label={strings.history.close}
            onClick={onClose}
          />
          {paging === undefined ? null : (
            <div className="sheet__pager">
              <button
                type="button"
                className="sheet__step"
                aria-label={strings.sheet.previous}
                disabled={paging.onPrevious === null}
                onClick={() => step('previous')}
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
                onClick={() => step('next')}
              >
                <NextIcon />
              </button>
            </div>
          )}
          {closeControl ?? (
            <button
              type="button"
              className="detail__close"
              onClick={onClose}
              aria-label={strings.history.close}
            >
              <CloseIcon />
            </button>
          )}
        </div>
        {children}
      </aside>
    </>
  );
}
