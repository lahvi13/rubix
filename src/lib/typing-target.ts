/**
 * Only text entry keeps keys to itself. Buttons and toggles deliberately do
 * not: after tapping the nav or a checkbox, focus stays on that control, and
 * treating it as a typing target would silently swallow every space bar press
 * from then on.
 */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target instanceof HTMLInputElement) {
    return !['checkbox', 'radio', 'button', 'range'].includes(target.type);
  }
  return target.isContentEditable || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT';
}
