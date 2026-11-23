// Turns a card over. Each card is marked data-flips and its two buttons are
// shown, which is what the stylesheet waits for before it stacks the card's two
// faces in one place and takes the Play link's stretch off the card: until
// then, and with script off, the card is one link over the whole of it. Then a
// press on the front (its flip button, which covers the front: a click, a tap,
// Enter) shows the back, and a press on the back outside Play (its Close
// button, whose ::after covers the back under Play) or Escape shows the front
// again. What a press comes to, which card is flipped, which is turned back and
// where focus goes, is turn()'s, in src/catalogue/flipping.ts; this reads the
// press, marks the card data-flipped, makes the face turned away inert (so that
// its words and controls are out of the accessibility tree and the Tab order,
// and a press goes through it), and moves focus. A card's link is looked for at
// the press and not once, so that what decides where focus goes is the card as
// it is. It builds no markup and sets no style, since the content policy
// refuses both, keeps one record of which card is flipped, and adds two
// listeners a card and one to the document, once, so nothing it keeps grows.
// The turn itself is the stylesheet's, and is motion only where it is asked
// for. Without it the cards are the links they were and show their words all
// at once, which is the page working without script, not a fault.
import { turn, type Control, type Turn } from '../catalogue/flipping';

/** A card's parts that a flip moves between. */
interface Parts {
  card: HTMLElement;
  front: HTMLElement;
  back: HTMLElement;
  flip: HTMLButtonElement;
  unflip: HTMLButtonElement;
}

/**
 * Each card that has both faces and both buttons, by its place among the
 * page's cards: the place, and not the entry's id, names it, since one site
 * may be in two rows.
 */
const cards = new Map<string, Parts>();

document.querySelectorAll<HTMLElement>('li.card').forEach((card, at) => {
  const front = card.querySelector<HTMLElement>('.face.front');
  const back = card.querySelector<HTMLElement>('.face.back');
  const flip = card.querySelector<HTMLButtonElement>('button.card-flip');
  const unflip = card.querySelector<HTMLButtonElement>('button.card-unflip');
  if (front === null || back === null || flip === null || unflip === null)
    return;
  cards.set(String(at), { card, front, back, flip, unflip });
});

/** The card flipped now, or null. */
let flipped: string | null = null;

/**
 * Shows one face of a card and makes the other inert, the one to be seen
 * first, so that focus has somewhere to go. The card is marked data-turns at
 * its first press, which is what lets its faces turn where motion is allowed:
 * the stylesheet does not turn a card that has only been set up, whose back
 * was turned away when it was marked as one that flips.
 */
function show(parts: Parts, face: 'front' | 'back'): void {
  const [seen, away] =
    face === 'back' ? [parts.back, parts.front] : [parts.front, parts.back];
  parts.card.setAttribute('data-turns', '');
  seen.inert = false;
  away.inert = true;
  if (face === 'back') parts.card.setAttribute('data-flipped', '');
  else parts.card.removeAttribute('data-flipped');
}

/** The control of a card focus is sent to. */
function control(parts: Parts, which: Control): HTMLElement | null {
  if (which === 'flip') return parts.flip;
  if (which === 'close') return parts.unflip;
  return parts.back.querySelector<HTMLElement>('a.card-link');
}

/** Does what a press came to, on the page. */
function apply(result: Turn): void {
  if (result.turnedBack !== null) {
    const parts = cards.get(result.turnedBack);
    if (parts !== undefined) show(parts, 'front');
  }
  if (result.flipped !== null && result.flipped !== flipped) {
    const parts = cards.get(result.flipped);
    if (parts !== undefined) show(parts, 'back');
  }
  flipped = result.flipped;
  if (result.focus !== null) {
    const parts = cards.get(result.focus.card);
    if (parts !== undefined) control(parts, result.focus.control)?.focus();
  }
}

for (const [id, parts] of cards) {
  parts.card.setAttribute('data-flips', '');
  parts.back.inert = true;
  parts.flip.hidden = false;
  parts.unflip.hidden = false;
  parts.flip.addEventListener('click', () => {
    const linked = parts.back.querySelector('a.card-link') !== null;
    apply(turn(flipped, { kind: 'flip', card: id, linked }));
  });
  parts.unflip.addEventListener('click', () => {
    apply(turn(flipped, { kind: 'unflip', card: id }));
  });
}

document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape' || flipped === null) return;
  const holder = document.activeElement?.closest('li.card') ?? null;
  const focusIn =
    [...cards].find(([, parts]) => parts.card === holder)?.[0] ?? null;
  apply(turn(flipped, { kind: 'escape', focusIn }));
});
