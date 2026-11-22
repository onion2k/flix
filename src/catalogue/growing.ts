// Says when a hovered or focused card may grow, and where its grown copy goes.
// The pause is a yes or no from the time handed in, in milliseconds; the place
// is the card's box and the window's in and the grown card's box out. It is
// numbers in and numbers out, with no page, no clock and no timer in it, so
// that both are tried in a unit test and not by a person with a stopwatch.
// Without it the pause would live in the script that reads the page, and a
// pause of nothing (so that a pointer only passing over a card starts a fetch
// of its loop, and a flicker, for every card on the way) or a grown card that
// ran off the edge of the window would be found only by watching.

/**
 * How long a card is hovered or focused before anything starts, in ms. A
 * pointer travelling across a row passes over each card for a fraction of
 * this; starting at once would fetch a loop, and flicker, for every card on
 * the way. Over half a second is a pointer that has stopped.
 */
export const PAUSE_MS = 600;

/**
 * Whether a card that has been hovered or focused for `elapsed` ms may grow:
 * from the moment the pause ends, and not before. A time that is no use (one
 * before the card was pointed at, or not a number) is no, so that a bad reading
 * never opens a card.
 */
export function pauseOver(elapsed: number): boolean {
  if (Number.isNaN(elapsed)) return false;
  return elapsed >= PAUSE_MS;
}

/** How much wider than its card the grown card is: one and a half times. */
export const GROW = 1.5;

/** How far above the card's top the grown card's top is, in px, so that it opens up and out and not only down. */
export const LIFT = 40;

/** The least room kept between the grown card and each edge of the window, in px. */
export const MARGIN = 16;

/** A box, in px, in the window's own coordinates (the top left is the window's). */
export interface Box {
  left: number;
  top: number;
  width: number;
}

/**
 * How wide the grown copy of a card `cardWidth` wide is, in a window
 * `windowWidth` wide: GROW times the card's, and no wider than the window less
 * its margins, which a window narrower than one and a half cards makes it.
 */
export function grownWidth(cardWidth: number, windowWidth: number): number {
  return Math.min(cardWidth * GROW, windowWidth - 2 * MARGIN);
}

/**
 * Where the grown copy of a card goes, in the window's coordinates: GROW times
 * the card's width, centred on the card and LIFT above its top, then moved to
 * keep MARGIN from every edge of the window. `height` is how tall the grown
 * card is once drawn at that width. A grown card wider than the window less its
 * margins is narrowed to fit, and one taller than the window starts at the top
 * margin and runs off the foot, which is all a window that small can do. Scroll
 * is not here: the caller adds the page's scroll to a result to place the card
 * in the document, so that it follows its card when the page scrolls.
 */
export function placeGrown(
  card: Box,
  window: { width: number; height: number },
  height: number,
): Box {
  const width = grownWidth(card.width, window.width);
  const centred = card.left + card.width / 2 - width / 2;
  const left = Math.max(
    MARGIN,
    Math.min(centred, window.width - width - MARGIN),
  );
  const wanted = card.top - LIFT;
  const top = Math.max(
    MARGIN,
    Math.min(wanted, window.height - height - MARGIN),
  );
  return { left, top, width };
}
