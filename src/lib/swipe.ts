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
 * A page turns sooner than that. It follows the finger now, so a short drag
 * no longer leaves the reader guessing whether it took — and at 60 the turn
 * asked for most of a thumb's sweep across a phone.
 */
const PAGE_DISTANCE_PX = 40;

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
  if (Math.abs(dx) < PAGE_DISTANCE_PX) return null;
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

/** How far a finger may wander before the drag has said which way it is going. */
const SLOP_PX = 8;

/**
 * What a drag on a sheet's grip has turned out to be, once it has moved far
 * enough to tell: a pull downwards the sheet should follow, or something else
 * it should leave alone. Null while it is still a tap.
 */
export function readSheetDrag(start: SwipePoint, now: SwipePoint): 'pull' | 'other' | null {
  const dx = now.x - start.x;
  const dy = now.y - start.y;
  if (Math.hypot(dx, dy) < SLOP_PX) return null;
  return dy > 0 && dy >= Math.abs(dx) ? 'pull' : 'other';
}

/**
 * A flick this fast puts the sheet away however short it was. Measured over
 * the last move, in pixels per millisecond — a thrown sheet is thrown at the
 * end of the gesture, not over its average.
 */
const FLICK_PX_PER_MS = 0.5;

/** Short of a flick, the sheet has to be dragged this much of its own height. */
const DISMISS_SHARE = 0.25;

/**
 * Whether a sheet let go of at `draggedPx` below where it rests goes away or
 * springs back. A quarter of the sheet is a decision; less is somebody
 * checking what is underneath, unless they threw it.
 */
export function isSheetDismissed(
  draggedPx: number,
  sheetHeightPx: number,
  velocityPxPerMs: number,
): boolean {
  if (draggedPx < MIN_DISTANCE_PX / 2) return false;
  if (velocityPxPerMs >= FLICK_PX_PER_MS) return true;
  return draggedPx >= Math.max(MIN_DISTANCE_PX, sheetHeightPx * DISMISS_SHARE);
}
