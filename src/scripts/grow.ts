// Grows a card: a mouse that has stopped on a linked card, or keyboard focus
// on its link, opens an enlarged copy of the card over its row after the pause
// (growing.ts says when, and where the copy goes; the time is each frame's
// timestamp, handed to the rule). The copy is a picture of the card and not a
// second control: it is hidden from the accessibility tree, nothing in it takes
// focus, and a click on it is the real card's link being followed. In it plays
// the card's loop, muted, looping and inline, or the card's own picture where
// it has none. It is built from the card itself, by cloning the card's words
// and writing no markup from a string (the content policy's Trusted Types
// would refuse one), and it is taken down, not hidden, when it closes: it
// closes at once when the pointer leaves it and its card, when focus leaves
// the link, on Escape, when its strip scrolls and on resize, and only one is
// open at a time. It follows its card when the page scrolls because it is
// placed in the document and not the window.
//
// The loop is fetched the first time a card opens, never before: the address is
// an attribute on the card until then, and the video is made with its src when
// the card opens and has none the rest of the time. Nothing happens, and
// nothing is fetched, where the reader asked for less motion; with Save-Data
// on the copy opens with the picture and asks for no loop; for touch (only a
// mouse where a pointer hovers, and focus a keyboard made visible, start it);
// for a card that is not a link, which is not a control; and while the card's
// own picture has not arrived. It runs on requestAnimationFrame only while
// the pause is being counted, keeps one small record of what is pending and
// one of what is open, and removes what it made, so nothing it keeps grows.
// Without it a card does nothing when pointed at and the page loses nothing.
import { grownWidth, pauseOver, placeGrown } from '../catalogue/growing';

/** What is open: the real card and the copy over it. */
interface Open {
  card: HTMLElement;
  copy: HTMLElement;
}

/** What is waiting out the pause: the card, when the count began, and the frame asked for. */
interface Pending {
  card: HTMLElement;
  began: number | null;
  frame: number;
}

const CARDS = [
  ...document.querySelectorAll<HTMLElement>('li.card[data-linked]'),
];

/** The card a mouse is on, and the one whose link has visible focus. */
let hovered: HTMLElement | null = null;
let focused: HTMLElement | null = null;
let pending: Pending | null = null;
let open: Open | null = null;
/**
 * The card an Escape took the copy of, which the browser's own pointer events
 * would open again (it sends a new pointerenter to a card the pointer is still
 * on once the copy is gone). It is let go when the pointer really leaves it.
 */
let escaped: HTMLElement | null = null;

const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const hovers = matchMedia('(hover: hover) and (pointer: fine)');

/** Whether the reader asked for the data to be spared. */
function saveData(): boolean {
  const connection = (
    navigator as Navigator & { connection?: { saveData?: boolean } }
  ).connection;
  return connection?.saveData === true;
}

/** The picture a card draws, which a late card has not been given until its row is near. */
function pictureOf(card: HTMLElement): HTMLImageElement | null {
  return card.querySelector<HTMLImageElement>('.frame img');
}

/** Whether an image has arrived and can be drawn. */
function drawn(image: HTMLImageElement | null): image is HTMLImageElement {
  return image !== null && image.complete && image.naturalWidth > 0;
}

/** Whether a card is in the window at all: a copy of one that is not would hang over nothing. */
function inWindow(card: HTMLElement): boolean {
  const box = card.getBoundingClientRect();
  return (
    box.right > 0 &&
    box.left < innerWidth &&
    box.bottom > 0 &&
    box.top < innerHeight
  );
}

/** Whether this reader and this card allow a copy to be made. */
function allowed(card: HTMLElement): boolean {
  if (reduced.matches) return false;
  return drawn(pictureOf(card)) && inWindow(card);
}

/** The card's words as the copy shows them, cloned from the card and not written. */
function words(card: HTMLElement): Node[] {
  const made: Node[] = [];
  const label = card.querySelector('.label')?.cloneNode(true);
  if (label !== undefined) made.push(label);
  const title = card.querySelector('h3')?.cloneNode(true);
  if (title instanceof HTMLElement) {
    // The link's own words stay, and the link does not: a link in the copy
    // would be a second control.
    for (const link of title.querySelectorAll('a'))
      link.replaceWith(...link.childNodes);
    made.push(title);
  }
  const description = card.querySelector('.description')?.cloneNode(true);
  if (description !== undefined) made.push(description);
  // The Play link's look, with the icon that says it opens a window, which is
  // the one the card's label line already draws.
  const play = document.createElement('span');
  play.className = 'button grown-play';
  play.append(document.createTextNode(card.dataset['play'] ?? ''));
  const icon = card.querySelector('.label svg')?.cloneNode(true);
  if (icon !== undefined) play.append(icon);
  made.push(play);
  return made;
}

/** The picture area of the copy: the card's own picture, and over it the loop where there is one. */
function frameOf(card: HTMLElement, still: HTMLImageElement): HTMLElement {
  const frame = document.createElement('div');
  frame.className = 'grown-frame';
  const picture = document.createElement('img');
  picture.alt = '';
  picture.decoding = 'async';
  // The file the card already shows, so that growing asks for no picture.
  picture.src = still.currentSrc;
  frame.append(picture);
  const loop = card.dataset['loop'];
  if (loop !== undefined && !saveData()) {
    const video = document.createElement('video');
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    video.src = loop;
    frame.append(video);
    // A refusal (autoplay policy, a codec) leaves the picture showing, and is
    // not an error worth the console.
    video.play().catch(() => undefined);
  }
  return frame;
}

