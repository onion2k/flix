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
import { asColour } from '../../src/catalogue/colour';

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
