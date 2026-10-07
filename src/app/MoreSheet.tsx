import { Fragment } from 'react';
import { Sheet } from '../components/Sheet';
import { strings } from '../lib/strings';
import { navigate, type Route } from './router';

/** Where the sheet's groups begin, after the first — the menu's own rules. */
const RULE_BEFORE: ReadonlySet<Route> = new Set<Route>(['settings', 'about']);

interface MoreSheetProps {
  /** The screens not on the bar, in the menu's order. */
  routes: readonly Route[];
  route: Route;
  onClose: () => void;
}

/**
 * The screens the bottom bar has no room for, in a sheet that rises from the
 * bar's own edge rather than a menu dropping from the far corner — the point
 * of the bar was that the thumb does not have to travel up there.
 */
export function MoreSheet({ routes, route, onClose }: MoreSheetProps) {
  return (
    <Sheet label={strings.nav.more} className="more-sheet" onClose={onClose}>
      <nav className="more-sheet__list">
        {routes.map((target) => (
          <Fragment key={target}>
            {RULE_BEFORE.has(target) ? <hr className="app__menu-rule" /> : null}
            <button
              type="button"
              className={route === target ? 'is-active' : ''}
              aria-current={route === target ? 'page' : undefined}
              onClick={() => {
                navigate(target);
                onClose();
              }}
            >
              {strings.nav[target]}
            </button>
          </Fragment>
        ))}
      </nav>
    </Sheet>
  );
}
