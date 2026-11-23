// The page's one script for a row's way along: it gives each row its edge
// arrows (shown where there is more that way, hidden from the accessibility
// tree and the Tab order where there is not), moves the strip a page when one
// is pressed, draws the page marks at the row's top right and writes the words
// that say which page. It marks the row `data-arrows` once it has done so,
// which is what the stylesheet waits for before it hides the strip's
// scrollbar: without script there are no arrows, and a mouse with no sideways
// wheel would have no other way along. What it decides comes from paging();
// this reads the strip, sets attributes and calls scrollTo, and it brings a
// card that has focus wholly into view, as whollyIn() says. Where the cards'
// own width would leave a card the strip rests with wholly in the window
// under an arrow, it draws the row's cards narrower by what trim() says,
// through one custom property on the row (--card-trim, set through the
// CSSOM, which the content policy allows), worked out again whenever the
// strip's size changes. It builds no markup from a string, and it adds four
// listeners and one observer to each strip, and three to the document, once,
// so nothing it keeps grows. Smoothness is the stylesheet's and only where motion is allowed.
// The words in each row are not a live region: a glide would otherwise read
// out a page for every frame it crossed, so they are written only when the
// page changes and are read in their place in the row, on demand. Where an
// arrow press lands is told by the page's one polite live region instead,
// empty until then: it is filled with the row's words only once a press has
// settled (the strip's `scrollend`), and no other scroll, by wheel, drag or
// key, touches it. Without it a row that
// overflows has no arrows and keeps its scrollbar, which is the page working
// without script, not a fault.
import { paging, trim, whollyIn } from '../catalogue/paging';

const live = document.querySelector<HTMLElement>('[data-rows-live]');

// Whether a pointer is pressed and its click has not yet come. A press on a
// card focuses its flip button, and a card brought into view at that moment
// would leave the pointer before the button came up; where the strip jumps,
// as it does for a reader who asked for less motion, the release then falls
// on another card and no click comes, so the card is brought in and never
// flipped. While a press is on, focus brings nothing in: the click flips the
// card, the flip sends focus to its back, and that focus, with the press
// over, brings it in. A key or a click ends it, and so does a press that is
// let go of, so that a drag which comes to no click cannot hold it.
let pressing = false;
document.addEventListener(
  'pointerdown',
  () => {
    pressing = true;
  },
  { capture: true },
);
for (const ends of ['click', 'keydown', 'pointercancel'])
  document.addEventListener(
    ends,
    () => {
      pressing = false;
    },
    { capture: true },
  );

