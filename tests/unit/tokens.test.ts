// Holds that tokens.css says each of the plan's five colours exactly once, and
// says the colour the plan agreed, and each of the best cards' foil colours
// exactly once, as a #rrggbb (below). Everything else reads these as custom
// properties, so a colour missing here draws as nothing and one said twice
// can drift apart. The file is read as text, as the build reads it, and not
// through a browser: this is the quick check's hold on the tokens.
import { describe, expect, it } from 'vitest';
import tokens from '../../src/styles/tokens.css?raw';

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

// The foil of the best cards (part 5 of plans/cards.md) is a decoration with no
// words on it and no edge a control is told by, so its colours are not among
// the plan's five and no contrast is asked of them; but each is said once, as
// every colour is, and as a #rrggbb, so that two cannot drift apart.
describe('tokens.css foil colours', () => {
  const names = [
    ...new Set(
      [...tokens.matchAll(/^\s*(--color-foil-[\w-]+)\s*:/gim)].map(
        (match) => match[1] ?? '',
      ),
    ),
  ];

  it('has foil colours, so that reading none is not a pass', () => {
    expect(names.length).toBeGreaterThanOrEqual(4);
  });

  it('defines each foil colour exactly once, as a #rrggbb', () => {
    for (const name of names) {
      const found = declarations(name);
      expect(found.length, name).toBe(1);
      expect(found[0], name).toMatch(/^#[0-9a-f]{6}$/);
    }
  });
});
