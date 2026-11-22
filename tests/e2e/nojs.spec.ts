// Holds that the page is whole without script: in a context with JavaScript
// off every card and picture is there, the rows' edge arrows and page marks
// are not shown (they would do nothing), each row that overflows keeps its
// scrollbar (a mouse with no sideways wheel has no other way along), and a
// focused strip scrolls by the arrow key. Without it a change that drew cards
// or showed the arrows from script, or hid the scrollbar for everyone, would
// pass every spec that runs with it.
import { expect } from '@playwright/test';
import { test } from '../clock';
import { readRows } from './catalogue';

const catalogue = readRows();

// Chromium on this Mac draws overlay scrollbars that take no room (the system's
// setting), and headless Chromium hides them besides (--hide-scrollbars), so a
// test of one would find none drawn however the page was made. Both are turned
// off here, which gives the classic bar of 15px, so that a scrollbar that is
// there is measured as there. Nothing else in this file measures one.
test.use({
  javaScriptEnabled: false,
  viewport: { width: 1440, height: 1000 },
  launchOptions: {
    ignoreDefaultArgs: ['--hide-scrollbars'],
    args: ['--disable-features=OverlayScrollbar'],
  },
});

test('every card and picture is there, and no arrow or page mark is shown', async ({
  page,
}) => {
  await page.goto('/');
  const total = catalogue.rows.reduce(
    (sum, each) => sum + each.entries.length,
    0,
  );
  expect(total).toBeGreaterThan(0);
  await expect(page.locator('main [data-entry]:not([hidden])')).toHaveCount(
    total + 1,
  );
  // One picture a card, and the feature's, in the accessibility tree: a late
  // card's placeholder is hidden with script off, and its plain picture is
  // the one in the <noscript>.
  await expect(page.locator('main').getByRole('img')).toHaveCount(total + 1);
  await expect(page.locator('main li.card')).toHaveCount(total);
  for (const card of await page.locator('main li.card').all())
    await expect(card.getByRole('img')).toHaveCount(1);
  await expect(page.getByRole('button')).toHaveCount(0);
  await expect(page.locator('button:visible')).toHaveCount(0);
  await expect(page.locator('.row-pages .page-mark')).toHaveCount(0);
  await expect(page.locator('section.row[data-arrows]')).toHaveCount(0);
});

test('a row that overflows keeps its scrollbar', async ({ page }) => {
  await page.goto('/');
  let reached = 0;
  for (const each of catalogue.rows) {
    const list = page.locator(`section[id="${each.id}"]`).getByRole('list');
    const bar = await list.evaluate((el: HTMLElement) => ({
      overflows: el.scrollWidth - el.clientWidth > 1,
      shown: el.offsetHeight - el.clientHeight,
    }));
    if (!bar.overflows) continue;
    reached += 1;
    expect(bar.shown, `${each.id} has a scrollbar`).toBeGreaterThan(0);
  }
  expect(reached).toBeGreaterThan(0);
});

test('the Surprise me button is in the markup, hidden, and neither seen nor in the accessibility tree', async ({
  page,
}) => {
  await page.goto('/');
  // It is there, so that this reaches something: a button that was never
  // written would pass "not seen" in silence.
  const surprise = page.locator('.site-header nav button[data-surprise]');
  await expect(surprise).toHaveCount(1);
  await expect(surprise).toHaveAttribute('hidden', '');
  await expect(surprise).toBeHidden();
  await expect(surprise).toHaveText('Surprise me');
  await expect(page.getByRole('button', { name: 'Surprise me' })).toHaveCount(
    0,
  );
  await expect(
    page.getByRole('button', { name: 'Surprise me', includeHidden: true }),
  ).toHaveCount(1);
  // Tab does not stop on it: after the last row link comes the page's own.
  const rows = catalogue.rows.length;
  expect(rows).toBeGreaterThan(0);
  for (let stop = 0; stop < rows + 1; stop += 1)
    await page.keyboard.press('Tab');
  const name = await page.evaluate(
    () => document.activeElement?.textContent?.trim() ?? '',
  );
  expect(name).toBe(catalogue.rows[rows - 1]?.title);
  await page.keyboard.press('Tab');
  expect(
    await page.evaluate(() => document.activeElement?.textContent?.trim()),
  ).not.toBe('Surprise me');
});

test('every picture is drawn once it is scrolled to, late rows included', async ({
  page,
}) => {
  await page.goto('/');
  const images = page.locator('main').getByRole('img');
  const count = await images.count();
  expect(count).toBeGreaterThan(catalogue.rows.length);
  for (let at = 0; at < count; at += 1) {
    const img = images.nth(at);
    await img.scrollIntoViewIfNeeded();
    await expect
      .poll(() => img.evaluate((el: HTMLImageElement) => el.naturalWidth))
      .toBeGreaterThan(0);
  }
});

test('a focused strip scrolls by the arrow key', async ({ page }) => {
  await page.goto('/');
  const first = catalogue.rows[0];
  if (first === undefined) throw new Error('no rows were read');
  const list = page.locator(`section[id="${first.id}"]`).getByRole('list');
  await list.focus();
  await page.keyboard.press('ArrowRight');
  await expect
    .poll(() => list.evaluate((el) => el.scrollLeft))
    .toBeGreaterThan(0);
});

test('no card grows, no loop is fetched and the page holds no video, though cards carry their loops’ addresses', async ({
  page,
}) => {
  const urls: string[] = [];
  page.on('request', (request) => urls.push(request.url()));
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  // The addresses are in the markup, so that a page with none does not pass
  // in silence; they are only attributes, which no browser fetches.
  const looped = page.locator('li.card[data-loop]');
  expect(await looped.count()).toBeGreaterThan(0);
  // A real mouse on one, as long as a reader would hold it, grows nothing.
  const card = looped.first();
  await card.scrollIntoViewIfNeeded();
  await card.hover();
  await expect(page.locator('.grown')).toHaveCount(0);
  await expect(page.locator('video')).toHaveCount(0);
  expect(urls.filter((url) => /\.webm(\?|$)/.test(url))).toEqual([]);
  // Each card keeps the one picture it had.
  await expect(card.getByRole('img')).toHaveCount(1);
});
