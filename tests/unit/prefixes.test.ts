// Holds the one property Safari still reads only by its prefixed name. WebKit
// computes `user-select: none` from the unprefixed name and still lets a mouse
// select words, because selection reads `-webkit-user-select`, which stays
// `text` (seen in Playwright's WebKit 27.2 on 2026-11-26: a drag along a strip
// selected "About Tiny Slots..."). Chromium honours either name, so no
// end-to-end spec here, all of them Chromium's, can see it; this reads the
// source as text instead. Every `user-select` must sit in the same rule as a
// `-webkit-user-select` of the same value. It counts the files it read, so
// that a moved folder is a failure, and tries its reading on made-up rules.
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// Read from disk, as tokens.test.ts reads site.css: vitest hands a .css file
// imported as `?raw` back empty (it stubs CSS), which passed this test over
// nothing when it was first written.
const src = resolve(import.meta.dirname, '../../src');
const styles: [string, string][] = readdirSync(src, { recursive: true })
  .map(String)
  .filter((file) => /\.(css|astro)$/.test(file))
  .map((file) => [
    relative(src, join(src, file)),
    readFileSync(join(src, file), 'utf8'),
  ]);

/** Each rule's body (what is between a brace and its close) that sets an
 * unprefixed user-select with no prefixed one of the same value beside it. */
function unpaired(source: string): string[] {
  const found: string[] = [];
  for (const match of source.matchAll(/\{([^{}]*)\}/g)) {
    const body = match[1] ?? '';
    for (const set of body.matchAll(/(?<![-\w])user-select\s*:\s*([\w-]+)/g)) {
      const value = set[1] ?? '';
      const prefixed = new RegExp(
        `-webkit-user-select\\s*:\\s*${value}(?![\\w-])`,
      );
      if (!prefixed.test(body)) found.push(`user-select: ${value}`);
    }
  }
  return found;
}

describe('unpaired (the reading itself)', () => {
  it('finds a user-select with no prefixed twin', () => {
    expect(unpaired('.a { cursor: grab; user-select: none; }')).toEqual([
      'user-select: none',
    ]);
  });

  it('finds one whose twin is in another rule, or of another value', () => {
    expect(
      unpaired('.a { user-select: none; } .b { -webkit-user-select: none; }'),
    ).toEqual(['user-select: none']);
    expect(
      unpaired('.a { user-select: none; -webkit-user-select: text; }'),
    ).toEqual(['user-select: none']);
  });

  it('lets through a pair, either way round, and a prefixed one alone', () => {
    expect(
      unpaired('.a { -webkit-user-select: none; user-select: none; }'),
    ).toEqual([]);
    expect(
      unpaired('.a {\n  user-select: none;\n  -webkit-user-select: none;\n}'),
    ).toEqual([]);
    expect(unpaired('.a { -webkit-user-select: none; }')).toEqual([]);
  });
});

describe('src styles', () => {
  const read = styles;

  it('has files to read, site.css among them and with the drag rule in it, so that reading nothing is not a pass', () => {
    expect(read.length).toBeGreaterThan(10);
    const site = read.find(([file]) => file.endsWith('styles/site.css'));
    expect(site?.[1]).toMatch(
      /\.strip\[data-dragging\][^{]*\{[^}]*user-select/,
    );
  });

  for (const [file, source] of read) {
    it(`${file} gives every user-select its -webkit- twin`, () => {
      expect(unpaired(source)).toEqual([]);
    });
  }
});
