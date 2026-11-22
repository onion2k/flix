// Holds the content policy the build writes into dist/_headers, in two ways.
// The file is read as text: one rule for every path, one policy, with the
// directives that matter and no 'unsafe-inline' or 'unsafe-eval' in a script
// or style source, and then, worked out here from each built page with this
// file's own SHA-256, every inline script and style of every page is in it. The
// policy is then enforced as a browser enforces a header: the preview server
// sends no _headers file, so each document is fetched and fulfilled again with
// the policy from the file as its Content-Security-Policy header, and the home
// page (on a day whose feature is the first and on one whose feature is another,
// so that the inline script runs both ways), the privacy page and the 404 are
// opened under it. Nothing may be refused, said to the console or reported as a
// violation, and what the policy exists to leave alone still works: the fonts,
// the page's script, a late row's pictures and the day's
// feature. That the header was applied is shown, not assumed: the response is
// read back, and two controls, a header that forbids every script and one that
// leaves out the hashes of the styles written before the page's own meta tag
// (which only a header governs), are seen to break the page.
//
// What this does not hold is the policy as Netlify serves it: nothing here
// reads netlify.toml or meets Netlify. `npm run headers` against the live
// address does that, after a deploy. Each test counts what it reached, so that
// finding nothing is a failure and not a pass.
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { expect, type Page, type Route } from '@playwright/test';
import { noonOf, test } from '../clock';
import { candidatesOf, readRows } from './catalogue';

const DIST = join(import.meta.dirname, '../../dist');

/** Every built page, as paths under dist/, read from the folder. */
function pagesOf(folder: string): string[] {
  return readdirSync(folder, { withFileTypes: true }).flatMap((entry) => {
    const path = join(folder, entry.name);
    if (entry.isDirectory()) return pagesOf(path);
    return entry.name.endsWith('.html') ? [path] : [];
  });
}

/** The name a source gives an inline text: sha256-, then the digest in base64. */
const hashOf = (text: string): string =>
  `'sha256-${createHash('sha256').update(text, 'utf8').digest('base64')}'`;

/** The file as written, and the policy it holds, by directive. */
function headerFile(): { text: string; policy: string } {
  const text = readFileSync(join(DIST, '_headers'), 'utf8');
  const lines = text.split('\n').filter((line) => !line.startsWith('#'));
  expect(
    lines.filter((line) => /^\S/.test(line) && line.trim() !== ''),
    'one rule, for every path',
  ).toEqual(['/*']);
  const policies = lines.filter((line) =>
    /^\s+Content-Security-Policy:/.test(line),
  );
  expect(policies, 'one Content-Security-Policy').toHaveLength(1);
  return {
    text,
    policy: (policies[0] ?? '')
      .replace(/^\s+Content-Security-Policy:\s*/, '')
      .trim(),
  };
}

/** A policy as directives: name to sources. */
function directives(policy: string): Map<string, string[]> {
  const found = new Map<string, string[]>();
  for (const part of policy.split(';')) {
    const [name, ...sources] = part.trim().split(/\s+/);
    if (name !== undefined && name !== '') found.set(name, sources);
  }
  return found;
}

interface Inline {
  page: string;
  tag: 'script' | 'style';
  hash: string;
  /** Written before the page's own meta policy, so that only a header holds it. */
  early: boolean;
}

/** Every inline script and style of every built page, with its own hash. */
function inlineOf(folder: string): { pages: string[]; found: Inline[] } {
  const pages = pagesOf(folder);
  const found: Inline[] = [];
  for (const file of pages) {
    const html = readFileSync(file, 'utf8');
    const meta = html.indexOf('<meta http-equiv="content-security-policy"');
    for (const match of html.matchAll(
      /<(script|style)\b([^>]*)>([\s\S]*?)<\/\1>/g,
    )) {
      if (/\ssrc=/.test(match[2] ?? '')) continue;
      found.push({
        page: relative(folder, file),
        tag: match[1] as 'script' | 'style',
        hash: hashOf(match[3] ?? ''),
        early: match.index < meta,
      });
    }
  }
  return { pages: pages.map((file) => relative(folder, file)), found };
}

