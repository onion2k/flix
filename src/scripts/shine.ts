// Moves the shine on the best cards (li.card[data-best]). Where the sheen is
// and how far a card tilts is src/catalogue/shine.ts's; this reads the pointer
// and the boxes and sets the four properties the stylesheet draws the foil and
// the tilt from, --shine-x, --shine-y, --tilt-x and --tilt-y, on the card,
// through the CSSOM (style.setProperty), which the content policy allows where
// it refuses a style written as a string. A mouse on a best card (a mouse, where
// the page has one that hovers and points finely) moves the sheen under it and
// tilts the card toward it, and when it leaves the four are taken off, so the
// stylesheet's resting place stands again. Otherwise, on a touch screen or for
// a mouse not on the card, the sheen follows the card's place in the window as
// the page and its strips are scrolled, with no tilt.
//
// It writes at most once a frame (requestAnimationFrame), and listens to the
// scroll and the window only while a best card is in the window (an
// IntersectionObserver says so); a pointer is only heard on a card in the
// window. It writes nothing at load, and nothing ever moves by itself: each
// write answers a reader's scroll or pointer, so there is no idle animation.
// A reader who asked for less motion gets nothing from it at all, and the
// stylesheet's still sheen at its resting place stands, as it does with script
// off. What it keeps is the page's own best cards, the one pointed at and one
// frame asked for, which cannot grow past them.
import { inWindow, underPointer, type Shine } from '../catalogue/shine';
import { lessMotion } from './asked';

const best = [...document.querySelectorAll<HTMLElement>('li.card[data-best]')];

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

if (best.length > 0 && !lessMotion()) {
  const mouse = matchMedia('(hover: hover) and (pointer: fine)');
  /** The best cards in the window now. */
  const seen = new Set<HTMLElement>();
  /** The card a mouse is on, and where, or null. */
  let pointed: { card: HTMLElement; x: number; y: number } | null = null;
  /** The cards to go back to rest on the next frame. */
  const resting = new Set<HTMLElement>();
  /** Whether the next frame places every card in the window by its place. */
  let byPlace = false;
  let frame: number | null = null;

  const draw = (): void => {
    frame = null;
    for (const card of resting) write(card, null);
    resting.clear();
    if (byPlace) {
      byPlace = false;
      const window_ = {
        width: document.documentElement.clientWidth,
        height: document.documentElement.clientHeight,
      };
      for (const card of seen)
        if (card !== pointed?.card)
          write(card, inWindow(card.getBoundingClientRect(), window_));
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
    byPlace = true;
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

  /** Listens to the page while any best card is in the window, and not otherwise. */
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
      }
    }
    if (before === 0 && seen.size > 0) listen(true);
    if (before > 0 && seen.size === 0) listen(false);
    if ((!first || early) && seen.size > 0) scrolled();
    if (first)
      document.removeEventListener('scroll', noteEarly, { capture: true });
    first = false;
  });
  for (const card of best) observer.observe(card);
}