for (const row of document.querySelectorAll<HTMLElement>('section.row')) {
  const strip = row.querySelector<HTMLElement>('ul.strip');
  const previous = row.querySelector<HTMLButtonElement>(
    'button[data-page="previous"]',
  );
  const next = row.querySelector<HTMLButtonElement>('button[data-page="next"]');
  const marks = row.querySelector<HTMLElement>('.row-pages');
  const words = row.querySelector<HTMLElement>('[data-page-words]');
  const title = row.querySelector<HTMLElement>('h2')?.textContent ?? '';
  if (
    strip === null ||
    previous === null ||
    next === null ||
    marks === null ||
    words === null
  )
    continue;

  const read = () =>
    paging({
      scrollLeft: strip.scrollLeft,
      clientWidth: strip.clientWidth,
      scrollWidth: strip.scrollWidth,
      cardWidth: strip.querySelector('li')?.offsetWidth ?? 0,
    });

  /** Hides an arrow, and if it had focus hands it to the strip, so that a keyboard is not sent back to the top of the page. */
  const hide = (arrow: HTMLButtonElement) => {
    if (arrow.hidden) return;
    const had = document.activeElement === arrow;
    arrow.hidden = true;
    if (had) strip.focus({ preventScroll: true });
  };

  const show = (arrow: HTMLButtonElement, live: boolean) => {
    if (live) arrow.hidden = false;
    else hide(arrow);
  };

  const update = () => {
    const now = read();
    show(previous, now.overflows && now.previous.live);
    show(next, now.overflows && now.next.live);

    // One mark a page, made again only when the count changes (a window that
    // is resized), and the lit one moved to the page the strip is on.
    const count = now.overflows ? now.pages : 0;
    if (marks.childElementCount !== count) {
      marks.replaceChildren(
        ...Array.from({ length: count }, () => {
          const mark = document.createElement('span');
          mark.className = 'page-mark';
          return mark;
        }),
      );
    }
    marks.hidden = count === 0;
    for (const [at, mark] of [...marks.children].entries()) {
      if (at === now.page) mark.setAttribute('data-current', '');
      else mark.removeAttribute('data-current');
    }

    // Written only when it changes: the words stay put through the frames of
    // a glide and change once for each page the strip comes to.
    const said =
      count === 0 ? '' : `Page ${now.page + 1} of ${count}, ${title}`;
    if (words.textContent !== said) words.textContent = said;
  };

  // Whether the strip is on its way somewhere an arrow sent it: only then is
  // where it lands told to a screen reader.
  let sent = false;

  const go = (to: number) => {
    if (Math.abs(to - strip.scrollLeft) <= 1) return;
    sent = true;
    strip.scrollTo({ left: to });
    // A browser with no scrollend cannot say when the strip has stopped, so
    // the words of where it is going are given at once.
    if (!('onscrollend' in window) && live !== null) {
      const stops = read().stops;
      let at = 0;
      for (const [index, stop] of stops.entries())
        if (Math.abs(stop - to) < Math.abs((stops[at] ?? 0) - to)) at = index;
      live.textContent = `Page ${at + 1} of ${stops.length}, ${title}`;
      sent = false;
    }
  };

  previous.addEventListener('click', () => {
    const now = read();
    if (now.previous.live) go(now.previous.to);
  });
  next.addEventListener('click', () => {
    const now = read();
    if (now.next.live) go(now.next.to);
  });

  strip.addEventListener('scrollend', () => {
    if (!sent) return;
    sent = false;
    update();
    if (live !== null) live.textContent = words.textContent;
  });

  // A browser scrolls a focused card into view only when none of it shows, so
  // one half cut off at the strip's edge would keep its ring cut off. This
  // brings the whole card in: sideways to its own start (a snap point, so the
  // strip's snapping keeps it there, and as far as the scroll padding says)
  // unless it is wholly in already, as whollyIn() says, and up or down as
  // little as it can, since a tall card's title can be in the window while
  // the rest of it is not.
  strip.addEventListener('focusin', (event) => {
    if (pressing || !(event.target instanceof Element)) return;
    const card = event.target.closest('li');
    if (card === null) return;
    // A DOMRect's edges are getters, which a spread would not copy, so they
    // are named.
    const { left, right } = strip.getBoundingClientRect();
    const padding = parseFloat(getComputedStyle(strip).scrollPaddingLeft) || 0;
    const inline = whollyIn(card.getBoundingClientRect(), {
      left,
      right,
      padding,
    })
      ? 'nearest'
      : 'start';
    card.scrollIntoView({ inline, block: 'nearest' });
  });

  // How much narrower the row's cards are drawn, as trim() says, from the
  // strip as it is drawn now. A card's width before the trim is the width it
  // is drawn at plus the trim it was given. A stacked row (below 340px) has
  // no arrows and its cards are the window's width, so it is given none.
  let cut = 0;
  const fit = () => {
    const card = strip.querySelector('li');
    const style = getComputedStyle(strip);
    const arrow = getComputedStyle(next);
    const wanted =
      card === null || style.flexDirection === 'column'
        ? 0
        : trim({
            window: strip.getBoundingClientRect().width,
            card: card.getBoundingClientRect().width + cut,
            gap: parseFloat(style.columnGap) || 0,
            start: parseFloat(style.paddingLeft) || 0,
            padding: parseFloat(style.scrollPaddingLeft) || 0,
            arrow: Math.max(
              parseFloat(arrow.width) || 0,
              parseFloat(arrow.minWidth) || 0,
            ),
          });
    if (Math.abs(wanted - cut) < 0.01) return;
    cut = wanted;
    if (cut === 0) row.style.removeProperty('--card-trim');
    else row.style.setProperty('--card-trim', `${cut}px`);
  };

  strip.addEventListener('scroll', update, { passive: true });
  new ResizeObserver(() => {
    fit();
    update();
  }).observe(strip);
  fit();
  update();
  row.setAttribute('data-arrows', '');
}
