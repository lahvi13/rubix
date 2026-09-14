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
 */
export function SectionNav({ sections }: SectionNavProps) {
  return (
    <nav className="stats-nav" aria-label={strings.stats.sections}>
      <button type="button" aria-label={strings.stats.toTop} onClick={scrollToTop}>
        {strings.stats.toTopMark}
      </button>
      {sections.map((section) => (
        <button key={section.id} type="button" onClick={() => scrollToSection(section.id)}>
          {section.label}
        </button>
      ))}
    </nav>
  );
}

function scrollToSection(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: scrollBehaviour(), block: 'start' });
}

function scrollToTop() {
  window.scrollTo({ top: 0, behavior: scrollBehaviour() });
}

function scrollBehaviour(): ScrollBehavior {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
}
