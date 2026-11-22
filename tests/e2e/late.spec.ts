// Holds that the pictures of every row after the second wait until their row
// is scrolled near: at a desk's width and a phone's, once the page has loaded
// and gone idle, nothing has been asked for any of them while the first two
// rows' and the feature's pictures have; scrolling to a row, following its nav
// link and Tabbing into it each bring its pictures in and drawn; a browser with
// no IntersectionObserver, and printing, bring them all in at once; and the
// markup itself holds no address a browser could fetch from, with the plain
// picture beside it in a <noscript>. Without this a lazy attribute that
// Chromium reads loosely (it fetched the pictures of every row, 2031px down a
// 1000px window) would pass every other test, and the page's weight would only
// be seen over its budget. Each test counts what it reached and waits on a
// state, never on a time.
import { expect, test, type Page } from '@playwright/test';
import { readRows } from './catalogue';

const catalogue = readRows();

/** The rows after the second, which wait: the rule in Row.astro. */
const LATE_FROM = 2;
const late = catalogue.rows.slice(LATE_FROM);
/** What a desk's width draws of the first row at once: Row.astro's rule. */
const EAGER_CARDS = 4;

const SIZES = [
  { name: 'a desk', width: 1440, height: 1000 },
  { name: 'a phone', width: 390, height: 844 },
];

/** Picture files are named by their entry's id, then a hash: `id.hash_x.avif`. */
function isPictureOf(url: string, id: string): boolean {
  return new URL(url).pathname.startsWith(`/_astro/${id}.`);
}

/** Starts listening for picture requests, and says which entries were asked for. */
function watch(page: Page): { urls: string[] } {
  const seen = { urls: [] as string[] };
  page.on('request', (request) => {
    if (request.resourceType() === 'image') seen.urls.push(request.url());
  });
  return seen;
}

function fetched(seen: { urls: string[] }, ids: string[]): string[] {
  return ids.filter((id) => seen.urls.some((url) => isPictureOf(url, id)));
}

/** Two frames drawn: where an observer's callback has had its turn. */
async function settled(page: Page): Promise<void> {
  await page.evaluate(
    () =>
      new Promise<void>((done) =>
        requestAnimationFrame(() => requestAnimationFrame(() => done())),
      ),
  );
}

/** The page has loaded, script has run, and the network has gone quiet. */
async function idle(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.locator('[aria-disabled]').first()).toBeAttached();
  await page.waitForLoadState('networkidle');
  await settled(page);
}

const ids = (rows: typeof late) => rows.flatMap((each) => each.entries);

/** Every picture of these entries is asked for, and drawn. */
async function drawn(
  page: Page,
  seen: { urls: string[] },
  entries: string[],
): Promise<void> {
  expect(entries.length).toBeGreaterThan(0);
  await expect.poll(() => fetched(seen, entries)).toEqual(entries);
  for (const id of entries) {
    const img = page.locator(`[data-entry="${id}"] img`);
    await expect
      .poll(() => img.evaluate((el: HTMLImageElement) => el.naturalWidth))
      .toBeGreaterThan(0);
  }
}

test('the catalogue has late rows to hold', () => {
  expect(late.length).toBeGreaterThan(0);
  expect(ids(late).length).toBeGreaterThan(0);
});

