// Lets a mouse drag a row's strip sideways: with the primary button down on a
// strip that overflows, moving past the threshold marks the strip
// data-dragging and makes its scrollLeft follow the pointer, one for one,
// until the button comes up, when the strip's own scroll snap settles it on a
// card. What counts as a drag, and where the strip goes, comes from
// dragging(); this reads the pointer, sets one attribute and the scroll, and
// holds the pointer with pointer capture once a drag has begun so that it
// keeps the hand if the pointer leaves the strip. Touch and pen are not
// handled at all: a finger or a pen already scrolls a strip natively, and
// taking it over would only fight the browser. The click that follows a drag
// is swallowed once, so that a drag that ends over a card does not follow its
// link, and a press that never passed the threshold is left to be the click it
// is. The browser's own drag of a link or a picture is stopped in a strip that
// overflows (dragstart, here, and not draggable="false" on every picture and
// link, so that the markup is as it was and the page without script is
// unchanged): it would begin as the pointer moved and cancel the pointer
// events, so that a drag over a card could never start. It builds no markup
// from a string and sets no style, since the content policy refuses both, and
// each strip gets its listeners once and keeps one small record of the press
// in hand, so nothing it keeps grows. Nothing here is motion: the strip
// moves under the hand, and the stylesheet turns smooth scrolling and the
// snap off while it does. Without this a mouse can only move a strip by its
// buttons, its wheel or its scrollbar, which is the page as it was.
import { dragging } from '../catalogue/dragging';
import { paging } from '../catalogue/paging';

/** The press in hand: where it began and what it has become. */
interface Press {
  pointerId: number;
  began: { x: number; y: number };
  scrolledFrom: number;
  begun: boolean;
}

for (const strip of document.querySelectorAll<HTMLElement>('ul.strip')) {
  let press: Press | null = null;
  // True from the end of a drag until the click that follows it has been
  // swallowed, or the next press, whichever comes first, so that a drag whose
  // click never arrives cannot eat a later, plain click.
  let swallow = false;

  const overflows = () =>
    paging({
      scrollLeft: strip.scrollLeft,
      clientWidth: strip.clientWidth,
      scrollWidth: strip.scrollWidth,
    }).overflows;

  const end = (event: PointerEvent) => {
    if (press === null || event.pointerId !== press.pointerId) return;
    if (press.begun) {
      strip.removeAttribute('data-dragging');
      // A drag is followed by a click only when the button came up, not when
      // the press was cancelled.
      swallow = event.type === 'pointerup';
    }
    press = null;
  };

  strip.addEventListener('pointerdown', (event) => {
    swallow = false;
    press = null;
    if (event.pointerType !== 'mouse' || event.button !== 0) return;
    if (!event.isPrimary || !overflows()) return;
    press = {
      pointerId: event.pointerId,
      began: { x: event.clientX, y: event.clientY },
      scrolledFrom: strip.scrollLeft,
      begun: false,
    };
  });

  strip.addEventListener('pointermove', (event) => {
    if (press === null || event.pointerId !== press.pointerId) return;
    // The button came up where nothing here could hear it (before the pointer
    // was captured, outside the window): the press is over.
    if ((event.buttons & 1) === 0) {
      press = null;
      return;
    }
    const now = dragging({
      began: press.began,
      pointer: { x: event.clientX, y: event.clientY },
      scrolledFrom: press.scrolledFrom,
      furthest: strip.scrollWidth - strip.clientWidth,
      begun: press.begun,
    });
    if (!now.dragging) return;
    if (!press.begun) {
      press.begun = true;
      // The mark first: the stylesheet turns the snap and smooth scrolling
      // off for it, and the scroll below must meet neither.
      strip.setAttribute('data-dragging', '');
      getSelection()?.removeAllRanges();
      strip.setPointerCapture(event.pointerId);
    }
    strip.scrollLeft = now.scrollLeft;
  });

  strip.addEventListener('pointerup', end);
  strip.addEventListener('pointercancel', end);

  // Capture phase, so that it is ahead of the card link whatever the browser
  // aims the click at.
  strip.addEventListener(
    'click',
    (event) => {
      if (!swallow) return;
      swallow = false;
      event.preventDefault();
      event.stopPropagation();
    },
    true,
  );

  strip.addEventListener('dragstart', (event) => {
    if (overflows()) event.preventDefault();
  });
}
