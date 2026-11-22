// Says, for a mouse pressed on a row's strip, whether the movement since the
// press is a drag yet and where the strip should then be scrolled. It is
// numbers in and numbers out, with no page in it, so that the threshold, the
// direction and the two ends are tried in a unit test. Without it the rule
// would live in the script that handles the pointer, and a drag that began on
// the wrong side of the threshold, or ran the wrong way, or scrolled past the
// end, would be found only by a person with a mouse.

/** A place on the page, in pixels. */
export interface Point {
  x: number;
  y: number;
}

export interface DragInput {
  /** Where the primary button went down. */
  began: Point;
  /** Where the pointer is now. */
  pointer: Point;
  /** The strip's scrollLeft when the button went down. */
  scrolledFrom: number;
  /** The most the strip can scroll: scrollWidth less clientWidth. */
  furthest: number;
  /**
   * True once this press has been a drag: it stays one until the button
   * comes up, however the pointer wanders back, or the strip would jump to
   * where it was each time the hand crossed the threshold.
   */
  begun?: boolean;
}

export interface Dragging {
  /** True once the movement is a drag and not a click that wobbled. */
  dragging: boolean;
  /** Where the strip should be scrolled: where it was, until a drag. */
  scrollLeft: number;
}

/**
 * How far, in pixels, a pressed pointer must travel sideways before it is a
 * drag. A hand pressing a button moves a pixel or two without meaning to, and
 * a click that wobbled must still follow its link; much more than this and a
 * drag would feel as if it had to be dragged to begin.
 */
export const DRAG_THRESHOLD = 6;

export function dragging({
  began,
  pointer,
  scrolledFrom,
  furthest,
  begun = false,
}: DragInput): Dragging {
  const across = pointer.x - began.x;
  const down = pointer.y - began.y;
  // Sideways beyond the threshold, and more sideways than up or down, so that
  // a press that is going downwards to select text is not taken for a drag.
  const drag =
    begun ||
    (Math.abs(across) > DRAG_THRESHOLD && Math.abs(across) > Math.abs(down));
  if (!drag) return { dragging: false, scrollLeft: scrolledFrom };
  // The content follows the hand: the pointer moving left takes the content
  // left, which is a larger scrollLeft. The ends hold it.
  const wanted = scrolledFrom - across;
  return {
    dragging: true,
    scrollLeft: Math.min(Math.max(0, furthest), Math.max(0, wanted)),
  };
}
