// Holds the paging rule: from where a row's strip is scrolled, whether it
// overflows, whether Previous and Next are live, where each would go, and the
// row's stops, which are its pages: the places the arrows take it, the marks
// that are drawn and the lit one. A stop is a window on from the last, and a
// stop with less than a card's width of strip left after it is the end
// instead, so that no mark is a place the arrows cannot reach. The
// rule is in a pure function so that it is tried here with numbers and not
// through a browser. Each case states the figures it is given, and the end
// cases carry the pixel of tolerance, since a browser's scrollLeft can stop a
// fraction short of the end and leave Next live with nowhere to go.
import { describe, expect, it } from 'vitest';
import { paging, trim, whollyIn } from '../../src/catalogue/paging';

const strip = (
  scrollLeft: number,
  clientWidth = 1000,
  scrollWidth = 3000,
  cardWidth = 100,
) => paging({ scrollLeft, clientWidth, scrollWidth, cardWidth });

describe('paging', () => {
  it('says a strip wider than its window overflows', () => {
    expect(strip(0).overflows).toBe(true);
  });

  it('says a strip that fits does not overflow, and has no live button', () => {
    const fits = paging({
      scrollLeft: 0,
      clientWidth: 1000,
      scrollWidth: 1000,
      cardWidth: 100,
    });
    expect(fits.overflows).toBe(false);
    expect(fits.previous.live).toBe(false);
    expect(fits.next.live).toBe(false);
  });

  it('forgives a pixel of rounding when deciding whether a strip overflows', () => {
    expect(strip(0, 1000, 1001).overflows).toBe(false);
    expect(strip(0, 1000, 1002).overflows).toBe(true);
  });

  it('has Previous not live at the start, and Next live', () => {
    const start = strip(0);
    expect(start.previous.live).toBe(false);
    expect(start.next.live).toBe(true);
  });

  it('forgives a pixel at the start', () => {
    expect(strip(1).previous.live).toBe(false);
    expect(strip(2).previous.live).toBe(true);
  });

  it('has both live in the middle', () => {
    const middle = strip(1000);
    expect(middle.previous.live).toBe(true);
    expect(middle.next.live).toBe(true);
  });

  it('has Next not live at the end, and Previous live', () => {
    const end = strip(2000);
    expect(end.next.live).toBe(false);
    expect(end.previous.live).toBe(true);
  });

  it('forgives a pixel at the end', () => {
    expect(strip(1999).next.live).toBe(false);
    expect(strip(1998).next.live).toBe(true);
  });

  it('sends Next one page on, and Previous one page back', () => {
    expect(strip(1000).next.to).toBe(2000);
    expect(strip(1000).previous.to).toBe(0);
    expect(strip(500).previous.to).toBe(0);
  });

  it('clamps Next to the end and Previous to the start', () => {
    expect(strip(1500).next.to).toBe(2000);
    expect(strip(300).previous.to).toBe(0);
  });

  it('takes a page to be the window, whatever its width', () => {
    expect(strip(0, 300, 3000).next.to).toBe(300);
  });

  // The stops. Each is given as the figures of a row and the stops it must
  // have, so that the rule is read off the cases: from 0, a window on at a
  // time, and the end in place of any stop that has less than a card left
  // after it.
  describe('stops', () => {
    it('gives a strip that fits one stop, and no marks to draw', () => {
      const fits = strip(0, 1000, 1000);
      expect(fits.stops).toEqual([0]);
      expect(fits.pages).toBe(1);
      expect(fits.page).toBe(0);
    });

    it('gives a strip a little wider than its window two stops: the start and the end', () => {
      // 50 over: a window on would be past the end, so the end is the second.
      expect(strip(0, 1000, 1050).stops).toEqual([0, 50]);
      // 1500 wide: 500 left after the start, which is more than a card.
      expect(strip(0, 1000, 1500).stops).toEqual([0, 500]);
    });

    it('gives a strip three windows wide three stops, the middle one a window on', () => {
      expect(strip(0, 1000, 3000).stops).toEqual([0, 1000, 2000]);
    });

    it('lets the end stand in for a stop with less than a card left after it', () => {
      // The way to the end is 2050: a window on from 2000 leaves 50, under a
      // card of 100, so 2000 is not a stop and 2050 is.
      expect(strip(0, 1000, 3050).stops).toEqual([0, 1000, 2050]);
      // With 100 left (exactly a card) the stop stays, and the end follows.
      expect(strip(0, 1000, 3100).stops).toEqual([0, 1000, 2000, 2100]);
    });

    it('takes the card’s width as the measure of "a little"', () => {
      expect(strip(0, 1000, 3050, 40).stops).toEqual([0, 1000, 2000, 2050]);
      expect(strip(0, 1000, 3050, 300).stops).toEqual([0, 1000, 2050]);
    });

    it('counts a mark for each stop, and says the number of them', () => {
      const got = strip(0, 1000, 3000);
      expect(got.pages).toBe(got.stops.length);
    });

    it('forgives a pixel when deciding whether a strip has more than one stop', () => {
      expect(strip(0, 1000, 1001).stops).toEqual([0]);
      expect(strip(0, 1000, 1002).stops).toEqual([0, 2]);
    });

    it('gives a window of no width one stop', () => {
      const none = paging({
        scrollLeft: 0,
        clientWidth: 0,
        scrollWidth: 0,
        cardWidth: 0,
      });
      expect(none.stops).toEqual([0]);
      expect(none.page).toBe(0);
    });

    it('sends Next to the next stop and Previous to the one before', () => {
      // Stops 0, 1000, 2000 and 2100.
      const at = (left: number) => strip(left, 1000, 3100);
      expect(at(0).next.to).toBe(1000);
      expect(at(1000).next.to).toBe(2000);
      expect(at(2000).next.to).toBe(2100);
      expect(at(2100).previous.to).toBe(1000);
      expect(at(1000).previous.to).toBe(0);
      expect(at(0).previous.to).toBe(0);
    });

    it('takes a strip that rests a little either side of a stop to be at it', () => {
      // A strip comes to rest on a card's start, so a stop is reached by
      // landing short of it or past it, by less than a card.
      const at = (left: number) => strip(left, 1000, 3000);
      expect(at(940).next.to).toBe(2000);
      expect(at(1060).next.to).toBe(2000);
      expect(at(940).previous.to).toBe(0);
      expect(at(1060).previous.to).toBe(0);
    });

    it('sends Next from between two stops to the next one on, and Previous to the one back', () => {
      const at = strip(500, 1000, 3000);
      expect(at.next.to).toBe(1000);
      expect(at.previous.to).toBe(0);
      expect(strip(1500, 1000, 3000).next.to).toBe(2000);
      expect(strip(1500, 1000, 3000).previous.to).toBe(1000);
    });

    it('sends Next to the end where none of the stops is past the strip', () => {
      // 1050 wide: stops 0 and 50, and Next from 20 goes to the end.
      expect(strip(20, 1000, 1050, 100).next.to).toBe(50);
    });

    it('puts the strip on the stop it is at or nearest', () => {
      const at = (left: number) => strip(left, 1000, 3000).page;
      expect(at(0)).toBe(0);
      expect(at(400)).toBe(0);
      expect(at(600)).toBe(1);
      expect(at(1000)).toBe(1);
      expect(at(1400)).toBe(1);
      expect(at(1600)).toBe(2);
      expect(at(2000)).toBe(2);
    });

    it('puts a strip at its end on the last stop', () => {
      expect(strip(2050, 1000, 3050).page).toBe(2);
      expect(strip(2049, 1000, 3050).page).toBe(2);
    });

    it('never puts the strip on a stop the count does not have', () => {
      for (const left of [-5, 0, 1, 999, 1500, 2000, 5000]) {
        const got = strip(left);
        expect(got.page).toBeGreaterThanOrEqual(0);
        expect(got.page).toBeLessThan(got.pages);
      }
    });

    it('has every live arrow go somewhere that is not where the strip is', () => {
      for (const width of [1050, 1500, 2000, 3000, 3050, 5300]) {
        for (let left = 0; left <= width - 1000; left += 50) {
          const got = strip(left, 1000, width);
          if (got.next.live) expect(got.next.to).toBeGreaterThan(left);
          if (got.previous.live) expect(got.previous.to).toBeLessThan(left);
        }
      }
    });
  });
});

