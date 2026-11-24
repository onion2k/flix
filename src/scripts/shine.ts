// Moves the shine on the cards (li.card[data-finish], every card). Where the
// sheen is and how far a card tilts is src/catalogue/shine.ts's, and which card
// is in focus is src/catalogue/playing.ts's inFocus; this reads the pointer and
// the boxes and sets the four properties the stylesheet draws the finish and
// the tilt from, --shine-x, --shine-y, --tilt-x and --tilt-y, on the card,
// through the CSSOM (style.setProperty), which the content policy allows where
// it refuses a style written as a string.
//
// A mouse (the page has one that hovers and points finely) moves the sheen of
// the card it is on, under it, and tilts the card toward it; when it leaves the
// four are taken off, so the stylesheet's resting place stands again. Nothing
// else moves: a mouse's scroll leaves every card at rest.
//
// Where there is no mouse (a touch screen) only the card in focus moves, and
// shows whole: the one inFocus picks from the cards in the window, fed as the
// loops' own rule is (the same boxes, src/scripts/reading.ts) but with every
// card said to have a loop and its picture to have arrived, since a card shines
// without either, and nobody pointed at. It is marked data-foil-focus, one at
// most at a time, which the stylesheet shows whole (its --foil-on, which eases),
// and its sheen is written from its place in the window, at each frame of a
// scroll, with no tilt. No settle time: it follows the scroll live. The card
// that loses focus is marked no more and has its sheen taken off, so it is
// back at rest; every other card is never written to. None is in focus while
// the hero holds the window.
//
// It writes at most once a frame (requestAnimationFrame), and listens to the
// scroll and the window only while some card is in the window (an
// IntersectionObserver says so); a pointer is only heard on a card in the
// window. A frame reads the boxes of the cards in the window alone (a few: two
// or three to a row, one or two rows), the hero's and the window's, and never
// those of the nineteen. It writes nothing at load, and nothing ever moves by
// itself: each write answers a reader's scroll or pointer, so there is no idle
// animation. A reader who asked for less motion gets nothing from it at all,
// and the stylesheet's resting sheen stands, as it does with script off. What
// it keeps is the page's own cards, the one pointed at, the one in focus and
// one frame asked for, which cannot grow past them.
import { inFocus, type PlayCard } from '../catalogue/playing';
import { inWindow, underPointer, type Shine } from '../catalogue/shine';
import { lessMotion } from './asked';
import { frameBox, heroBox, windowNow } from './reading';

const cards = [
  ...document.querySelectorAll<HTMLElement>('li.card[data-finish]'),
];

/** Writes a shine on a card, or takes it off (null) so that the resting place stands. */
function write(card: HTMLElement, shine: Shine | null): void {
  if (shine === null) {
    for (const name of ['--shine-x', '--shine-y', '--tilt-x', '--tilt-y'])
      card.style.removeProperty(name);
    return;
  }
  card.style.setProperty('--shine-x', String(shine.x));
  card.style.setProperty('--shine-y', String(shine.y));
  card.style.setProperty('--tilt-x', `${shine.tiltX}deg`);
  card.style.setProperty('--tilt-y', `${shine.tiltY}deg`);
}

