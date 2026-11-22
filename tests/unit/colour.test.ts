// Holds the check that stands between a colour written into the page at build
// and the script that uses it: text from outside comes back as a colour only
// if it is a hash and six lower-case hex digits, and as nothing otherwise. The
// content policy refuses a style attribute, so the colour travels as a data-
// attribute and is set through the CSSOM, and anything that could carry a
// second declaration (a semicolon, a url(), a name) must be refused here.
// Upper case is refused on purpose: the build writes lower case alone, so one
// spelling is the only one the page ever holds and a different one is a sign
// that something else wrote it. Each group counts what it tried, so that an
// empty list is a failure and not a pass.
import { describe, expect, it } from 'vitest';
import {
  WAITING_LIGHTNESS,
  asColour,
  waitingColour,
} from '../../src/catalogue/colour';

function refused(values: string[]): void {
  expect(values.length).toBeGreaterThan(0);
  for (const value of values) expect(asColour(value), value).toBeNull();
}

describe('asColour', () => {
  it('returns a hash and six lower-case hex digits as it was given', () => {
    const good = ['#000000', '#ffffff', '#0a1b2c', '#18251f', '#abcdef'];
    for (const value of good) expect(asColour(value), value).toBe(value);
  });

  it('refuses the wrong number of digits', () => {
    refused(['#', '#f', '#fff', '#ffff', '#fffff', '#fffffff', '#ffffffff']);
  });

  it('refuses a missing hash and digits that are not hex', () => {
    refused(['ffffff', '#gggggg', '#12345g', '#12 456', '##123456', '#-12345']);
  });

  it('refuses upper case, since the build writes lower case alone', () => {
    refused(['#FFFFFF', '#AbCdEf', '#ABCDEF']);
  });

  it('refuses names, functions and url()', () => {
    refused([
      'red',
      'rebeccapurple',
      'transparent',
      'rgb(1, 2, 3)',
      'hsl(0 0% 0%)',
      'var(--color-text)',
      'url(x)',
      'url(https://example.com/x.png)',
    ]);
  });

  it('refuses empty text and white space, which it does not trim', () => {
    refused(['', ' ', ' #ffffff', '#ffffff ', '#ffffff\n', '\t#ffffff']);
  });

  it('refuses anything with a semicolon, or anything after the colour', () => {
    refused([
      '#ffffff;',
      '#ffffff; background: url(x)',
      'red; background: url(x)',
      ';#ffffff',
      '#ffffff !important',
      '#ffffff}',
      '#ffffff/**/',
    ]);
  });
});

// The colour a late frame waits in is worked out from a small copy of its
// picture. These hold what that colour must be like: the picture's own hue,
// taken from its most saturated pixels and not from whatever fills most of
// it, and always at the one dark lightness, so that a white page and a black
// one both wait inside the site's dark look.
describe('the colour a picture waits in', () => {
  const pixels = (...rgb: [number, number, number][]): Uint8Array =>
    Uint8Array.from(rgb.flat());
  const repeat = (
    colour: [number, number, number],
    times: number,
  ): [number, number, number][] => Array.from({ length: times }, () => colour);
  const channels = (hex: string): [number, number, number] => [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
  /** Lightness as HSL has it: the middle of the brightest and darkest channel. */
  const lightness = (hex: string): number => {
    const [r, g, b] = channels(hex);
    return (Math.max(r, g, b) + Math.min(r, g, b)) / 2 / 255;
  };

  it('is a colour the page will accept', () => {
    const colour = waitingColour(pixels([10, 200, 30], [0, 0, 0]));
    expect(asColour(colour)).toBe(colour);
  });

  it('takes the hue of the saturated pixels, not of the black that fills most of the picture', () => {
    // A purple toy on a black ground: nine parts black to one of purple.
    const colour = waitingColour(
      pixels(...repeat([0, 0, 0], 90), ...repeat([110, 60, 200], 10)),
    );
    const [r, g, b] = channels(colour);
    expect(b).toBeGreaterThan(r);
    expect(r).toBeGreaterThan(g);
  });

  it('takes the hue of a few strong pixels over that of a dull ground with a tint of its own', () => {
    // A plain mean would follow the ground, which is nine tenths of the
    // picture and faintly green; the picture is of the purple thing on it.
    const colour = waitingColour(
      pixels(...repeat([90, 104, 90], 90), ...repeat([120, 40, 210], 10)),
    );
    const [r, g, b] = channels(colour);
    expect(b).toBeGreaterThan(g);
    expect(r).toBeGreaterThan(g);
  });

  it('is as dark for a white page as for a black one', () => {
    const onWhite = waitingColour(
      pixels(...repeat([250, 250, 250], 90), ...repeat([40, 90, 220], 10)),
    );
    const onBlack = waitingColour(
      pixels(...repeat([4, 4, 4], 90), ...repeat([40, 90, 220], 10)),
    );
    expect(lightness(onWhite)).toBeCloseTo(WAITING_LIGHTNESS, 1);
    expect(lightness(onBlack)).toBeCloseTo(WAITING_LIGHTNESS, 1);
    expect(lightness(onWhite)).toBeLessThan(0.4);
  });

  it('stays grey for a picture with no colour in it', () => {
    const [r, g, b] = channels(
      waitingColour(
        pixels(...repeat([30, 30, 30], 50), ...repeat([200, 200, 200], 50)),
      ),
    );
    expect(Math.max(r, g, b) - Math.min(r, g, b)).toBeLessThanOrEqual(2);
  });

  it('gives different pictures different colours', () => {
    const green = waitingColour(pixels(...repeat([60, 180, 70], 100)));
    const sand = waitingColour(pixels(...repeat([200, 180, 120], 100)));
    expect(green).not.toBe(sand);
  });

  it('gives the same picture the same colour every time', () => {
    const picture = pixels(
      ...repeat([9, 9, 9], 40),
      ...repeat([220, 40, 90], 7),
    );
    expect(waitingColour(picture)).toBe(waitingColour(picture));
  });

  it('refuses a picture with no pixels, or with a stray byte', () => {
    expect(() => waitingColour(new Uint8Array(0))).toThrow(/no pixels/);
    expect(() => waitingColour(Uint8Array.from([1, 2, 3, 4]))).toThrow(
      /three bytes/,
    );
  });
});
