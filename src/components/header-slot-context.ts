import { createContext } from 'react';

/**
 * The place in the app's header, beside the screen's name, that a screen may
 * put a control of its own into. Null until the header has been drawn, and
 * wherever there is no header at all — a screen rendered on its own in a test.
 */
export const HeaderSlotContext = createContext<HTMLElement | null>(null);
