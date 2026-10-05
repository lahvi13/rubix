import { useLayoutEffect, useRef, useState, type RefObject } from 'react';

/*
 * Up decelerates into place, down gets out of the way a little quicker: the
 * list is asked for, and put away when it is done with. Both short enough
 * that a reader who opens it to check one time is never waiting on it.
 */
const OPEN_MS = 260;
const CLOSE_MS = 200;
const OPEN_EASING = 'cubic-bezier(0.2, 0, 0, 1)';
const CLOSE_EASING = 'cubic-bezier(0.3, 0, 1, 1)';

export interface SheetMotion {
  /** On the panel that slides. */
  panel: RefObject<HTMLElement | null>;
  /** On the in-flow slot the panel rests in while it is down. */
  slot: RefObject<HTMLDivElement | null>;
  /**
   * Whether the panel is drawn lifted out of its slot: while it is up, and
   * for as long as it is on its way back down. It cannot drop into the slot
   * the moment it is closed — down there it is only a peek tall, and sliding
   * a peek from the top would show the clock beneath it for the length of the
   * slide.
   */
  isSheet: boolean;
}

/**
 * The list sliding up over the cube and back down, instead of the screen
 * swapping from one layout to the other in a single frame.
 *
 * Only `transform` moves, so the slide is the compositor's work and none of
 * the fifty rows are laid out again on the way. Nothing is measured until the
 * panel actually changes state — the timer screen re-renders every frame
 * while the clock runs, and a rect read on each of those is a layout on each
 * of those.
 *
 * `canAnimate` is for the times the panel goes away because an attempt has
 * taken the screen: it is hidden by then, and a slide nobody sees is a slide
 * still being run. Readers who ask for reduced motion get the old swap.
 */
export function useSheetMotion(isOpen: boolean, canAnimate: boolean): SheetMotion {
  const panel = useRef<HTMLElement>(null);
  const slot = useRef<HTMLDivElement>(null);
  const running = useRef<Animation | null>(null);
  const isFirstRender = useRef(true);
  /** The slot's height while the panel rests in it — the peek. */
  const peekHeight = useRef<number | null>(null);

  /*
   * Decided while rendering, not in an effect: the render that closes the
   * panel has to be the one that keeps it a sheet. Set a frame later, the
   * panel would already have dropped into its slot and been laid out there.
   */
  const [wasOpen, setWasOpen] = useState(isOpen);
  const [isClosing, setClosing] = useState(false);
  if (wasOpen !== isOpen) {
    setWasOpen(isOpen);
    setClosing(!isOpen && canAnimate && isMotionWanted());
  }

  const isSheet = isOpen || isClosing;

  /*
   * The slot is as tall as what rests in it, so lifting the panel out would
   * leave it nothing: the clock above would drop into the room, and the slide
   * back down would aim at a slot with no height. It keeps the peek's height
   * for as long as the panel is away. Watched rather than measured: the timer
   * renders every frame while it runs, and an observer reads layout only when
   * the slot actually changes size.
   */
  useLayoutEffect(() => {
    const rest = slot.current;
    if (rest === null || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry !== undefined && rest.style.minHeight === '') {
        peekHeight.current = entry.borderBoxSize[0]?.blockSize ?? entry.contentRect.height;
      }
    });
    observer.observe(rest);
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    const rest = slot.current;
    if (rest === null) return;
    rest.style.minHeight = isSheet && peekHeight.current !== null ? `${peekHeight.current}px` : '';
  }, [isSheet]);

  useLayoutEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    const sheet = panel.current;
    const rest = slot.current;
    if (sheet === null || rest === null || typeof sheet.animate !== 'function') return;

    // Turned round part-way through a slide, it carries on from where it is
    // on screen rather than jumping to either end first.
    const movingTop = running.current === null ? null : sheet.getBoundingClientRect().top;
    running.current?.cancel();
    running.current = null;

    if (isOpen) {
      if (!canAnimate || !isMotionWanted()) return;
      const restTop = sheet.getBoundingClientRect().top;
      const fromTop = movingTop ?? rest.getBoundingClientRect().top;
      running.current = slide(sheet, fromTop - restTop, 0, OPEN_MS, OPEN_EASING, 'none');
      return;
    }

    if (isClosing) {
      // Still a sheet, so this is the top it rests at while it is up.
      const restTop = sheet.getBoundingClientRect().top;
      const fromTop = movingTop ?? restTop;
      const toTop = rest.getBoundingClientRect().top;
      // Held at the end until the slot takes it, or it would spring back up
      // for the frame between the slide finishing and React catching up.
      const animation = slide(sheet, fromTop - restTop, toTop - restTop, CLOSE_MS, CLOSE_EASING, 'forwards');
      running.current = animation;
      animation.finished.then(
        () => setClosing(false),
        // Cancelled: turned round, or unmounted. Whoever did it owns the panel now.
        () => {},
      );
    }
    // Otherwise the slide down has just finished and the panel is back in its
    // slot, exactly where the slide left it; letting go was all there was to do.
  }, [isOpen, isClosing, canAnimate]);

  return { panel, slot, isSheet };
}

function slide(
  element: HTMLElement,
  fromPx: number,
  toPx: number,
  durationMs: number,
  easing: string,
  fill: FillMode,
): Animation {
  return element.animate(
    [{ transform: `translateY(${fromPx}px)` }, { transform: `translateY(${toPx}px)` }],
    { duration: durationMs, easing, fill },
  );
}

function isMotionWanted(): boolean {
  return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
