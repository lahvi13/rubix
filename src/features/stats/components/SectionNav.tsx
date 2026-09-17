import { useMemo, useRef } from 'react';
import { useCurrentStep } from '../../../hooks/use-current-step';
import { strings } from '../../../lib/strings';

export interface NavSection {
  /** The id of the element the link scrolls to. */
  id: string;
  label: string;
}

interface SectionNavProps {
  sections: readonly NavSection[];
}

/**
 * A row of links to the screen's sections, pinned under the header. The page
 * runs to eight sections on a phone, and the phases at the bottom were a long
 * thumb away from the cards at the top — and back, which is the first link.
 *
 * The link for the section being read is marked, the way the guide marks the
 * step being read: a row of places is no use if it cannot say which one you
 * are in. Nothing is marked while the cards above the first section are still
 * on screen, which is where the page opens.
 */
export function SectionNav({ sections }: SectionNavProps) {
  const nav = useRef<HTMLElement>(null);
  // The screen above builds this list afresh on every render, and the watch
  // below would be torn down and rebuilt with it. Which sections there are is
  // what actually matters, so that is what the list is kept by.
  const fingerprint = sections.map((section) => section.id).join(' ');
  const ids = useMemo(() => fingerprint.split(' '), [fingerprint]);
  const [current, jumpTo] = useCurrentStep(ids, nav);

  return (
    <nav ref={nav} className="stats-nav" aria-label={strings.stats.sections}>
      <button type="button" aria-label={strings.stats.toTop} onClick={scrollToTop}>
        {strings.stats.toTopMark}
      </button>
      {sections.map((section, index) => (
        <button
          key={section.id}
          type="button"
          className={index === current ? 'is-active' : ''}
          aria-current={index === current ? 'true' : undefined}
          onClick={() => jumpTo(index)}
        >
          {section.label}
        </button>
      ))}
    </nav>
  );
}

function scrollToTop() {
  window.scrollTo({
    top: 0,
    behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
  });
}
