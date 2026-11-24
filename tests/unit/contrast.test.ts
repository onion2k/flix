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
  ['--color-text', '--color-panel', 'a card back’s title and description'],
  ['--color-accent', '--color-ground', 'the mark, card labels'],
  ['--color-accent', '--color-panel', 'the feature label'],
  ['--color-accent', '--color-panel', 'a card back’s label'],
  ['--color-on-accent', '--color-accent', 'the Play button, the skip link'],
];

const EDGES: [string, string, string][] = [
  ['--color-accent', '--color-ground', 'the focus ring round a card or link'],
  ['--color-accent', '--color-panel', 'the focus ring round the Play button'],
  [
    '--color-accent',
    '--color-panel',
    'a card back’s Close button: edge, cross',
  ],
  ['--color-accent', '--color-ground', 'the Pause button edge'],
  // The cards' Pause button has the ground behind it, over the moving picture.
  [
    '--color-accent',
    '--color-ground',
    'the cards’ Pause button: edge, mark, ring',
  ],
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

// Every card is a light tile in its finish, with the ground's own dark for its
// words (a card's front, and its back at a desk; a phone's back is the dark
// sheet and is among the pairs above). The tile moves with the light, so what
// is listed is each colour the tile is made of, the darkest it can come to,
// and the page as drawn is held by tests/e2e/contrast.spec.ts. The cracked
// ice's darkest is its overlay of the base over a black shard, worked out
// from the two tokens that say it.
const TILE_COLOURS = [
  '--color-foil-holo-base',
  '--color-foil-rose',
  '--color-foil-cream',
  '--color-foil-mint',
  '--color-foil-sky',
  '--color-foil-violet',
  '--color-foil-gold-base',
  '--color-foil-gold-deep',
  '--color-foil-gold-mid',
  '--color-foil-gold-pale',
  '--color-foil-gold-warm',
  '--color-foil-gold-soft',
  '--color-foil-galaxy-base',
  '--color-foil-galaxy-pink',
  '--color-foil-galaxy-blue',
  '--color-foil-galaxy-lilac',
  '--color-foil-ice-base',
  '--color-foil-reverse-base',
  '--color-foil-reverse-silver-light',
  '--color-foil-reverse-silver-dark',
  '--color-foil-reverse-silver-pale',
  '--color-foil-reverse-silver-mid',
] as const;

/** The ice tile's darkest: its base over black at the overlay's share. */
function iceFloor(): string {
  const base = resolve('--color-foil-ice-base');
  const share = parseFloat(resolve('--share-foil-ice-overlay')) / 100;
  const channels = [1, 3, 5].map((at) =>
    Math.round(parseInt(base.slice(at, at + 2), 16) * share),
  );
  return `#${channels.map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}

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

  for (const colour of TILE_COLOURS) {
    it(`the ground’s ink on ${colour}, a colour of a card’s tile, is 7:1 or better`, () => {
      const got = ratio(resolve('--color-ground'), resolve(colour));
      expect(got, `${colour} is ${got.toFixed(2)}:1`).toBeGreaterThanOrEqual(7);
    });
  }

  it('the ground’s ink on the cracked ice’s darkest shard is 7:1 or better', () => {
    const got = ratio(resolve('--color-ground'), iceFloor());
    expect(got, `${iceFloor()} is ${got.toFixed(2)}:1`).toBeGreaterThanOrEqual(
      7,
    );
  });

  // The Play link's edge, and the focus rings inside a back, are the ground's
  // ink and not the accent, which is 1.5:1 on a light tile.
  it('the ground’s ink, the back’s edges and rings, is 3:1 or better on the darkest of each tile', () => {
    const darkest = [
      '--color-foil-holo-base',
      '--color-foil-violet',
      '--color-foil-gold-deep',
      '--color-foil-galaxy-base',
      '--color-foil-reverse-silver-dark',
    ];
    for (const colour of [...darkest, iceFloor()]) {
      const value = colour.startsWith('#') ? colour : resolve(colour);
      const got = ratio(resolve('--color-ground'), value);
      expect(got, `${colour} is ${got.toFixed(2)}:1`).toBeGreaterThanOrEqual(3);
    }
  });

  it('the accent is not an edge on a light tile, which is why the back has the ink', () => {
    expect(
      ratio(resolve('--color-accent'), resolve('--color-foil-holo-base')),
    ).toBeLessThan(3);
  });

  it('fails a token that is named and not in the file', () => {
    expect(() => resolve('--color-nope')).toThrow('not in tokens.css');
  });

  it('works a known pair out: white on black is 21:1', () => {
    expect(ratio('#ffffff', '#000000')).toBeCloseTo(21, 5);
  });
});
