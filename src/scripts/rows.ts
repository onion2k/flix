// The page's one script: for each row, shows Previous and Next where the strip
// overflows and hides them where it fits, marks a button aria-disabled at its
// end, and moves the strip a page when one is clicked. What it decides comes
// from paging(); this only reads the strip, sets attributes and calls
// scrollTo, and it brings a card that has keyboard focus wholly into view. It
// builds no markup from a string and sets no style, since the content policy
// refuses both, and it adds three listeners and one observer to each strip,
// once, so nothing it keeps grows. Smoothness is the stylesheet's
// and only where motion is allowed. Without it a row that overflows has no
// buttons, which is the page working without script, not a fault.
import { paging } from '../catalogue/paging';

for (const row of document.querySelectorAll<HTMLElement>('section.row')) {
  const strip = row.querySelector<HTMLElement>('ul.strip');
  const previous = row.querySelector<HTMLButtonElement>(
    'button[data-page="previous"]',
  );
  const next = row.querySelector<HTMLButtonElement>('button[data-page="next"]');
  if (strip === null || previous === null || next === null) continue;

  const read = () =>
    paging({
      scrollLeft: strip.scrollLeft,
      clientWidth: strip.clientWidth,
      scrollWidth: strip.scrollWidth,
    });

  const update = () => {
    const now = read();
    previous.hidden = !now.overflows;
    next.hidden = !now.overflows;
    previous.setAttribute('aria-disabled', String(!now.previous.live));
    next.setAttribute('aria-disabled', String(!now.next.live));
  };

  // A button at its end stays focusable and says so, and does nothing.
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
}