/** Takes the copy down and lets go of its loop, so that nothing plays out of sight. */
function close(): void {
  if (open === null) return;
  const { card, copy } = open;
  open = null;
  card.removeAttribute('data-grown');
  for (const video of copy.querySelectorAll('video')) {
    video.pause();
    video.removeAttribute('src');
    video.load();
  }
  copy.remove();
}

/** Stops counting the pause. */
function cancel(): void {
  if (pending !== null) cancelAnimationFrame(pending.frame);
  pending = null;
}

/** Makes the copy of a card, places it, and shows it. */
function grow(card: HTMLElement): void {
  const link = card.querySelector<HTMLAnchorElement>('a.card-link');
  const still = pictureOf(card);
  if (link === null || !drawn(still) || !allowed(card)) return;
  const copy = document.createElement('div');
  copy.className = 'grown';
  copy.setAttribute('aria-hidden', 'true');
  copy.dataset['for'] = card.dataset['entry'] ?? '';
  const text = document.createElement('div');
  text.className = 'grown-words';
  text.append(...words(card));
  copy.append(frameOf(card, still), text);
  if (link.matches(':focus-visible')) copy.dataset['focused'] = '';
  // A click anywhere on it is the card's own link followed: a new window, as
  // the card's does.
  copy.addEventListener('click', () => link.click());
  copy.addEventListener('pointerleave', (event) => {
    if (
      event.relatedTarget instanceof Node &&
      card.contains(event.relatedTarget)
    )
      return;
    if (hovered === card) hovered = null;
    reconcile();
  });
  // Measured at the width it will have, then placed: the window's own
  // coordinates from the rule, plus the page's scroll, so that the copy is in
  // the document and goes with its card when the page scrolls.
  const box = card.getBoundingClientRect();
  const window = { width: innerWidth, height: innerHeight };
  copy.style.width = `${grownWidth(box.width, window.width)}px`;
  document.body.append(copy);
  const placed = placeGrown(
    { left: box.left, top: box.top, width: box.width },
    window,
    copy.offsetHeight,
  );
  copy.style.left = `${placed.left + scrollX}px`;
  copy.style.top = `${placed.top + scrollY}px`;
  card.setAttribute('data-grown', '');
  open = { card, copy };
}

/** One frame of the pause: the rule says whether it is over, and the frame is asked for again until it is. */
function tick(now: number): void {
  if (pending === null) return;
  pending.began ??= now;
  if (pauseOver(now - pending.began)) {
    const { card } = pending;
    pending = null;
    grow(card);
    return;
  }
  pending.frame = requestAnimationFrame(tick);
}

/** Starts counting the pause for a card, if this reader and card allow a copy. */
function arm(card: HTMLElement): void {
  if (!allowed(card)) return;
  pending = { card, began: null, frame: requestAnimationFrame(tick) };
}

/** Brings what is open into line with what is hovered or focused. */
function reconcile(): void {
  const wanted = hovered ?? focused;
  if (wanted === (open?.card ?? pending?.card ?? null)) return;
  cancel();
  close();
  if (wanted !== null) arm(wanted);
}

/** Takes down what is open and forgets what was pointed at, for a reader who said no. */
function dismiss(): void {
  cancel();
  close();
  hovered = null;
  focused = null;
}

/** Escape: takes the copy down, and keeps it down until the pointer has left its card. */
function escape(): void {
  escaped = open?.card ?? pending?.card ?? hovered ?? focused;
  dismiss();
}

for (const card of CARDS) {
  card.addEventListener('pointerenter', (event) => {
    // A mouse, on a screen where a pointer hovers: a touch's pointerenter, and
    // a pen's, are not a reader who has stopped on a card.
    if (event.pointerType !== 'mouse' || !hovers.matches) return;
    if (escaped === card) return;
    hovered = card;
    reconcile();
  });
  card.addEventListener('pointerleave', (event) => {
    // On to its own copy is still on the card.
    if (
      open?.card === card &&
      event.relatedTarget instanceof Node &&
      open.copy.contains(event.relatedTarget)
    )
      return;
    if (escaped === card) escaped = null;
    if (hovered !== card) return;
    hovered = null;
    reconcile();
  });
  card.addEventListener('focusin', (event) => {
    const target = event.target;
    // Focus a keyboard (or a script after one) put on the link, which is what
    // :focus-visible says; a tap that focuses it does not.
    if (
      !(target instanceof HTMLElement) ||
      !target.matches('a.card-link:focus-visible')
    )
      return;
    escaped = null;
    focused = card;
    reconcile();
  });
  card.addEventListener('focusout', () => {
    if (focused !== card) return;
    focused = null;
    reconcile();
  });
}

// A strip that scrolls takes the copy of its card down at once, since the card
// has moved from under it, and starts the pause again for a card that is still
// pointed at and in the window (a keyboard's focus brings a cut-off card in
// with a glide, which would otherwise end every copy before it opened).
for (const strip of document.querySelectorAll<HTMLElement>('.strip')) {
  strip.addEventListener(
    'scroll',
    () => {
      const card = open?.card ?? pending?.card ?? null;
      if (card === null || card.closest('.strip') !== strip) return;
      cancel();
      close();
      arm(card);
    },
    { passive: true },
  );
}

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') escape();
});
addEventListener('resize', dismiss);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) dismiss();
});
reduced.addEventListener('change', dismiss);