if (cards.length > 0 && !lessMotion()) {
  const mouse = matchMedia('(hover: hover) and (pointer: fine)');
  /** The cards in the window now. */
  const seen = new Set<HTMLElement>();
  /** The card a mouse is on, and where, or null. */
  let pointed: { card: HTMLElement; x: number; y: number } | null = null;
  /** The card in focus where there is no mouse, or null. */
  let focus: HTMLElement | null = null;
  /** The cards to go back to rest on the next frame. */
  const resting = new Set<HTMLElement>();
  /** Whether the next frame works out the card in focus. */
  let following = false;
  let frame: number | null = null;

  /** Takes a card out of focus, and its sheen off. */
  const lose = (card: HTMLElement): void => {
    card.removeAttribute('data-foil-focus');
    write(card, null);
  };

  /** Works out the card in focus and puts its sheen where its place says. */
  const follow = (): void => {
    const size = windowNow();
    const asked: PlayCard[] = [...seen].map((card) => ({
      id: String(cards.indexOf(card)),
      hasLoop: true,
      arrived: true,
      flipped: card.hasAttribute('data-flipped'),
      frame: frameBox(card),
    }));
    const id = inFocus(asked, size, heroBox(), null);
    const next = id === null ? null : (cards[Number(id)] ?? null);
    if (focus !== next) {
      if (focus !== null) lose(focus);
      focus = next;
      focus?.setAttribute('data-foil-focus', '');
    }
    if (focus !== null)
      write(focus, inWindow(focus.getBoundingClientRect(), size));
  };

  const draw = (): void => {
    frame = null;
    for (const card of resting) write(card, null);
    resting.clear();
    if (following) {
      following = false;
      // A mouse's page is moved by its pointer alone.
      if (!mouse.matches) follow();
    }
    if (pointed !== null)
      write(
        pointed.card,
        underPointer(pointed, pointed.card.getBoundingClientRect()),
      );
  };

  const schedule = (): void => {
    if (frame === null) frame = requestAnimationFrame(draw);
  };

  const scrolled = (): void => {
    if (mouse.matches) return;
    following = true;
    schedule();
  };

  const moved = (event: PointerEvent): void => {
    if (event.pointerType !== 'mouse' || !mouse.matches) return;
    if (!(event.currentTarget instanceof HTMLElement)) return;
    pointed = { card: event.currentTarget, x: event.clientX, y: event.clientY };
    schedule();
  };

  const left = (event: PointerEvent): void => {
    if (pointed === null || pointed.card !== event.currentTarget) return;
    resting.add(pointed.card);
    pointed = null;
    schedule();
  };

  /** Listens to the page while any card is in the window, and not otherwise. */
  const listen = (on: boolean): void => {
    const how = on ? 'addEventListener' : 'removeEventListener';
    // A scroll of the page or of any strip: scroll does not bubble, so it is
    // heard on its way down.
    document[how]('scroll', scrolled, { capture: true });
    window[how]('resize', scrolled);
  };

  // The first answer says what is in the window at load, and moves nothing:
  // only a reader's scroll or pointer does. Later answers are a scroll that
  // has brought a card in, or taken it out. Under load a reader can scroll
  // before the first answer comes, while nothing listens yet, so a scroll
  // then is noted and the first answer acts on it.
  let first = true;
  let early = false;
  const noteEarly = (): void => {
    early = true;
  };
  document.addEventListener('scroll', noteEarly, { capture: true });
  const observer = new IntersectionObserver((entries) => {
    const before = seen.size;
    for (const entry of entries) {
      const card = entry.target as HTMLElement;
      if (entry.isIntersecting) {
        if (!seen.has(card)) {
          seen.add(card);
          card.addEventListener('pointermove', moved);
          card.addEventListener('pointerleave', left);
        }
      } else if (seen.delete(card)) {
        card.removeEventListener('pointermove', moved);
        card.removeEventListener('pointerleave', left);
        if (pointed?.card === card) pointed = null;
        // Out of the window: no longer in focus.
        if (focus === card) {
          lose(card);
          focus = null;
        }
      }
    }
    if (before === 0 && seen.size > 0) listen(true);
    if (before > 0 && seen.size === 0) listen(false);
    if ((!first || early) && seen.size > 0) scrolled();
    if (first)
      document.removeEventListener('scroll', noteEarly, { capture: true });
    first = false;
  });
  for (const card of cards) observer.observe(card);

  // A card turned over has no picture to shine on: the focus is worked out
  // again, which is a change and not an idle frame.
  new MutationObserver(() => {
    if (seen.size > 0) scrolled();
  }).observe(document.querySelector('main') ?? document.body, {
    subtree: true,
    attributes: true,
    attributeFilter: ['data-flipped'],
  });
}