test.describe('the file, read as text', () => {
  test('is one rule with one policy holding what the whole site needs', () => {
    const { policy } = headerFile();
    const found = directives(policy);
    expect(found.get('frame-ancestors')).toEqual(["'none'"]);
    expect(found.get('object-src')).toEqual(["'none'"]);
    expect(found.get('base-uri')).toEqual(["'none'"]);
    expect(found.get('default-src')).toEqual(["'self'"]);
    for (const name of ['script-src', 'style-src']) {
      const sources = found.get(name) ?? [];
      expect(sources.length, `${name} was read`).toBeGreaterThan(0);
      expect(sources).not.toContain("'unsafe-inline'");
      expect(sources).not.toContain("'unsafe-eval'");
    }
  });

  test('holds the hash of every inline script and style of every built page', () => {
    const found = directives(headerFile().policy);
    const { pages, found: inline } = inlineOf(DIST);
    // Counted, so that reading nothing is a failure: three pages, each with
    // its styles, and the home page's one inline script.
    expect(pages.length).toBeGreaterThanOrEqual(3);
    expect(
      inline.filter((each) => each.tag === 'style').length,
    ).toBeGreaterThan(0);
    expect(
      inline.filter((each) => each.tag === 'script').length,
    ).toBeGreaterThan(0);
    for (const each of inline) {
      const allowed = found.get(`${each.tag}-src`) ?? [];
      expect(
        allowed,
        `${each.page}: an inline ${each.tag} of hash ${each.hash}`,
      ).toContain(each.hash);
    }
  });

  test('is read from a build that has early styles for a header alone to hold', () => {
    // If no style came before a page's meta tag this file's reason for hashing
    // the page itself, and the control below, would be about nothing.
    const early = inlineOf(DIST).found.filter(
      (each) => each.tag === 'style' && each.early,
    );
    expect(early.length).toBeGreaterThan(0);
  });
});

const catalogue = readRows();
const COUNT = candidatesOf(catalogue).length;

/** A day number, near 2024, that falls at the given place in the list. */
function dayAt(place: number): number {
  const base = 20_000;
  return base - (base % COUNT) + place;
}

interface Watched {
  violations: string[];
  talk: string[];
  /** The policy header each document was sent under, as the page was served. */
  served: string[];
}

/**
 * Serves every document of the site with this policy as its header, as Netlify
 * will serve `_headers`, and listens for what the browser then refuses. The
 * listener is an init script, so that it is in place before any script of the
 * page and sees a refusal of the first style written.
 */
async function enforce(page: Page, policy: string): Promise<Watched> {
  const watched: Watched = { violations: [], talk: [], served: [] };
  await page.exposeFunction('reportViolation', (what: string) => {
    watched.violations.push(what);
  });
  await page.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', (event) => {
      const report = Reflect.get(window, 'reportViolation') as (
        what: string,
      ) => void;
      report(
        `${event.effectiveDirective} blocked ${event.blockedURI || 'inline'} at ${event.sourceFile}:${event.lineNumber}`,
      );
    });
  });
  page.on('console', (message) => {
    // The browser says so, once, of a document answered with 404: not a thing
    // the policy did, and the 404 page is held to be one that does.
    if (
      message.location().url.endsWith(MISSING) &&
      /status of 404/.test(message.text())
    )
      return;
    if (['error', 'warning'].includes(message.type()))
      watched.talk.push(`${message.type()}: ${message.text()}`);
  });
  page.on('pageerror', (error) =>
    watched.talk.push(`uncaught: ${error.message}`),
  );
  await page.route('**/*', async (route: Route) => {
    if (route.request().resourceType() !== 'document') return route.continue();
    const response = await route.fetch();
    watched.served.push(policy);
    return route.fulfill({
      response,
      headers: { ...response.headers(), 'content-security-policy': policy },
    });
  });
  return watched;
}

/** Holds that nothing was refused or said, and that the header was in force. */
async function clean(page: Page, watched: Watched): Promise<void> {
  // The page has run its scripts and drawn, so a refusal has been reported.
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  expect(watched.served.length, 'a document was served with the header').toBe(
    1,
  );
  expect(watched.violations).toEqual([]);
  expect(watched.talk).toEqual([]);
}

