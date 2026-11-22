// Says which of a card's previews shows, from how long the card has been
// hovered or focused, with the time handed in as a number of milliseconds. It
// is numbers in and out, with no page, no clock and no timer in it, so that
// the pause, each turn, the end and the five-second ceiling are tried in a
// unit test and not by a person with a stopwatch. Without it the pass would
// live in the script that reads the page, and a pause of nothing (so that a
// pointer only passing over a card starts a fetch), a pass that never ended
// (WCAG 2.2.2 wants anything that moves on its own for over five seconds to be
// stoppable, and a pass this short needs no control) or one that came round
// again would be found only by watching.

/**
 * How many previews a card may have. Four keeps a whole pass under five
 * seconds with the pause and the turns below, which is what lets it need no
 * pause control, and it is all a card's strip of pictures can say.
 */
export const MAX_PREVIEWS = 4;

/**
 * How long a card is hovered or focused before anything starts, in ms. A
 * pointer travelling across a row passes over each card for a fraction of
 * this; starting at once would fetch pictures, and flicker, for every card on
 * the way. Over half a second is a pointer that has stopped.
 */
export const PAUSE_MS = 600;

/**
 * How long each preview shows, in ms: long enough to read a still at a
 * glance, short enough that four and the pause are under five seconds.
 */
export const EACH_MS = 1000;

/** Whether a count is one a card can play: a whole number, one to the most. */
function playable(count: number): boolean {
  return Number.isInteger(count) && count >= 1 && count <= MAX_PREVIEWS;
}

/**
 * How long a whole pass is, in ms, for a card with `count` previews: the pause
 * and then each in turn. Nothing (0) for a count that cannot play. With the
 * most, 4600, which is under the 5000 that WCAG 2.2.2 names.
 */
export function passLength(count: number): number {
  return playable(count) ? PAUSE_MS + count * EACH_MS : 0;
}

/**
 * The place, from 0, of the preview that shows `elapsed` ms after the card was
 * hovered or focused, or null where the card's own picture shows: during the
 * pause, after the last, and for a count or a time that is no use. After the
 * last it is null for good: the pass is not repeated, and a card left hovered
 * rests.
 */
export function previewAt(elapsed: number, count: number): number | null {
  if (!playable(count)) return null;
  if (Number.isNaN(elapsed) || elapsed < PAUSE_MS) return null;
  const at = Math.floor((elapsed - PAUSE_MS) / EACH_MS);
  return at < count ? at : null;
}
