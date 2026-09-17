import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';

/**
 * Which of the sections is being read, and a way to go to one. `-1` until one
 * of them has reached the line: a screen can open with something above its
 * first section — the stats do — and lighting that section up while the reader
 * is still looking at the cards over it would be a lie.
 *
 * Read is the last section whose top has passed a line a fifth of the way down
 * the screen under the pinned row: every section is taller than that, so one
 * jumped to is the one reported, while one only peeking in from below is not.
 *
 * The last sections cannot all be scrolled to the top — the page ends first —
 * so one jumped to stays the answer until the reader scrolls on their own.
 * Geometry alone would name whichever section the bottom of the page shows.
 */
export function useCurrentStep(
  ids: readonly string[],
  nav: RefObject<HTMLElement | null>,
): [number, (index: number) => void] {
  const [current, setCurrent] = useState(0);
  const jumpedTo = useRef<number | null>(null);

  useEffect(() => {
    let frame = 0;

    const measure = () => {
      frame = 0;
      if (jumpedTo.current !== null) return;
      const navBottom = nav.current?.getBoundingClientRect().bottom ?? 0;
      const line = navBottom + (window.innerHeight - navBottom) / 5;
      const scroller = document.documentElement;
      const isAtBottom = scroller.scrollTop + window.innerHeight >= scroller.scrollHeight - 1;

      let read = -1;
      ids.forEach((id, index) => {
        const top = document.getElementById(id)?.getBoundingClientRect().top;
        if (top !== undefined && top <= line) read = index;
      });
      setCurrent(isAtBottom && scroller.scrollTop > 0 ? ids.length - 1 : read);
    };
    const schedule = () => {
      if (frame === 0) frame = requestAnimationFrame(measure);
    };
    // A scroll of the reader's own, as against the smooth one a jump starts.
    const release = () => {
      jumpedTo.current = null;
    };

    measure();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    const handOver = ['wheel', 'touchstart', 'keydown'] as const;
    for (const type of handOver) window.addEventListener(type, release, { passive: true });
    // Steps grow while their cases load and shrink with the explanations off,
    // none of which scrolls.
    const resizes = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(schedule);
    resizes?.observe(document.body);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      for (const type of handOver) window.removeEventListener(type, release);
      resizes?.disconnect();
    };
  }, [ids, nav]);

  const jump = useCallback(
    (index: number) => {
      const id = ids[index];
      if (id === undefined) return;
      jumpedTo.current = index;
      setCurrent(index);
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      document.getElementById(id)?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
    },
    [ids],
  );

  return [current, jump];
}