for (const size of SIZES) {
  test.describe(`at ${size.name}'s width`, () => {
    test.use({ viewport: { width: size.width, height: size.height } });

    test('no late row has asked for a picture, and the first rows have', async ({
      page,
    }) => {
      const seen = watch(page);
      await idle(page);
      expect(fetched(seen, ids(late))).toEqual([]);
      // Whatever was fetched before for the feature and the eager cards still is.
      const first = catalogue.rows[0];
      if (first === undefined) throw new Error('no rows were read');
      const eager = [catalogue.feature, ...first.entries.slice(0, EAGER_CARDS)];
      expect(fetched(seen, eager)).toEqual(eager);
    });

    test('scrolling to a late row brings its pictures in, drawn', async ({
      page,
    }) => {
      const seen = watch(page);
      await idle(page);
      const toys = late[0];
      if (toys === undefined) throw new Error('no late row');
      await page.locator(`section[id="${toys.id}"]`).evaluate((el) => {
        el.scrollIntoView();
      });
      await drawn(page, seen, toys.entries);
    });

    test('a row further down is brought in once it is near', async ({
      page,
    }) => {
      const seen = watch(page);
      await idle(page);
      const last = late[late.length - 1];
      if (last === undefined) throw new Error('no late row');
      expect(fetched(seen, last.entries)).toEqual([]);
      await page.locator(`section[id="${last.id}"]`).evaluate((el) => {
        el.scrollIntoView();
      });
      await drawn(page, seen, last.entries);
    });

    test('following a late row’s link in the nav loads it', async ({
      page,
    }) => {
      const seen = watch(page);
      await idle(page);
      const row = late[0];
      if (row === undefined) throw new Error('no late row');
      await page
        .getByRole('navigation')
        .getByRole('link', { name: row.title, exact: true })
        .click();
      await drawn(page, seen, row.entries);
    });

    test('Tabbing into a late row loads it', async ({ page }) => {
      const seen = watch(page);
      await idle(page);
      const row = late[0];
      if (row === undefined) throw new Error('no late row');
      const inRow = `section[id="${row.id}"] :focus`;
      let pressed = 0;
      while ((await page.locator(inRow).count()) === 0 && pressed < 60) {
        await page.keyboard.press('Tab');
        pressed += 1;
      }
      await expect(page.locator(inRow)).toHaveCount(1);
      await drawn(page, seen, row.entries);
    });

    test('printing brings every late picture in', async ({ page }) => {
      const seen = watch(page);
      await idle(page);
      expect(fetched(seen, ids(late))).toEqual([]);
      await page.evaluate(() => window.dispatchEvent(new Event('beforeprint')));
      await drawn(page, seen, ids(late));
    });
  });
}

test('with no IntersectionObserver every late picture is brought in at once', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Reflect.deleteProperty(window, 'IntersectionObserver');
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  const seen = watch(page);
  await page.goto('/');
  expect(await page.evaluate(() => typeof window.IntersectionObserver)).toBe(
    'undefined',
  );
  await expect(page.locator('[aria-disabled]').first()).toBeAttached();
  await drawn(page, seen, ids(late));
});

test('a card’s picture is one in the accessibility tree, before and after it loads', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await idle(page);
  const cards = page.locator('main li.card');
  const total = await cards.count();
  expect(total).toBeGreaterThan(ids(late).length);
  for (const id of ids(late)) {
    // Not yet loaded: nothing of it for a reader, and no alt words drawn.
    await expect(
      page.locator(`[data-entry="${id}"]`).getByRole('img'),
    ).toHaveCount(0);
  }
  await page.evaluate(() => window.dispatchEvent(new Event('beforeprint')));
  for (let at = 0; at < total; at += 1) {
    await expect(cards.nth(at).getByRole('img')).toHaveCount(1);
    await expect(cards.nth(at).getByRole('img')).toHaveAccessibleName(/\S/);
  }
});

// The markup, as the server sends it, with no script run over it.
test('a late picture’s markup holds no address to fetch, and the plain picture is beside it in a noscript', async ({
  request,
}) => {
  const html = await (await request.get('/')).text();
  const sections = html.split('<section class="row"').slice(1);
  expect(sections.length).toBe(catalogue.rows.length);
  let reached = 0;
  for (const [at, section] of sections.entries()) {
    const body = section.split('</section>')[0] ?? '';
    const cards = body.split('<li ').slice(1);
    expect(cards.length).toBe(catalogue.rows[at]?.entries.length);
    const plain = body.replace(/<noscript>[\s\S]*?<\/noscript>/g, '');
    if (at < LATE_FROM) {
      expect(body).not.toContain('<noscript>');
      expect(body).not.toContain('data-late');
      continue;
    }
    expect(section.split('>')[0]).toContain('data-late');
    expect(body.match(/<noscript>/g)?.length).toBe(cards.length);
    for (const card of cards) {
      const out = card.replace(/<noscript>[\s\S]*?<\/noscript>/g, '');
      expect(out).toContain('<picture');
      // Nothing a browser would fetch: no src or srcset, only data- ones.
      expect(out).not.toMatch(/\s(src|srcset)=/);
      expect(out).toMatch(/\sdata-srcset="[^"]+\.avif /);
      expect(out).toMatch(/\sdata-src="[^"]+\.jpeg"/);
      // The plain picture, as an early card has it.
      const noscript = /<noscript>([\s\S]*?)<\/noscript>/.exec(card)?.[1] ?? '';
      expect(noscript).toMatch(/<source srcset="[^"]+\.avif /);
      expect(noscript).toMatch(/<img src="[^"]+\.jpeg"/);
      expect(noscript).toContain('loading="lazy"');
      reached += 1;
    }
    expect(plain).not.toMatch(/<img[^>]*\ssrc=/);
  }
  expect(reached).toBe(ids(late).length);
});
