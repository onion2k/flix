// Works the header's Surprise me button: it picks one playable card (a card
// with a link) and moves focus to that card's link, which the strip's own
// focusin handler (rows.ts) brings wholly into view and the stylesheet rings.
// It follows no link. It never picks the card that had focus when the button
// was pressed, nor the one it picked last, and the button is shown only
// where there are at least two playable cards, since with one there is
// nothing to be surprised by. What it picks comes from chance.ts and only
// from there: the seed is a test's, handed in on window.ooerflixSeed before
// this runs and checked by seedFrom() since it comes from outside, or else
// the clock's reading when the page starts, which is the one place the clock
// is read. This is also the one place the generator is made and kept, so
// that a page has one run of chance. It builds no markup, sets no style, adds
// no animation, stores nothing, and keeps two small values, so nothing it
// keeps grows. Without it the button stays hidden and the page loses nothing.
import { pick, seeded, seedFrom } from '../catalogue/chance';

declare global {
  interface Window {
    /** The test API for chance: an integer seed, handed in before the page's
     *  scripts run. Anything else is ignored and the clock is used. */
    ooerflixSeed?: unknown;
  }
}

const button = document.querySelector<HTMLButtonElement>(
  'button[data-surprise]',
);
const cards = [
  ...document.querySelectorAll<HTMLElement>('section.row li.card[data-linked]'),
];
// A card is told apart by its place in the page and not by its entry's id,
// so that a site shown in two rows is two cards, as it is to a reader.
const places = cards.map((_, at) => String(at));
const links = cards.map((card) =>
  card.querySelector<HTMLAnchorElement>('a.card-link'),
);

/** The place of the card a node is in, or null where it is in none. */
function placeOf(node: EventTarget | Element | null): string | null {
  if (!(node instanceof Element)) return null;
  const card = node.closest<HTMLElement>('li.card[data-linked]');
  const at = card === null ? -1 : cards.indexOf(card);
  return at < 0 ? null : String(at);
}

if (
  button !== null &&
  links.every((link) => link !== null) &&
  cards.length >= 2
) {
  const random = seeded(seedFrom(window.ooerflixSeed, Date.now()));
  let last: string | null = null;
  // A mouse press gives the button focus before the click is heard, so the
  // card that had focus is read from where focus came from, and not from
  // where it is.
  let cameFrom: string | null = null;

  button.addEventListener('focusin', (event) => {
    cameFrom = placeOf(event.relatedTarget);
  });

  button.addEventListener('click', () => {
    const held = [placeOf(document.activeElement), cameFrom].filter(
      (place): place is string => place !== null,
    );
    // The last pick is given up before a pick is, for two cards with focus
    // on one of them and the other the last pick.
    const choice =
      pick(
        places,
        new Set([...held, ...(last === null ? [] : [last])]),
        random,
      ) ?? pick(places, new Set(held), random);
    cameFrom = null;
    if (choice === null) return;
    last = choice;
    // The ring is for focus a keyboard moves, and the browser does not count
    // a script's move after a mouse press as one, so it is asked for.
    links[Number(choice)]?.focus({ focusVisible: true });
  });

  button.hidden = false;
}
