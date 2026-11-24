// Holds that tokens.css says each of the plan's five colours exactly once, and
// says the colour the plan agreed, and each of the finishes' colours exactly
// once, as a #rrggbb (below). Everything else reads these as custom
// properties, so a colour missing here draws as nothing and one said twice
// can drift apart. The file is read as text, as the build reads it, and not
// through a browser: this is the quick check's hold on the tokens.
import { describe, expect, it } from 'vitest';
import tokens from '../../src/styles/tokens.css?raw';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// The page's rules, read as text (vitest empties a stylesheet it is not told of).
const site = readFileSync(
  resolve(import.meta.dirname, '../../src/styles/site.css'),
  'utf8',
);

// From the plan's Layout section, "Tokens, from the mock you chose".
const colours: Record<string, string> = {
  '--color-ground': '#0c1311',
  '--color-panel': '#18251f',
  '--color-text': '#f4f1e8',
  '--color-accent': '#ffb81c',
  '--color-picture-edge': '#2c3d35',
};

// A declaration is the name at the start of a line, then a colon: a mention
// in a comment or inside var() is not one.
function declarations(name: string): string[] {
  const pattern = new RegExp(`^\\s*${name}\\s*:\\s*([^;]+);`, 'gim');
  return [...tokens.matchAll(pattern)].map((match) => (match[1] ?? '').trim());
}

describe('tokens.css colours', () => {
  it('reads the file, so that a missing one is not mistaken for a pass', () => {
    expect(tokens.length).toBeGreaterThan(0);
  });

  for (const [name, value] of Object.entries(colours)) {
    it(`defines ${name} exactly once, as ${value}`, () => {
      expect(declarations(name)).toEqual([value]);
    });
  }
});

// Every card is a light tile in its finish (plans/foils.md, round two). Its
// colours are decoration with no edge a control is told by, and its words'
// contrast is held by contrast.test.ts and contrast.spec.ts; but each is said
// once, as every colour is, and as a #rrggbb, so that two cannot drift apart,
// and nothing is said that nothing reads.
describe('tokens.css foil colours', () => {
  const names = [
    ...new Set(
      [...tokens.matchAll(/^\s*(--color-foil-[\w-]+)\s*:/gim)].map(
        (match) => match[1] ?? '',
      ),
    ),
  ];

  it('has foil colours, so that reading none is not a pass', () => {
    expect(names.length).toBeGreaterThanOrEqual(20);
  });

  it('defines each foil colour exactly once, as a #rrggbb', () => {
    for (const name of names) {
      const found = declarations(name);
      expect(found.length, name).toBe(1);
      expect(found[0], name).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it('has a base and colours for each finish: holo, gold, galaxy, ice and reverse', () => {
    for (const finish of ['holo', 'gold', 'galaxy', 'ice', 'reverse']) {
      expect(declarations(`--color-foil-${finish}-base`).length, finish).toBe(
        1,
      );
    }
    for (const [finish, least] of [
      ['gold', 6],
      ['galaxy', 4],
      ['reverse', 8],
    ] as const) {
      expect(
        names.filter((name) => name.startsWith(`--color-foil-${finish}-`))
          .length,
        finish,
      ).toBeGreaterThanOrEqual(least);
    }
  });

  it('says no value of a foil token twice under two names that mean the same colour', () => {
    const values = names.map((name) => declarations(name)[0]);
    expect(new Set(values).size).toBe(values.length);
  });
});

describe('tokens.css foil files and tile', () => {
  it('names the one file the finishes draw from, and no glitter or sparkle', () => {
    expect(declarations('--image-foil-ice')).toEqual(["url('/foil-ice.svg')"]);
    expect(tokens).not.toMatch(/glitter|sparkle/i);
  });

  it('sets the picture into the tile by one inset, and the shares that hold the words', () => {
    expect(declarations('--space-tile-inset')).toEqual(['7px']);
    expect(declarations('--share-foil-ice-overlay').length).toBe(1);
    expect(declarations('--share-foil-rest')).toEqual(['0.35']);
  });

  // A token nothing reads is a figure that can drift with no page to show it.
  it('has no foil token that site.css does not read', () => {
    const unread = [
      ...new Set(
        [
          ...tokens.matchAll(
            /^\s*(--[\w-]*foil[\w-]*|--space-tile[\w-]*)\s*:/gim,
          ),
        ].map((match) => match[1] ?? ''),
      ),
    ].filter((name) => !new RegExp(`var\\(${name}[,)]`).test(site));
    expect(unread).toEqual([]);
  });
});
