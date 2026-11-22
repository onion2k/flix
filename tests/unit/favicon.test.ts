// Holds the favicon's colours equal to tokens.css. An SVG used as an icon is
// drawn on its own and cannot read the page's custom properties, so its
// colours are typed into the file; without this test a change of ground or
// accent in the tokens would leave the tab icon in the old colours and nothing
// would say so.
import { describe, expect, it } from 'vitest';
import favicon from '../../public/favicon.svg?raw';
import tokens from '../../src/styles/tokens.css?raw';

function token(name: string): string {
  const match = new RegExp(`^\\s*${name}\\s*:\\s*([^;]+);`, 'im').exec(tokens);
  return (match?.[1] ?? '').trim().toLowerCase();
}

// Every colour the icon names: hex values in fill, stroke or stop-color.
const used = [...favicon.matchAll(/#[0-9a-f]{3,8}\b/gi)].map((match) =>
  match[0].toLowerCase(),
);

describe('public/favicon.svg', () => {
  it('names at least one colour, so that reading none is not a pass', () => {
    expect(used.length).toBeGreaterThan(0);
  });

  it('uses the ground and the accent, and only those', () => {
    const allowed = [token('--color-ground'), token('--color-accent')];
    expect(allowed.every((colour) => colour.startsWith('#'))).toBe(true);
    expect(new Set(used)).toEqual(new Set(allowed));
  });
});