// Whether a focused card is wholly inside its strip's window, less the scroll
// padding at each side; one that is not is brought in to its start, which is
// a snap point, since a smaller move is pulled back by the strip's snapping
// on a phone, where the window holds a card and a half.
describe('whollyIn', () => {
  const view = { left: 0, right: 390, padding: 16 };
  it('says a card inside the padded window is wholly in', () => {
    expect(whollyIn({ left: 16, right: 242 }, view)).toBe(true);
    expect(whollyIn({ left: 148, right: 374 }, view)).toBe(true);
  });
  it('says a card cut off at either side is not', () => {
    expect(whollyIn({ left: 258, right: 484 }, view)).toBe(false);
    expect(whollyIn({ left: -100, right: 126 }, view)).toBe(false);
  });
  it('says a card under the padding at either side is not', () => {
    expect(whollyIn({ left: 10, right: 236 }, view)).toBe(false);
    expect(whollyIn({ left: 150, right: 380 }, view)).toBe(false);
  });
  it('forgives a pixel of rounding at each side', () => {
    expect(whollyIn({ left: 15.2, right: 374.8 }, view)).toBe(true);
    expect(whollyIn({ left: 14.5, right: 240 }, view)).toBe(false);
  });
});

// trim() says how much narrower a row's cards are drawn so that no card the
// strip rests with wholly in the window lies under an arrow. It is held here
// by laying a strip out in numbers, as the stylesheet does, and looking at
// every place it can rest: its start, its end, and each card's start at the
// scroll padding (the snap is mandatory). That is worked out here from the
// layout and not from trim()'s own sum, so a wrong sum is caught. The figures
// are the site's, at a root of 17px: a desk's gutter of 3rem and a phone's of
// 1rem, a gap of 1.25rem, an arrow of 3.25rem and a scroll padding as wide as
// the widest of the gutter, the arrow and a target; a desk's card is
// clamp(17rem, 27vw, 25rem) and a phone's 58vw.
describe('trim', () => {
  const REM = 17;
  const GAP = 1.25 * REM;
  const ARROW = 3.25 * REM;
  const TARGET = 2.75 * REM;
  // A phone's card is max(36vw, 7.75rem), and never made narrower than 6rem,
  // the least its words need; a desk's has no least of its own here.
  const LEAST_PHONE = 6 * REM;
  const site = (window: number) => {
    const phone = window <= 640;
    const start = (phone ? 1 : 3) * REM;
    const card = phone
      ? Math.max(0.36 * window, 7.75 * REM)
      : Math.min(Math.max(17 * REM, 0.27 * window), 25 * REM);
    const padding = Math.max(start, ARROW, TARGET);
    const least = phone ? LEAST_PHONE : 0;
    return { window, card, gap: GAP, start, padding, arrow: ARROW, least };
  };

  /** Each whole card under a showing arrow at each rest of a strip of `count` cards. */
  function under(
    figures: ReturnType<typeof site>,
    cut: number,
    count: number,
  ): string[] {
    const { window, gap, start, padding, arrow } = figures;
    const card = figures.card - cut;
    const lefts = Array.from(
      { length: count },
      (_, at) => start + at * (card + gap),
    );
    const width = start + count * card + (count - 1) * gap + start;
    const most = width - window;
    if (most <= 1) return [];
    const rests = new Set([0, most]);
    for (const left of lefts)
      rests.add(Math.min(most, Math.max(0, left - padding)));
    const found: string[] = [];
    for (const rest of rests) {
      for (const [at, left] of lefts.entries()) {
        const from = left - rest;
        const to = from + card;
        if (from < -0.5 || to > window + 0.5) continue;
        if (rest > 1 && from < arrow - 0.5)
          found.push(
            `${window}: card ${at} under Previous at ${rest.toFixed(1)}`,
          );
        if (rest < most - 1 && to > window - arrow + 0.5)
          found.push(`${window}: card ${at} under Next at ${rest.toFixed(1)}`);
      }
    }
    return found;
  }

  it('leaves the cards as they are where no whole card would rest under an arrow', () => {
    expect(trim(site(1440))).toBe(0);
    expect(trim(site(1920))).toBe(0);
    expect(trim(site(1100))).toBe(0);
  });

  it('narrows the cards inside a band, by no more than the arrow and its edge over the whole cards', () => {
    for (const window of [680, 990, 1840, 2290]) {
      const cut = trim(site(window));
      expect(cut, `${window}`).toBeGreaterThan(0);
      expect(cut, `${window}`).toBeLessThan(ARROW);
    }
  });

  it('shows that the bands are real: untrimmed, a whole card rests under an arrow there', () => {
    for (const window of [680, 990, 1840, 2290])
      expect(under(site(window), 0, 7).length, `${window}`).toBeGreaterThan(0);
  });

  it('leaves no whole card under an arrow at any rest, and no card narrower than its least, at every width from 320 to 2600, for rows of 3 to 7 cards', () => {
    let rows = 0;
    const found: string[] = [];
    for (let window = 320; window <= 2600; window += 1)
      for (const count of [3, 4, 5, 7]) {
        const figures = site(window);
        const cut = trim(figures);
        found.push(...under(figures, cut, count));
        if (figures.card - cut < figures.least - 0.5)
          found.push(
            `${window}: a card ${figures.card - cut}px, under its least`,
          );
        rows += 1;
      }
    expect(found.slice(0, 10)).toEqual([]);
    expect(rows).toBe(2281 * 4);
  });

  it('where narrowing would take a card under its least, widens the cards so that one fewer is whole', () => {
    // 320 wide: two whole cards would need narrowing to about 94px, under the
    // least, so one is whole and wider, and the next is cut off.
    const figures = site(320);
    const cut = trim(figures);
    expect(cut).toBeLessThan(0);
    expect(figures.card - cut).toBeGreaterThan(figures.least);
    expect(under(figures, cut, 5)).toEqual([]);
  });

  it('says nothing for a strip it cannot measure', () => {
    const figures = site(1440);
    expect(trim({ ...figures, card: 0 })).toBe(0);
    expect(trim({ ...figures, window: Number.NaN })).toBe(0);
    expect(trim({ ...figures, window: 0 })).toBe(0);
    expect(trim({ ...figures, gap: Number.POSITIVE_INFINITY })).toBe(0);
  });
});
