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
});
