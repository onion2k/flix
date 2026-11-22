// Says when a hovered or focused card may grow: not until it has been pointed
// at for the pause, with the time handed in as a number of milliseconds. It is
// numbers in and a yes or no out, with no page, no clock and no timer in it, so
// that the pause is tried in a unit test and not by a person with a stopwatch.
// Without it the pause would live in the script that reads the page, and a
// pause of nothing (so that a pointer only passing over a card starts a fetch
// of its loop, and a flicker, for every card on the way) would be found only by
// watching.

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
