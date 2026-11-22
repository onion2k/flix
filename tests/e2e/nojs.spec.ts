// Holds that the page is whole without script: in a context with JavaScript
// off every card and picture is there, the row buttons are not shown (they
// would do nothing), and a focused strip scrolls by the arrow key. Without it
// a change that drew cards or showed the buttons from script would pass every
// spec that runs with it.
import { expect } from '@playwright/test';
import { test } from '../clock';
import { readRows } from './catalogue';

const catalogue = readRows();

test.use({ javaScriptEnabled: false, viewport: { width: 1440, height: 1000 } });

test('every card and picture is there, and no row button is shown', async ({
  page,
}) => {
  await page.goto('/');
  const total = catalogue.rows.reduce(
    (sum, each) => sum + each.entries.length,
    0,
  );
  expect(total).toBeGreaterThan(0);
  await expect(page.locator('main [data-entry]')).toHaveCount(total + 1);
  // One picture a card, and the feature's, in the accessibility tree: a late
  // card's placeholder is hidden with script off, and its plain picture is
  // the one in the <noscript>.
  await expect(page.locator('main').getByRole('img')).toHaveCount(total + 1);
  await expect(page.locator('main li.card')).toHaveCount(total);
  for (const card of await page.locator('main li.card').all())
    await expect(card.getByRole('img')).toHaveCount(1);
  await expect(page.getByRole('button')).toHaveCount(0);
  await expect(page.locator('button:visible')).toHaveCount(0);
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
