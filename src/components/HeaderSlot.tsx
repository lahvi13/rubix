import { useContext, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { HeaderSlotContext } from './header-slot-context';

/**
 * Draws its children in the header when there is one, and in place when there
 * is not. The header's row is empty to the right of the name on a phone, and
 * a row of the screen's own is height the screen below cannot spare.
 */
export function InHeader({ children }: { children: ReactNode }) {
  const slot = useContext(HeaderSlotContext);
  return slot === null ? children : createPortal(children, slot);
}
