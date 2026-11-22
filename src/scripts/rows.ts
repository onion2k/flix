// The page's one script for a row's way along: it gives each row its edge
// arrows (shown where there is more that way, hidden from the accessibility
// tree and the Tab order where there is not), moves the strip a page when one
// is pressed, draws the page marks at the row's top right and writes the words
// that say which page. It marks the row `data-arrows` once it has done so,
// which is what the stylesheet waits for before it hides the strip's
// scrollbar: without script there are no arrows, and a mouse with no sideways
// wheel would have no other way along. What it decides comes from paging();
// this reads the strip, sets attributes and calls scrollTo, and it brings a
// card that has keyboard focus wholly into view. It builds no markup from a
// string and sets no style, since the content policy refuses both, and it adds
// three listeners and one observer to each strip, once, so nothing it keeps
// grows. Smoothness is the stylesheet's and only where motion is allowed.
// The words are not a live region: a glide would otherwise read out a page
// for every frame it crossed, so they are written only when the page changes
// and are read in their place in the row, on demand. Without it a row that
// overflows has no arrows and keeps its scrollbar, which is the page working
// without script, not a fault.
import { paging } from '../catalogue/paging';

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

  previous.addEventListener('click', () => {
    const now = read();
    if (now.previous.live) strip.scrollTo({ left: now.previous.to });
  });
  next.addEventListener('click', () => {
    const now = read();
    if (now.next.live) strip.scrollTo({ left: now.next.to });
  });

  // A browser scrolls a focused card into view only when none of it shows, so
  // one half cut off at the strip's edge would keep its ring cut off. This
  // brings the whole card in, as little as it can (and as far as the strip's
  // scroll padding says), and does nothing for a card already wholly in.
  strip.addEventListener('focusin', (event) => {
    if (!(event.target instanceof Element)) return;
    event.target
      .closest('li')
      ?.scrollIntoView({ inline: 'nearest', block: 'nearest' });
  });

  strip.addEventListener('scroll', update, { passive: true });
  new ResizeObserver(update).observe(strip);
  update();
  row.setAttribute('data-arrows', '');
}
