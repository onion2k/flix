// How a spec asks whether anything of a card lies under one of its row's edge
// arrows, said once. An arrow stands over the card cut off at the strip's
// edge, and never over one the strip has come to rest on: a card wholly in the
// window is one a reader presses and reads, and once it is flipped its back's
// words lie where its picture was. Three specs ask it (rows, flip, playing),
// and without this file each would measure the overlap its own way. Boxes are
// the browser's own (getBoundingClientRect, and a Range's client rects for
// each line of words), and only an arrow that is showing is counted. The
// row's stops, which rows.spec.ts and arrows.spec.ts both work out from the
// strip's own widths and not from the rule under test, are said here too.
import type { Locator } from '@playwright/test';

/** What was found: how many cards were wholly in the window, and each overlap. */
export interface Under {
  seen: number;
  under: string[];
}

/**
 * Every card of a row that is wholly inside its strip's window (forgiving a
 * pixel of rounding) and whether any part of it lies under an arrow that is
 * showing. A card only part in the window is not counted: that is the card an
 * arrow is drawn over.
 */
export function cardsUnderArrows(row: Locator): Promise<Under> {
  return row.evaluate((section) => {
    const view = section.querySelector('ul.strip')?.getBoundingClientRect();
    if (view === undefined) return { seen: 0, under: ['no strip'] };
    const arrows = [
      ...section.querySelectorAll<HTMLElement>('.row-arrow'),
    ].filter((arrow) => arrow.getClientRects().length > 0);
    let seen = 0;
    const under: string[] = [];
    for (const card of section.querySelectorAll<HTMLElement>('li.card')) {
      const box = card.getBoundingClientRect();
      if (box.left < view.left - 1 || box.right > view.right + 1) continue;
      seen += 1;
      for (const arrow of arrows) {
        const over = arrow.getBoundingClientRect();
        const across =
          Math.min(box.right, over.right) - Math.max(box.left, over.left);
        const down =
          Math.min(box.bottom, over.bottom) - Math.max(box.top, over.top);
        if (across > 0.5 && down > 0.5)
          under.push(
            `${card.dataset['entry'] ?? '?'} under ${arrow.dataset['page'] ?? '?'} by ${across.toFixed(1)}px`,
          );
      }
    }
    return { seen, under };
  });
}

/**
 * Whether any of the given things lies under an arrow of the row it is in
 * that is showing: an element by its box, or, where `lines` is set, each line
 * of its words by its own box. Returns each overlap, and how many boxes were
 * measured, so that measuring nothing is a failure.
 */
export function partsUnderArrows(
  parts: Locator,
  lines = false,
): Promise<Under> {
  return parts.evaluateAll((all, byLine) => {
    let seen = 0;
    const under: string[] = [];
    for (const part of all) {
      const section = part.closest('section.row');
      if (section === null) return { seen: 0, under: ['not in a row'] };
      const arrows = [
        ...section.querySelectorAll<HTMLElement>('.row-arrow'),
      ].filter((arrow) => arrow.getClientRects().length > 0);
      let boxes: DOMRect[];
      if (byLine) {
        const range = document.createRange();
        range.selectNodeContents(part);
        boxes = [...range.getClientRects()].filter((box) => box.width > 0);
      } else boxes = [part.getBoundingClientRect()];
      for (const [at, box] of boxes.entries()) {
        seen += 1;
        for (const arrow of arrows) {
          const over = arrow.getBoundingClientRect();
          const across =
            Math.min(box.right, over.right) - Math.max(box.left, over.left);
          const down =
            Math.min(box.bottom, over.bottom) - Math.max(box.top, over.top);
          if (across > 0.5 && down > 0.5)
            under.push(
              `${part.className} ${byLine ? `line ${at + 1} ` : ''}under ${arrow.dataset['page'] ?? '?'} by ${across.toFixed(1)}px`,
            );
        }
      }
    }
    return { seen, under };
  }, lines);
}

/**
 * The row's stops, worked out here from the strip's own widths and the card's
 * and not from the rule under test: the start, a window on at a time, and the
 * end in place of any stop with less than a card of strip left after it.
 */
export function stopsOf(list: Locator): Promise<number[]> {
  return list.evaluate((el) => {
    const furthest = el.scrollWidth - el.clientWidth;
    if (furthest <= 1) return [0];
    const card = el.querySelector('li')?.getBoundingClientRect().width ?? 0;
    const found = [0];
    for (let at = el.clientWidth; at < furthest; at += el.clientWidth) {
      if (furthest - at < card) break;
      found.push(at);
    }
    found.push(furthest);
    return found;
  });
}

/** How many stops, and so marks, the strip has. */
export async function pagesOf(list: Locator): Promise<number> {
  return (await stopsOf(list)).length;
}

/** The stop a strip is at or nearest to. */
export async function pageOf(list: Locator): Promise<number> {
  const stops = await stopsOf(list);
  const at = await list.evaluate((el) => el.scrollLeft);
  let best = 0;
  stops.forEach((stop, index) => {
    if (Math.abs(stop - at) < Math.abs((stops[best] ?? 0) - at)) best = index;
  });
  return best;
}
