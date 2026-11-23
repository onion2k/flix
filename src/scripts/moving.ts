// Moves focus between the page's links by arrow key and by gamepad. With focus
// on a card's link or the feature's link, Left, Right, Up, Down, Home and End
// move it as moveTo() says, and the key's own scrolling is stopped, so that a
// press moves focus and never also scrolls the strip. Where focus is anywhere
// else (a strip, the footer's links, a row arrow) and with Alt, Ctrl, Meta or
// Shift held, the key is the browser's. A gamepad is read only while one is
// connected: gamepadconnected starts one read a frame, which turns the d-pad
// or the left stick into a held direction, fires it as repeating() says, and
// follows the focused link on the first button (see follow()), which opens a
// new window where the link does; gamepaddisconnected stops the loop when no
// pad is left. The stops are read from the page as it is at the
// moment of a move (a row scrolls, so centres change). It builds no markup,
// sets no style, and keeps only the loop's handle and the last frame's small
// record, so nothing it keeps grows. Without it the links can be reached only
// by Tab, one stop at a time, and a gamepad does nothing on the page.
import {
  heldDirection,
  moveTo,
  pressedNow,
  repeating,
  type Move,
  type Repeat,
  type Stop,
} from '../catalogue/moving';

const KEYS: Readonly<Record<string, Move>> = {
  ArrowLeft: 'left',
  ArrowRight: 'right',
  ArrowUp: 'up',
  ArrowDown: 'down',
  Home: 'first',
  End: 'last',
};

// Only the feature that is shown: with a list of features the others are in
// the page, hidden, and a link in one of them must never be found.
const FEATURE_LINK = 'section.feature:not([hidden]) a.button';
const CARD_LINK = 'section.row li.card a.card-link';

/** The grid as it stands: each row's links, and the stops that stand for them. */
function grid(): { links: Map<string, HTMLElement>; rows: Stop[][] } {
  const links = new Map<string, HTMLElement>();
  const rows: Stop[][] = [];
  const add = (row: Stop[], link: HTMLElement, id: string) => {
    // The card is what the reader sees, and the link covers it, so its centre
    // is the same; the link's own box is the one that is certain to be there.
    const box = link.getBoundingClientRect();
    links.set(id, link);
    row.push({ id, centre: box.left + box.width / 2 });
  };
  const feature = document.querySelector<HTMLElement>(FEATURE_LINK);
  rows.push([]);
  if (feature !== null) add(rows[0] ?? [], feature, 'feature');
  document.querySelectorAll('section.row').forEach((section, at) => {
    const row: Stop[] = [];
    section
      .querySelectorAll<HTMLElement>('li.card a.card-link')
      .forEach((link, place) => add(row, link, `row${at}-${place}`));
    rows.push(row);
  });
  return { links, rows };
}

/** Moves focus as asked, from where it is. True where focus is in the grid. */
function move(direction: Move): boolean {
  const here = document.activeElement;
  if (!(here instanceof HTMLElement)) return false;
  if (!here.matches(`${FEATURE_LINK}, ${CARD_LINK}`)) return false;
  const { links, rows } = grid();
  const from = [...links].find(([, link]) => link === here)?.[0];
  if (from === undefined) return false;
  const to = moveTo(rows, from, direction);
  if (to !== null && to !== from) links.get(to)?.focus();
  return true;
}

document.addEventListener('keydown', (event) => {
  if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
  const direction = KEYS[event.key];
  if (direction === undefined) return;
  // In the grid the key is the grid's even where nothing moves, or the page
  // would scroll when a row ended.
  if (move(direction)) event.preventDefault();
});

// The gamepad.

/** Focus goes to the feature's link, or the first linked card without one. */
function enter(): void {
  const first =
    document.querySelector<HTMLElement>(FEATURE_LINK) ??
    document.querySelector<HTMLElement>(CARD_LINK);
  first?.focus();
}

/** The pad to read: the first one connected that has the standard mapping. */
function standardPad(): Gamepad | undefined {
  return [...navigator.getGamepads()].find(
    (pad) => pad !== null && pad.connected && pad.mapping === 'standard',
  ) as Gamepad | undefined;
}

/**
 * Follows a link as a press of the pad's first button, which is not a click,
 * key or touch and may not be taken as one. A link that opens a new window is
 * opened here, and the new window is cut from this one as noopener would cut
 * it. A browser that refuses a window nothing it counts as the reader's asked
 * for gives back null, and then this window goes to the address, so that the
 * press is never lost. A link that does not open a window is clicked.
 */
function follow(link: HTMLAnchorElement): void {
  if (link.target !== '_blank') {
    link.click();
    return;
  }
  const opened = window.open(link.href, '_blank');
  if (opened === null) window.location.assign(link.href);
  else opened.opener = null;
}

let frame: number | null = null;
let repeat: Repeat | null = null;
let wasDown = false;

function read(now: number): void {
  frame = requestAnimationFrame(read);
  const pad = standardPad();
  if (pad === undefined) return;
  const fired = repeating(
    repeat,
    heldDirection(
      pad.buttons.map((button) => button.pressed),
      pad.axes,
    ),
    now,
  );
  repeat = fired.state;
  if (fired.fire !== null && !move(fired.fire)) enter();
  const down = pad.buttons[0]?.pressed === true;
  if (pressedNow(wasDown, down)) {
    const here = document.activeElement;
    if (
      here instanceof HTMLAnchorElement &&
      here.matches(`${FEATURE_LINK}, ${CARD_LINK}`)
    )
      follow(here);
  }
  wasDown = down;
}

window.addEventListener('gamepadconnected', () => {
  if (frame !== null) return;
  repeat = null;
  wasDown = false;
  frame = requestAnimationFrame(read);
});

window.addEventListener('gamepaddisconnected', () => {
  // The browser has taken the pad out of the list by the time this is heard,
  // so another still plugged in keeps the loop.
  if (frame === null || navigator.getGamepads().some((pad) => pad?.connected))
    return;
  cancelAnimationFrame(frame);
  frame = null;
});