/** The families of the faces the document has loaded. */
function loadedFaces(page: Page): Promise<string[]> {
  return page.evaluate(async () => {
    await document.fonts.ready;
    return [...document.fonts]
      .filter((face) => face.status === 'loaded')
      .map((face) =>
        // Astro names each face it hosts with a hash after the family.
        face.family.replace(/["']/g, '').replace(/-[0-9a-f]{16}$/, ''),
      );
  });
}

/** A path with no page, so that the site answers with its 404 page. */
const MISSING = '/nowhere-here/';

const FACES = ['Big Shoulders', 'Atkinson Hyperlegible'];

test.use({ viewport: { width: 1440, height: 1000 } });

test.describe('under the header, as a browser enforces it', () => {
  for (const [name, place] of [
    ['the first candidate', 0],
    ['another candidate', 1],
  ] as const) {
    test(`the home page, whose feature is ${name}, is whole and clean`, async ({
      page,
    }) => {
      const { policy } = headerFile();
      const watched = await enforce(page, policy);
      await page.clock.setFixedTime(noonOf(dayAt(place)));
      const response = await page.goto('/');

      // The header was sent, and is the one the file holds.
      expect(response?.headers()['content-security-policy']).toBe(policy);

      // The day's feature is the one this day gives, and its picture is drawn.
      const shown = page.locator('section.feature:not([hidden])');
      await expect(shown).toHaveCount(1);
      const id = candidatesOf(catalogue)[place];
      await expect(shown).toHaveAttribute('data-entry', id ?? '');
      const picture = shown.locator('img').first();
      await expect
        .poll(() =>
          picture.evaluate(
            (img: HTMLImageElement) => img.complete && img.naturalWidth > 0,
          ),
        )
        .toBe(true);

      // The page's script has run: Surprise me is shown, and a row's Previous
      // button has taken its state.
      await expect(page.locator('button[data-surprise]')).toBeVisible();
      const first = catalogue.rows[0];
      expect(first, 'a row was read').toBeDefined();
      await expect(
        page
          .locator(`section[id="${first?.id ?? ''}"]`)
          .getByRole('button', { name: /^Previous/ }),
      ).toHaveAttribute('aria-disabled', 'true');

      // The fonts are the site's own, the display and the body face.
      const faces = await loadedFaces(page);
      for (const face of FACES) expect(faces, face).toContain(face);

      await clean(page, watched);
    });
  }

  for (const [name, path] of [
    ['the privacy page', '/privacy/'],
    ['the 404', MISSING],
  ] as const) {
    test(`${name} is whole and clean`, async ({ page }) => {
      const watched = await enforce(page, headerFile().policy);
      const response = await page.goto(path);
      expect(response?.headers()['content-security-policy']).toBe(
        headerFile().policy,
      );
      await expect(page.locator('main, h1').first()).toBeVisible();
      const faces = await loadedFaces(page);
      for (const face of FACES) expect(faces, face).toContain(face);
      await clean(page, watched);
    });
  }

  test("a late row's pictures arrive when it is scrolled to", async ({
    page,
  }) => {
    const watched = await enforce(page, headerFile().policy);
    await page.goto('/');
    const last = catalogue.rows.at(-1);
    expect(last, 'a last row was read').toBeDefined();
    const section = page.locator(`section[id="${last?.id ?? ''}"]`);
    await section.scrollIntoViewIfNeeded();
    const pictures = section.locator('img[src]');
    await expect
      .poll(() =>
        pictures.evaluateAll(
          (all) =>
            all.length > 0 &&
            all.every(
              (img) =>
                (img as HTMLImageElement).complete &&
                (img as HTMLImageElement).naturalWidth > 0,
            ),
        ),
      )
      .toBe(true);
    await clean(page, watched);
  });
});

test.describe('the header is what is enforced: two controls', () => {
  test('a header that forbids every script stops the page working, and says so', async ({
    page,
  }) => {
    const { policy } = headerFile();
    const strict = policy.replace(/script-src[^;]*/, "script-src 'none'");
    expect(strict, 'the control differs from the policy').not.toBe(policy);
    const watched = await enforce(page, strict);
    await page.goto('/');
    await expect
      .poll(() => watched.violations.some((each) => /^script-src/.test(each)))
      .toBe(true);
    // The page's script was refused, so its button is not shown.
    await expect(page.locator('button[data-surprise]')).toBeHidden();
  });

  test('a header without the hashes of the styles written before the meta tag refuses them', async ({
    page,
  }) => {
    const { policy } = headerFile();
    const early = inlineOf(DIST).found.filter(
      (each) =>
        each.tag === 'style' && each.early && each.page === 'index.html',
    );
    expect(early.length, 'early styles were found').toBeGreaterThan(0);
    const without = policy
      .split(';')
      .map((part) =>
        part.trim().startsWith('style-src')
          ? part
              .split(/\s+/)
              .filter((source) => !early.some((each) => each.hash === source))
              .join(' ')
          : part,
      )
      .join(';');
    expect(without, 'the control differs from the policy').not.toBe(policy);
    const watched = await enforce(page, without);
    await page.goto('/');
    // The page's own meta policy holds these hashes, but it is read only after
    // the styles, so it is the header that refuses them, once for each.
    await expect
      .poll(
        () =>
          watched.violations.filter((each) => /^style-src/.test(each)).length,
      )
      .toBe(early.length);
  });
});
