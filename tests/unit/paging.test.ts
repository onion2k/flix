// Holds the paging rule: from where a row's strip is scrolled, whether it
// overflows, whether Previous and Next are live, and where each would go. The
// rule is in a pure function so that it is tried here with numbers and not
// through a browser. Each case states the figures it is given, and the end
// cases carry the pixel of tolerance, since a browser's scrollLeft can stop a
// fraction short of the end and leave Next live with nowhere to go.
import { describe, expect, it } from 'vitest';
import { paging } from '../../src/catalogue/paging';

const strip = (scrollLeft: number, clientWidth = 1000, scrollWidth = 3000) =>
  paging({ scrollLeft, clientWidth, scrollWidth });

describe('paging', () => {
  it('says a strip wider than its window overflows', () => {
    expect(strip(0).overflows).toBe(true);
  });

  it('says a strip that fits does not overflow, and has no live button', () => {
    const fits = paging({
      scrollLeft: 0,
      clientWidth: 1000,
      scrollWidth: 1000,
    });
    expect(fits.overflows).toBe(false);
    expect(fits.previous.live).toBe(false);
    expect(fits.next.live).toBe(false);
  });

  it('forgives a pixel of rounding when deciding whether a strip overflows', () => {
    expect(
      paging({ scrollLeft: 0, clientWidth: 1000, scrollWidth: 1001 }).overflows,
    ).toBe(false);
    expect(
      paging({ scrollLeft: 0, clientWidth: 1000, scrollWidth: 1002 }).overflows,
    ).toBe(true);
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
    const narrow = paging({
      scrollLeft: 0,
      clientWidth: 300,
      scrollWidth: 3000,
    });
    expect(narrow.next.to).toBe(300);
  });

  // The page marks and their words: how many pages a strip has, and which one
  // it is on. A page is the window, as Next takes it, so the count is the
  // strip's width over the window's, rounded up.
  it('counts one page for a strip that fits', () => {
    const fits = paging({
      scrollLeft: 0,
      clientWidth: 1000,
      scrollWidth: 1000,
    });
    expect(fits.pages).toBe(1);
    expect(fits.page).toBe(0);
  });

  it('counts the pages of a strip: its width over the window, rounded up', () => {
    expect(strip(0, 1000, 3000).pages).toBe(3);
    expect(strip(0, 1000, 3002).pages).toBe(4);
    expect(strip(0, 1000, 2500).pages).toBe(3);
    expect(strip(0, 1000, 1500).pages).toBe(2);
  });

  it('forgives a pixel when counting pages, as it does for overflowing', () => {
    expect(strip(0, 1000, 3001).pages).toBe(3);
    expect(
      paging({ scrollLeft: 0, clientWidth: 1000, scrollWidth: 1001 }).pages,
    ).toBe(1);
  });

  it('puts the strip on the page its position is nearest to', () => {
    expect(strip(0).page).toBe(0);
    expect(strip(400).page).toBe(0);
    expect(strip(600).page).toBe(1);
    expect(strip(1000).page).toBe(1);
    expect(strip(1400).page).toBe(1);
    expect(strip(1600).page).toBe(2);
  });

  it('puts a strip at its end on the last page, however short that page is', () => {
    // 2500 wide in a window of 1000: the end is at 1500, which is 1.5 pages in
    // and would round to the second page if the end were not taken as the last.
    expect(strip(1500, 1000, 2500).page).toBe(2);
    expect(strip(1499, 1000, 2500).page).toBe(2);
    expect(strip(1000, 1000, 2500).page).toBe(1);
  });

  it('never puts the strip on a page the count does not have', () => {
    for (const at of [-5, 0, 1, 999, 1500, 2000, 5000]) {
      const got = strip(at);
      expect(got.page).toBeGreaterThanOrEqual(0);
      expect(got.page).toBeLessThan(got.pages);
    }
  });

  it('has no pages to count in a window of no width', () => {
    const none = paging({ scrollLeft: 0, clientWidth: 0, scrollWidth: 0 });
    expect(none.pages).toBe(1);
    expect(none.page).toBe(0);
  });
});
