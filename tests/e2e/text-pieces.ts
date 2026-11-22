// The text of a page, piece by piece, with the contrast each is drawn at: the
// colour and the nearest background that is not transparent, and the ratio
// WCAG works out from them, worked out here and not by the browser. It is
// said once so that the contrast spec, which measures a whole page, and the
// grown card's spec, which measures one card's words, use one measure and
// cannot come to differ. Without it each would carry a copy, and a fix to one
// would be a fault in the other.
import type { Page } from '@playwright/test';

/** The two measures written into the page, as a function run in it. */
export interface Piece {
  text: string;
  ratio: number;
  large: boolean;
  colour: string;
  background: string;
}

/**
 * Every visible text node's colour and background, as WCAG works the ratio
 * out. The luminance is worked out here and not by the browser, so the spec
 * does not trust the thing it checks. A colour with any transparency is
 * refused rather than guessed at: nothing on this site has one.
 */
export async function textPieces(page: Page, root = 'body'): Promise<Piece[]> {
  return page.evaluate((selector) => {
    const channels = (colour: string): number[] => {
      const found = colour.match(/[\d.]+/g)?.map(Number) ?? [];
      if (found.length === 4 && found[3] !== 1)
        throw new Error(`${colour} is part transparent`);
      return found.slice(0, 3);
    };
    const luminance = (colour: string): number =>
      [0.2126, 0.7152, 0.0722].reduce((sum, weight, at) => {
        const value = (channels(colour)[at] ?? 0) / 255;
        return (
          sum +
          weight *
            (value <= 0.03928
              ? value / 12.92
              : ((value + 0.055) / 1.055) ** 2.4)
        );
      }, 0);
    const ratio = (a: string, b: string): number => {
      const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
      return ((high ?? 0) + 0.05) / ((low ?? 0) + 0.05);
    };
    const pieces: Piece[] = [];
    const top = document.querySelector(selector);
    if (top === null) throw new Error(`nothing matches ${selector}`);
    const walker = document.createTreeWalker(top, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const holder = node.parentElement;
      if (holder === null || (node.textContent ?? '').trim() === '') continue;
      if (holder.closest('script, style, noscript')) continue;
      if (!holder.checkVisibility()) continue;
      const style = getComputedStyle(holder);
      let background: string | null = null;
      for (
        let up: Element | null = holder;
        up !== null && background === null;
        up = up.parentElement
      ) {
        const colour = getComputedStyle(up).backgroundColor;
        if (colour !== 'rgba(0, 0, 0, 0)' && colour !== 'transparent')
          background = colour;
      }
      // The page's own ground is on <html>, so a text node always finds one.
      if (background === null)
        throw new Error(`no background behind "${node.textContent}"`);
      const size = parseFloat(style.fontSize);
      pieces.push({
        text: (node.textContent ?? '').trim().slice(0, 40),
        ratio: ratio(style.color, background),
        large:
          size >= 24 ||
          (size >= 18.66 && parseInt(style.fontWeight, 10) >= 700),
        colour: style.color,
        background,
      });
    }
    return pieces;
  }, root);
}
