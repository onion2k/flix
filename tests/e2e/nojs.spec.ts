// Holds that the page is whole without script: in a context with JavaScript
// off every card and picture is there, the row buttons are not shown (they
// would do nothing), and a focused strip scrolls by the arrow key. Without it
// a change that drew cards or showed the buttons from script would pass every
// spec that runs with it.
import { expect, test } from '@playwright/test';
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
  await expect(page.locator('main picture img')).toHaveCount(total + 1);
  await expect(page.getByRole('button')).toHaveCount(0);
  await expect(page.locator('button:visible')).toHaveCount(0);
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
