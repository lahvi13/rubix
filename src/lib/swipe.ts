/** Where a swipe wants to go, or nothing if the drag was not one. */
export type SwipeDirection = 'previous' | 'next';

export interface SwipePoint {
  x: number;
  y: number;
}

export interface SwipeBounds {
  /** Viewport width, for spotting drags that began in the system's margin. */
  width: number;
}

/**
 * A drag has to travel this far across before it counts. Short of it the reader
 * was aiming at something, not swiping.
 */
const MIN_DISTANCE_PX = 60;

/**
 * And it has to be this much more across than down. A sheet scrolls under the
 * thumb, so a drag that is merely more horizontal than vertical would turn
 * ordinary scrolling into skipped pages — which is worse than no swipe at all.
 */
const HORIZONTAL_RATIO = 2;

/**
 * Drags starting this close to either edge belong to the system: on Android the
 * back gesture lives there, and a swipe the system is already eating would read
 * as the app ignoring it.
 */
const EDGE_MARGIN_PX = 24;

/**
 * Reads a finished drag. Pure so the thresholds can be argued with in a table
 * rather than with a thumb.
 */
export function readSwipe(
  start: SwipePoint,
  end: SwipePoint,
  bounds: SwipeBounds,
): SwipeDirection | null {
  if (start.x <= EDGE_MARGIN_PX || start.x >= bounds.width - EDGE_MARGIN_PX) return null;

  const dx = end.x - start.x;
  const dy = end.y - start.y;
  if (Math.abs(dx) < MIN_DISTANCE_PX) return null;
  if (Math.abs(dx) < Math.abs(dy) * HORIZONTAL_RATIO) return null;

  // Dragging leftward pulls the next one in, the way pages move.
  return dx < 0 ? 'next' : 'previous';
}
/**
 * Whether a finished drag was a pull downwards — the gesture for putting a
 * panel that was dragged open back down again.
 *
 * The same thresholds as a sideways swipe, mirrored: far enough to be meant,
 * and decisively more down than across. No margin at the edges, because the
 * gesture that lives there is a sideways one.
 *
 * Whether the list underneath should have scrolled instead is not asked here.
 * That depends on where the list is scrolled to, which the caller knows and
 * this cannot.
 */
export function isPullDown(start: SwipePoint, end: SwipePoint): boolean {
  return isPull(start, end, 1);
}

/** The same drag the other way: the gesture that pulls a panel open. */
export function isPullUp(start: SwipePoint, end: SwipePoint): boolean {
  return isPull(start, end, -1);
}

/** One rule for both, so that what counts as a pull cannot differ by direction. */
function isPull(start: SwipePoint, end: SwipePoint, sign: 1 | -1): boolean {
  const dx = end.x - start.x;
  const dy = (end.y - start.y) * sign;
  if (dy < MIN_DISTANCE_PX) return false;
  return dy >= Math.abs(dx) * HORIZONTAL_RATIO;
}
