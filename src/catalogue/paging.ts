// Says, from where a row's strip is scrolled, whether it overflows, whether
// the Previous and Next buttons are live and where each would take it. It is
// numbers in and numbers out, with no page in it, so that the end cases are
// tried in a unit test. Without it the rule would live in the script that
// works the buttons, and a button live at an end with nowhere to go would be
// found only by a person looking.

/** What a strip reports of itself: the three numbers a browser gives. */
export interface StripScroll {
  scrollLeft: number;
  clientWidth: number;
  scrollWidth: number;
}

/** One button: whether it works, and the scrollLeft it would move to. */
export interface Direction {
  live: boolean;
  to: number;
}

export interface Paging {
  overflows: boolean;
  previous: Direction;
  next: Direction;
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
  return {
    overflows,
    previous: {
      live: overflows && scrollLeft > TOLERANCE,
      to: Math.max(0, scrollLeft - clientWidth),
    },
    next: {
      live: overflows && furthest - scrollLeft > TOLERANCE,
      to: Math.min(furthest, scrollLeft + clientWidth),
    },
  };
}
