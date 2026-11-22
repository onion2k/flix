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
import { paging } from '../../src/catalogue/paging';

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
