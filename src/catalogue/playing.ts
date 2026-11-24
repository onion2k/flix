// Says which card's loop plays, and when the answer has held long enough to
// act on. Boxes in the window's own coordinates and a time in milliseconds are
// handed in, and a card's id comes out, with no page, clock or timer in it, so
// that every case is tried in a unit test and not by a person scrolling. One
// picture moves at a time: while more than half of the hero's frame is in the
// window no card plays, so the first screen fetches no card loop, and once the
// hero is mostly gone the one card in focus does. Without it the rule would
// live in the script that reads the page, and two loops at once, a loop asked
// for under a flipped card or one fetched for every card a reader scrolls past
// would be found only by watching the network.

/**
 * How long the same answer must hold, in ms, before a loop is asked for or a
 * playing one is given to another card. A reader scrolling or a pointer
 * travelling across a row is on each card for a fraction of this; acting at
 * once would fetch a loop for every card on the way. Over half a second is a
 * reader who has stopped.
 */
export const SETTLE_MS = 600;

/**
 * How far, in px, a frame may run past an edge of the window and still count as
 * wholly in it. Boxes are read in fractions of a pixel, and a card brought to
 * a strip's edge by its snap can sit a fraction outside.
 */
const EDGE_PX = 1;

/** A box in the window's own coordinates, in px: the top left is the window's. */
export interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** The window's size in px, without its scrollbars. */
export interface Window {
  width: number;
  height: number;
}

/** What decides whether a card may play, as the page reads it at a moment. */
export interface PlayCard {
  /** The card's name among the page's cards. */
  id: string;
  /** The card has a loop, and it has not failed this visit. */
  hasLoop: boolean;
  /** The card's picture has loaded, so that a loop never plays over an empty frame. */
  arrived: boolean;
  /** The card shows its back, where there is no picture to play over. */
  flipped: boolean;
  /** The box of the card's picture. */
  frame: Box;
}

/**
 * Whether a card may play: it has a loop, its picture has arrived, its front
 * shows, and the whole of its picture's frame is in the window, so that a loop
 * never plays half cut off at a strip's edge or under the window's foot.
 */
export function qualifies(card: PlayCard, window: Window): boolean {
  const { frame } = card;
  return (
    card.hasLoop &&
    card.arrived &&
    !card.flipped &&
    frame.left >= -EDGE_PX &&
    frame.top >= -EDGE_PX &&
    frame.right <= window.width + EDGE_PX &&
    frame.bottom <= window.height + EDGE_PX
  );
}

/**
 * Whether the hero holds the cards still: more than half of its frame's area
 * is in the window. At half, or with no hero, it does not.
 */
export function heroHolds(hero: Box | null, window: Window): boolean {
  if (hero === null) return false;
  const area = (hero.right - hero.left) * (hero.bottom - hero.top);
  if (!(area > 0)) return false;
  const across = Math.max(
    0,
    Math.min(hero.right, window.width) - Math.max(hero.left, 0),
  );
  const down = Math.max(
    0,
    Math.min(hero.bottom, window.height) - Math.max(hero.top, 0),
  );
  return (across * down) / area > 0.5;
}

/**
 * The card whose loop should play, or null for none. None while the hero
 * holds. Otherwise the pointed card (a mouse on it, or keyboard focus in it)
 * where it qualifies. Failing that, where `nearest` is true (the default: a
 * touch screen, which has no pointer to name a card), the qualifying card whose
 * picture's centre is nearest the window's, the earlier in the page on a tie;
 * where it is false (a mouse, which says what it means), none: a card the
 * mouse is not over does not play, and nor does another for one that cannot.
 */
export function inFocus(
  cards: readonly PlayCard[],
  window: Window,
  hero: Box | null,
  pointed: string | null,
  nearest = true,
): string | null {
  if (heroHolds(hero, window)) return null;
  const able = cards.filter((card) => qualifies(card, window));
  const chosen = able.find((card) => card.id === pointed);
  if (chosen !== undefined) return chosen.id;
  if (!nearest) return null;
  let best: string | null = null;
  let least = Number.POSITIVE_INFINITY;
  for (const card of able) {
    const x = (card.frame.left + card.frame.right) / 2 - window.width / 2;
    const y = (card.frame.top + card.frame.bottom) / 2 - window.height / 2;
    const distance = Math.hypot(x, y);
    // Strictly nearer, so that on a tie the earlier card stands.
    if (distance < least) {
      least = distance;
      best = card.id;
    }
  }
  return best;
}

/**
 * Whether an answer that has held for `elapsed` ms may be acted on: from the
 * moment the settle time ends, and not before. A time that is no use (before
 * the answer came, not a number, or without end) is no, so that a bad reading
 * never fetches a loop.
 */
export function settled(elapsed: number): boolean {
  if (!Number.isFinite(elapsed) || elapsed < 0) return false;
  return elapsed >= SETTLE_MS;
}
