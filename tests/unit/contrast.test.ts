// Holds every colour pairing the site draws to its contrast, worked out from
// tokens.css as text: text at 7:1 (WCAG 2.2 AAA, 1.4.6) and a control's edge
// or focus ring at 3:1 (1.4.11 and 2.4.13). The luminance and the ratio are
// worked out here from the WCAG formulas and no library, so the test does not
// trust what it checks. The pairs are listed by hand from site.css; a pair
// that names a token the file does not define fails, so a renamed token cannot
// leave a pair measuring nothing. Without this a token edited to a prettier
// colour could fall under the bar and nothing would notice until the page
// was drawn. The picture's resting edge (--color-picture-edge) is left out on
// purpose: it is a decoration round a picture that already has its own
// edges, not a control and not a way to tell anything apart, so no contrast
// is asked of it. A hovered card's edge is the accent over whatever picture
// is under it, which no token can say, and is held by the drawn-colour spec.
// It prints nothing but failures.
import { describe, expect, it } from 'vitest';
import tokens from '../../src/styles/tokens.css?raw';

/** The value a token is declared with, with var() followed to its end. */
function resolve(name: string, seen: string[] = []): string {
  if (seen.includes(name)) throw new Error(`${name} refers to itself`);
  const pattern = new RegExp(`^\\s*${name}\\s*:\\s*([^;]+);`, 'm');
  const value = pattern.exec(tokens)?.[1]?.trim();
  if (value === undefined) throw new Error(`${name} is not in tokens.css`);
  const alias = /^var\((--[\w-]+)\)$/.exec(value);
  return alias?.[1] === undefined ? value : resolve(alias[1], [...seen, name]);
}

/** WCAG 2.x relative luminance of a six-digit hex colour. */
function luminance(hex: string): number {
  const match = /^#([0-9a-f]{6})$/i.exec(hex);
  if (match?.[1] === undefined) throw new Error(`${hex} is not a #rrggbb`);
  const [r, g, b] = [0, 2, 4].map((at) => {
    const channel = parseInt((match[1] ?? '').slice(at, at + 2), 16) / 255;
    return channel <= 0.03928
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function ratio(foreground: string, background: string): number {
  const [a, b] = [luminance(foreground), luminance(background)];
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

// [foreground token, background token, where the site draws it]
const TEXT: [string, string, string][] = [
  ['--color-text', '--color-ground', 'body text, titles, cards'],
  ['--color-text', '--color-panel', 'the feature title and description'],
  ['--color-accent', '--color-ground', 'the mark, card labels'],
  ['--color-accent', '--color-panel', 'the feature label'],
  ['--color-on-accent', '--color-accent', 'the Play button, the skip link'],
];

const EDGES: [string, string, string][] = [
  ['--color-accent', '--color-ground', 'the focus ring round a card or link'],
  ['--color-accent', '--color-panel', 'the focus ring round the Play button'],
  ['--color-accent', '--color-ground', 'the Pause button edge'],
  ['--color-accent', '--color-ground', 'the bar before a row title'],
  // An edge arrow sits on its own solid ground, so these are the pairs drawn.
  ['--color-accent', '--color-ground', 'an edge arrow: its edge'],
  ['--color-accent', '--color-ground', 'an edge arrow: its chevron'],
  [
    '--color-page-mark',
    '--color-ground',
    'a page mark that is not the current',
  ],
];

describe('contrast from the tokens', () => {
  it('reads the file, so that reading nothing is not a pass', () => {
    expect(tokens.length).toBeGreaterThan(0);
    expect(TEXT.length + EDGES.length).toBeGreaterThan(0);
  });

  for (const [foreground, background, where] of TEXT) {
    it(`${foreground} on ${background} is 7:1 or better (${where})`, () => {
      const got = ratio(resolve(foreground), resolve(background));
      expect(
        got,
        `${foreground} on ${background} is ${got.toFixed(2)}:1`,
      ).toBeGreaterThanOrEqual(7);
    });
  }

  for (const [foreground, background, where] of EDGES) {
    it(`${foreground} on ${background} is 3:1 or better (${where})`, () => {
      const got = ratio(resolve(foreground), resolve(background));
      expect(
        got,
        `${foreground} on ${background} is ${got.toFixed(2)}:1`,
      ).toBeGreaterThanOrEqual(3);
    });
  }

  it('fails a token that is named and not in the file', () => {
    expect(() => resolve('--color-nope')).toThrow('not in tokens.css');
  });

  it('works a known pair out: white on black is 21:1', () => {
    expect(ratio('#ffffff', '#000000')).toBeCloseTo(21, 5);
  });
});
