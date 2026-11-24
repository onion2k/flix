// What the scripts that watch the cards in the window read of the page, said
// once: a box as the rules take it, the window's size, the hero's frame and a
// card's picture. src/scripts/playing.ts (the loop of the card most in focus)
// and src/scripts/shine.ts (the card whose finish shows whole on a touch
// screen) both ask src/catalogue/playing.ts's inFocus which card that is, and
// so both must read the page the same way, or the card shining and the card
// playing could differ. Without it each would carry a copy.
import type { Box, Window } from '../catalogue/playing';

/** The box of an element in the window, as the rule takes it. */
export function boxOf(element: Element): Box {
  const { left, top, right, bottom } = element.getBoundingClientRect();
  return { left, top, right, bottom };
}

/** The window's size without its scrollbars. */
export function windowNow(): Window {
  return {
    width: document.documentElement.clientWidth,
    height: document.documentElement.clientHeight,
  };
}

/** The box of the day's feature picture, or null where there is none. */
export function heroBox(): Box | null {
  const frame = document.querySelector(
    'section.feature:not([hidden]) .feature-frame',
  );
  return frame === null ? null : boxOf(frame);
}

/**
 * The box of a card's picture, or one that is everywhere (so that it never
 * counts as wholly in the window) where the card has none.
 */
export function frameBox(card: Element): Box {
  const picture = card.querySelector('.frame');
  return picture === null
    ? { left: 0, top: 0, right: Infinity, bottom: Infinity }
    : boxOf(picture);
}
