// Says, from where a row's strip is scrolled, whether it overflows, whether
// the Previous and Next arrows are live and where each would take it, and how
// many pages the strip has and which one it is on (a page is the window, as
// Next takes it). It is numbers in and numbers out, with no page in it, so
// that the end cases are tried in a unit test. Without it the rule would live
// in the script that works the arrows, and an arrow live at an end with
// nowhere to go, or a page mark that said the wrong page, would be found only
// by a person looking.

/** What a strip reports of itself: the three numbers a browser gives. */
export interface StripScroll {
  scrollLeft: number;
  clientWidth: number;
  scrollWidth: number;
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
  /** How many pages the strip has: one where it fits. */
  pages: number;
  /** The page the strip is on, counted from 0, and always one that exists. */
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
}: StripScroll): Paging {
  const furthest = Math.max(0, scrollWidth - clientWidth);
  const overflows = scrollWidth - clientWidth > TOLERANCE;
  // A page is the window, so the way to the end is that many pages and a part
  // of one more. The pixel forgiven at the end is forgiven here too, or a
  // strip a pixel over a whole number of pages would show a page of no width.
  const pages =
    overflows && clientWidth > 0
      ? 1 + Math.ceil((furthest - TOLERANCE) / clientWidth)
      : 1;
  const next = furthest - scrollLeft > TOLERANCE;
  const previous = scrollLeft > TOLERANCE;
  // The nearest page by position, except that the two ends are the first and
  // last page however short: the end of a strip that is two and a half
  // windows wide is only one and a half in, and would round to the middle.
  let page = 0;
  if (overflows && clientWidth > 0) {
    if (!next) page = pages - 1;
    else if (previous)
      page = Math.min(pages - 1, Math.round(scrollLeft / clientWidth));
  }
  return {
    pages,
    page,
    overflows,
    previous: {
      live: overflows && previous,
      to: Math.max(0, scrollLeft - clientWidth),
    },
    next: {
      live: overflows && next,
      to: Math.min(furthest, scrollLeft + clientWidth),
    },
  };
}
