// Holds what the home page says: one h1 and no skipped heading, the feature,
// every row and every card in the order written, each picture drawn with its
// size, alt words and a modern source, each card a link or not as its label
// says, the lazy-loading rule, and the head, robots.txt, sitemap and 404 all
// made from the one site address. Each test counts what it reached, so a page
// that drew nothing fails and does not pass over nothing.
import { expect, test, type Locator } from '@playwright/test';
import { LABELS, readRows } from './catalogue';

const SITE = 'https://flix.ooer.com';
const catalogue = readRows();

// The lazy rule: the feature, and the first four cards of the first row (what
// a desk's width shows of it), are loaded at once; every other picture waits
// until it is near the screen.
const EAGER_CARDS_IN_FIRST_ROW = 4;

function row(page: import('@playwright/test').Page, id: string): Locator {
  return page.locator(`section[id="${id}"]`);
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('the catalogue was read, so that reading nothing is not a pass', () => {
  expect(catalogue.feature).not.toBe('');
  expect(catalogue.rows.length).toBeGreaterThan(0);
  for (const each of catalogue.rows) {
    expect(each.title).not.toBe('');
    expect(each.entries.length).toBeGreaterThan(0);
  }
});

test('there is one h1, and no heading level is skipped', async ({ page }) => {
  await expect(page.locator('h1')).toHaveCount(1);
  const levels = await page
    .locator('h1, h2, h3, h4, h5, h6')
    .evaluateAll((all) => all.map((each) => Number(each.tagName.slice(1))));
  expect(levels.length).toBeGreaterThan(1);
  expect(levels[0]).toBe(1);
  levels.forEach((level, at) => {
    if (at > 0) expect(level).toBeLessThanOrEqual((levels[at - 1] ?? 0) + 1);
  });
});

test('the wordmark is the h1 and is not a link', async ({ page }) => {
  const h1 = page.getByRole('heading', { level: 1 });
  await expect(h1).toHaveText('ooerflix');
  await expect(h1.getByRole('link')).toHaveCount(0);
});

test('the feature has its label, title, words and Play link', async ({
  page,
}) => {
  const feature = page.locator('main > section').first();
  await expect(feature).toHaveAttribute('data-entry', catalogue.feature);
  const title = feature.getByRole('heading', { level: 2 });
  await expect(title).toHaveCount(1);
  const name = (await title.textContent()) ?? '';
  expect(name.length).toBeGreaterThan(0);
  const label = await feature.locator('[data-label]').textContent();
  expect(LABELS).toContain(label);
  await expect(feature.locator('p:not([data-label])')).not.toBeEmpty();
  const play = feature.getByRole('link');
  await expect(play).toHaveCount(1);
  await expect(play).toHaveAccessibleName(`Play ${name}`);
  expect(await play.getAttribute('href')).toMatch(/^https:\/\//);
  // No words are laid over the picture: nothing but the picture is in its box.
  await expect(feature.locator('picture')).toHaveCount(1);
  expect(await feature.locator('picture').evaluate((p) => p.textContent)).toBe(
    '',
  );
});

test('the feature picture is loaded at once and at high priority', async ({
  page,
}) => {
  const img = page.locator('main > section').first().locator('img');
  await expect(img).not.toHaveAttribute('loading', 'lazy');
  await expect(img).toHaveAttribute('fetchpriority', 'high');
});

test('every row is there in order, with its link in the nav', async ({
  page,
}) => {
  const ids = await page
    .locator('main section[id]')
    .evaluateAll((all) => all.map((each) => each.id));
  expect(ids).toEqual(catalogue.rows.map((each) => each.id));
  const links = page.getByRole('navigation').getByRole('link');
  await expect(links).toHaveCount(catalogue.rows.length);
  for (const [at, each] of catalogue.rows.entries()) {
    await expect(links.nth(at)).toHaveText(each.title);
    await expect(links.nth(at)).toHaveAttribute('href', `#${each.id}`);
    await expect(
      row(page, each.id).getByRole('heading', { level: 2 }),
    ).toHaveText(each.title);
  }
});

test('every card is there in the order written', async ({ page }) => {
  let reached = 0;
  for (const each of catalogue.rows) {
    const ids = await row(page, each.id)
      .locator('[data-entry]')
      .evaluateAll((all) => all.map((card) => card.getAttribute('data-entry')));
    expect(ids).toEqual(each.entries);
    reached += ids.length;
  }
  expect(reached).toBeGreaterThan(0);
});

test('every picture has loaded, with size, alt words and a modern source', async ({
  page,
}) => {
  const cards = page.locator('[data-entry]');
  const total = await cards.count();
  expect(total).toBeGreaterThan(catalogue.rows.length);
  for (let at = 0; at < total; at += 1) {
    const card = cards.nth(at);
    const img = card.locator('img');
    await img.scrollIntoViewIfNeeded();
    await expect
      .poll(() => img.evaluate((el: HTMLImageElement) => el.naturalWidth))
      .toBeGreaterThan(0);
    expect(Number(await img.getAttribute('width'))).toBeGreaterThan(0);
    expect(Number(await img.getAttribute('height'))).toBeGreaterThan(0);
    expect(
      ((await img.getAttribute('alt')) ?? '').trim().length,
    ).toBeGreaterThan(0);
    for (const type of ['image/avif', 'image/webp']) {
      const source = card.locator(`picture source[type="${type}"]`);
      await expect(source).toHaveCount(1);
      const srcset = (await source.getAttribute('srcset')) ?? '';
      expect(srcset.split(',').length).toBeGreaterThan(1);
    }
    expect(await img.getAttribute('sizes')).not.toBeNull();
  }
});

test('each card says one of the four labels, and is a link only where it can be played', async ({
  page,
}) => {
  const cards = page.locator('main [data-entry]');
  const total = await cards.count();
  expect(total).toBeGreaterThan(0);
  let playable = 0;
  let workshop = 0;
  for (let at = 0; at < total; at += 1) {
    const card = cards.nth(at);
    const label = (await card.locator('[data-label]').textContent()) ?? '';
    expect(LABELS).toContain(label);
    const title = (await card.getByRole('heading').textContent()) ?? '';
    const links = card.getByRole('link');
    if (label.endsWith('Play now')) {
      playable += 1;
      await expect(links).toHaveCount(1);
      await expect(links).toHaveAccessibleName(`Play ${title}`);
      expect(await links.getAttribute('href')).toMatch(/^https:\/\//);
    } else {
      workshop += 1;
      await expect(links).toHaveCount(0);
    }
  }
  expect(playable).toBeGreaterThan(0);
  expect(workshop).toBeGreaterThan(0);
});

test('two pinned entries: chess links out, ooergolf does not', async ({
  page,
}) => {
  const chess = page.locator('[data-entry="chess"]');
  await expect(chess.getByRole('link')).toHaveAttribute(
    'href',
    'https://onion2k.github.io/chess/',
  );
  await expect(page.locator('[data-entry="ooergolf"]')).toHaveCount(1);
  await expect(
    page.locator('[data-entry="ooergolf"]').getByRole('link'),
  ).toHaveCount(0);
});

test('only the first screenful of pictures is loaded at once', async ({
  page,
}) => {
  let reached = 0;
  for (const [rowAt, each] of catalogue.rows.entries()) {
    const imgs = row(page, each.id).locator('img');
    const count = await imgs.count();
    expect(count).toBe(each.entries.length);
    for (let at = 0; at < count; at += 1) {
      const eager = rowAt === 0 && at < EAGER_CARDS_IN_FIRST_ROW;
      if (eager)
        await expect(imgs.nth(at)).not.toHaveAttribute('loading', 'lazy');
      else await expect(imgs.nth(at)).toHaveAttribute('loading', 'lazy');
      reached += 1;
    }
  }
  expect(reached).toBeGreaterThan(EAGER_CARDS_IN_FIRST_ROW);
});

test('the head is made from the one site address', async ({
  page,
  request,
}) => {
  const content = (selector: string, attribute: string) =>
    page.locator(selector).getAttribute(attribute);
  expect(await content('link[rel="canonical"]', 'href')).toBe(`${SITE}/`);
  expect(await content('meta[property="og:url"]', 'content')).toBe(`${SITE}/`);
  expect(await content('meta[property="og:type"]', 'content')).not.toBeNull();
  expect(await content('meta[property="og:title"]', 'content')).toBe(
    await page.title(),
  );
  expect(await content('meta[property="og:description"]', 'content')).toBe(
    await content('meta[name="description"]', 'content'),
  );
  expect(await content('meta[name="description"]', 'content')).toBe(
    'Games and toys to play in a browser.',
  );
  expect(await content('meta[name="color-scheme"]', 'content')).toBe('dark');
  expect(await content('meta[name="twitter:card"]', 'content')).toBe(
    'summary_large_image',
  );
  expect(
    (await content('meta[property="og:image:alt"]', 'content')) ?? '',
  ).not.toBe('');
  expect(await content('link[rel="icon"]', 'href')).toBe('/favicon.svg');
  const image = (await content('meta[property="og:image"]', 'content')) ?? '';
  expect(image.startsWith(`${SITE}/`)).toBe(true);
  // The picture is on the site's address, and here it is the same path.
  const served = await request.get(new URL(image).pathname);
  expect(served.status()).toBe(200);
  expect(served.headers()['content-type']).toMatch(/^image\//);
  expect((await request.get('/favicon.svg')).status()).toBe(200);
});

test('robots.txt and the sitemap answer and name the address', async ({
  request,
}) => {
  const robots = await request.get('/robots.txt');
  expect(robots.status()).toBe(200);
  const robotsText = await robots.text();
  expect(robotsText).toContain('User-agent: *');
  expect(robotsText).toContain('Allow: /');
  expect(robotsText).toContain(`Sitemap: ${SITE}/sitemap.xml`);
  const sitemap = await request.get('/sitemap.xml');
  expect(sitemap.status()).toBe(200);
  const listed = await sitemap.text();
  expect(listed).toContain(`<loc>${SITE}/</loc>`);
  expect(listed).toContain(`<loc>${SITE}/privacy/</loc>`);
});

// Spec 1 of plans/before-public.md: every page ends in the same footer. Each
// page is reached and each of its parts counted, so a page with none fails.
for (const { name, path } of [
  { name: 'the home page', path: '/' },
  { name: 'the 404', path: '/nowhere-here/' },
  { name: 'the privacy page', path: '/privacy/' },
]) {
  test(`${name} ends in one footer with Privacy, the licences and Source`, async ({
    page,
  }) => {
    await page.goto(path);
    const footer = page.getByRole('contentinfo');
    await expect(footer).toHaveCount(1);
    await expect(footer.getByRole('link')).toHaveCount(4);
    await expect(
      footer.getByRole('link', { name: 'Privacy', exact: true }),
    ).toHaveAttribute('href', '/privacy/');
    await expect(
      footer.getByRole('link', { name: 'Source', exact: true }),
    ).toHaveAttribute('href', 'https://github.com/onion2k/flix');
    // The words are one line, and each licence in it is a link that says so.
    const line = footer.locator('p');
    await expect(line).toHaveCount(1);
    await expect(line).toHaveText('Words and pictures CC BY 4.0, code MIT');
    for (const [label, address] of [
      ['CC BY 4.0', 'https://creativecommons.org/licenses/by/4.0/'],
      ['MIT', 'https://opensource.org/license/mit'],
    ] as const) {
      const link = line.getByRole('link', { name: label, exact: true });
      await expect(link).toHaveCount(1);
      await expect(link).toHaveAttribute('href', address);
      await expect(link).toHaveAttribute('rel', 'license');
    }
    // It ends the page: after main, and not inside it.
    const after = await page.evaluate(() => {
      const main = document.querySelector('main');
      const foot = document.querySelector('footer');
      return {
        inMain: main?.contains(foot ?? null) ?? true,
        follows:
          main !== null &&
          foot !== null &&
          Boolean(
            main.compareDocumentPosition(foot) &
            Node.DOCUMENT_POSITION_FOLLOWING,
          ),
      };
    });
    expect(after).toEqual({ inMain: false, follows: true });
  });
}

test('an unknown path answers 404 with the 404 page', async ({ page }) => {
  const response = await page.goto('/no-such-page/');
  expect(response?.status()).toBe(404);
  await expect(page.getByText('That page is not here.')).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'Back to the games' }),
  ).toHaveAttribute('href', '/');
  await expect(
    page.getByRole('banner').getByRole('link', { name: 'ooerflix' }),
  ).toHaveAttribute('href', '/');
});
