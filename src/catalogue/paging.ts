// Says, from where a row's strip is scrolled, whether it overflows, whether
// the Previous and Next arrows are live and where each would take it, and how
// where the row's stops are: its pages, which are the places the arrows take
// it, the marks that are drawn and the lit one; and whether a focused card is
// wholly in its strip's window. It is numbers in and numbers out, with no page in it, so
// that the end cases are tried in a unit test. Without it the rule would live
// in the script that works the arrows, and an arrow live at an end with
// nowhere to go, or a page mark that said the wrong page, would be found only
// by a person looking.

/** What a strip reports of itself: the three numbers a browser gives. */
export interface StripScroll {
  scrollLeft: number;
  clientWidth: number;
  scrollWidth: number;
  /** One card's width, which says how little of a strip is too little to be a page. */
  cardWidth: number;
}

/** One arrow: whether it works, and the scrollLeft it would move to. */
export interface Direction {
  live: boolean;
  to: number;
}

export interface Paging {
  overflows: boolean;
  previous: Direction;
  next: Direction;
  /** The places the arrows take the strip, as scrollLeft: from 0, ending at the furthest. */
  stops: number[];
  /** How many stops there are, and so marks: one where the strip fits. */
  pages: number;
  /** The stop the strip is at or nearest, counted from 0, and always one that exists. */
  page: number;
}

// A browser rounds these three numbers separately, so a strip at its end can
// read a pixel short of it. A pixel is forgiven at each end, and in deciding
// whether a strip overflows at all.
const TOLERANCE = 1;

export function paging({
  scrollLeft,
  clientWidth,
  scrollWidth,
  cardWidth,
}: StripScroll): Paging {
  const furthest = Math.max(0, scrollWidth - clientWidth);
  const overflows = scrollWidth - clientWidth > TOLERANCE;
  const next = furthest - scrollLeft > TOLERANCE;
  const previous = scrollLeft > TOLERANCE;

  // The stops: the start, then a window on at a time, and the end. A stop with
  // less than a card of strip left after it is not kept: the end is the stop
  // in its place, since the strip would come to rest there anyway, and so no
  // mark is a place the arrows cannot take it.
  const stops = [0];
  if (overflows && clientWidth > 0) {
    for (
      let at = clientWidth;
      at < furthest && furthest - at >= cardWidth;
      at += clientWidth
    )
      stops.push(at);
    stops.push(furthest);
  }

  // A strip comes to rest on a card's start, which is short of a stop or past
  // it by less than a card, so a stop is passed when the strip is within a
  // card of it: Next goes to the first stop a card or more ahead, and
  // Previous to the last a card or more behind, and the end or the start where
  // there is none.
  const ahead = stops.find((stop) => stop > scrollLeft + cardWidth);
  const behind = stops.findLast((stop) => stop < scrollLeft - cardWidth);

  let page = 0;
  stops.forEach((stop, at) => {
    if (Math.abs(stop - scrollLeft) < Math.abs((stops[page] ?? 0) - scrollLeft))
      page = at;
  });

  return {
    overflows,
    stops,
    pages: stops.length,
    page,
    previous: {
      live: overflows && previous,
      to: behind ?? 0,
    },
    next: {
      live: overflows && next,
      to: ahead ?? furthest,
    },
  };
}

/** A card's two edges, or a strip's window and its scroll padding, in pixels. */
export interface Edges {
  left: number;
  right: number;
}

/**
 * Whether a card is wholly inside its strip's window, less the scroll padding
 * at each side, forgiving the browser's pixel of rounding. A card that is not
 * is brought in to its own start by the script, which is a snap point: a
 * smaller move, to the nearest edge, is pulled back out by the strip's
 * snapping where the window holds only a card and a half, as on a phone.
 */
export function whollyIn(
  card: Edges,
  view: Edges & { padding: number },
): boolean {
  return (
    card.left >= view.left + view.padding - TOLERANCE &&
    card.right <= view.right - view.padding + TOLERANCE
  );
}
