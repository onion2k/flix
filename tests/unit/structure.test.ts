// Holds the catalogue to being plain TypeScript: nothing under src/catalogue
// imports from elsewhere in the project, and the only outside module it may
// name is astro/zod (the same zod Astro's collections use). Without this a
// quick import of a component or an astro:* module would pass every other
// test and tie the thing to the page. It counts the files it read, so that a
// moved folder is a failure and not a pass over nothing, and it tries its own
// reading on sources that do import wrongly, so that a pattern that matched
// nothing would be seen. It also holds that the language's own global random
// is named nowhere in src/, since all chance comes from catalogue/chance.ts.
import { describe, expect, it } from 'vitest';

// Vite reads every file in the folder as text, as the build would find them,
// so the test needs no file-system module. A file added later is read too.
const sources = import.meta.glob<string>('../../src/catalogue/**/*.ts', {
  query: '?raw',
  import: 'default',
  eager: true,
});
const allowedOutside = new Set(['astro/zod']);

// Every module specifier a source names: import and export from, a bare
// import, a dynamic import and require.
const specifier = /(?:\bfrom|\bimport|\brequire)\s*\(?\s*['"]([^'"]+)['"]/g;

function outsiders(source: string): string[] {
  const found: string[] = [];
  for (const match of source.matchAll(specifier)) {
    const name = match[1] ?? '';
    // A sibling in the same folder: "./x" and nothing that climbs out.
    const sibling = /^\.\/[^/]+$/.test(name);
    if (!sibling && !allowedOutside.has(name)) found.push(name);
  }
  return found;
}

describe('outsiders (the reading itself)', () => {
  it('finds what each way of importing from outside looks like', () => {
    expect(outsiders(`import x from '../components/Card.astro';`)).toEqual([
      '../components/Card.astro',
    ]);
    expect(outsiders(`import type { A } from "astro:content";`)).toEqual([
      'astro:content',
    ]);
    expect(outsiders(`import 'zod';`)).toEqual(['zod']);
    expect(outsiders(`export * from '../pages/x';`)).toEqual(['../pages/x']);
    expect(outsiders(`const a = await import('node:fs');`)).toEqual([
      'node:fs',
    ]);
    expect(outsiders(`const a = require('astro');`)).toEqual(['astro']);
  });

  it('lets through a sibling and astro/zod', () => {
    expect(outsiders(`import { z } from 'astro/zod';`)).toEqual([]);
    expect(outsiders(`import type { CatalogueFile } from './schema';`)).toEqual(
      [],
    );
  });
});

describe('src/catalogue', () => {
  const read = Object.entries(sources);

  it('has files to read, so that an empty folder is not a pass', () => {
    expect(read.length).toBeGreaterThanOrEqual(2);
  });

  for (const [file, source] of read) {
    it(`${file.replace('../../src/catalogue/', '')} imports nothing from outside the folder but astro/zod`, () => {
      expect(outsiders(source)).toEqual([]);
    });
  }
});

// Chance has one source, the seeded one in catalogue/chance.ts, so that a
// seed handed in by a test gives the same page every time. A call to the
// language's global random anywhere in the page, a script or a component
// would pass every other unit test and make the end-to-end ones differ from
// run to run. The files are read as text, .astro and .ts alike.
const everything = import.meta.glob<string>('../../src/**/*.{ts,astro}', {
  query: '?raw',
  import: 'default',
  eager: true,
});

const globalRandom = /\bMath\s*\.\s*random\b|\bcrypto\s*\.\s*getRandomValues\b/;

describe('the global random (the reading itself)', () => {
  it('finds each way of reaching for it, and nothing else', () => {
    expect(globalRandom.test('const a = Math.random();')).toBe(true);
    expect(globalRandom.test('const a = Math . random;')).toBe(true);
    expect(globalRandom.test('crypto.getRandomValues(x)')).toBe(true);
    expect(globalRandom.test('const a = seeded(1)();')).toBe(false);
    expect(globalRandom.test('Math.floor(random() * 2)')).toBe(false);
  });
});

describe('src', () => {
  const read = Object.entries(everything);

  it('has files to read, so that a moved folder is not a pass', () => {
    expect(read.length).toBeGreaterThan(20);
    expect(read.some(([file]) => file.endsWith('/catalogue/chance.ts'))).toBe(
      true,
    );
  });

  for (const [file, source] of read) {
    it(`${file.replace('../../src/', '')} does not use the global random`, () => {
      expect(globalRandom.test(source)).toBe(false);
    });
  }
});
