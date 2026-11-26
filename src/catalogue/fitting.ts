// What a site needs of the device that opens it, and what a card says about
// it: the three things a site may ask for, the words that say them, and the
// rule that puts the sites a phone can play first. A card is only a link out,
// and its worst failure is sending a visitor somewhere their device cannot
// play, so the card says it in words before anyone leaves. The words are
// drafts for the owner to edit and are said here and nowhere else; without
// this one place the card's back, a phone's sheet and the feature's panel
// could each say it differently. The ordering rule is said a second time by a
// classic script in the page, which cannot import this, and a test holds the
// two equal.

/**
 * What a site may need that a phone has not: a keyboard, a mouse or a
 * gamepad. In this order, which is the order the words say them in.
 */
export const NEEDS = ['keyboard', 'mouse', 'gamepad'] as const;
export type Need = (typeof NEEDS)[number];

/** Whether a site plays by touch: only one that needs nothing does. */
export function fitsTouch(needs: readonly Need[]): boolean {
  return needs.length === 0;
}

/**
 * The words a card says of what its site needs, in NEEDS order whatever order
 * the list was written in. An empty list says the site plays on a phone or a
 * computer.
 */
export function needsWords(needs: readonly Need[]): string {
  const named = NEEDS.filter((need) => needs.includes(need)).map(
    (need) => `a ${need}`,
  );
  if (named.length === 0) return 'Plays on a phone or a computer.';
  const last = named[named.length - 1] ?? '';
  const rest = named.slice(0, -1);
  return `Needs ${rest.length === 0 ? last : `${rest.join(', ')} and ${last}`}.`;
}

/**
 * The order a touch screen's row is drawn in, as indices into the row as
 * written: those that fit touch, in their order, then those that do not, in
 * theirs (a stable partition, so the owner's order holds within each group).
 */
export function touchFirst(fits: readonly boolean[]): number[] {
  const order: number[] = [];
  fits.forEach((fit, index) => {
    if (fit) order.push(index);
  });
  fits.forEach((fit, index) => {
    if (!fit) order.push(index);
  });
  return order;
}
