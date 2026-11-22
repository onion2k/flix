// Takes the pictures the look is held to: the built home page at a desk's
// width, a phone's and 320px, the 404 at a desk's, and the first row with its
// second card focused by a real Tab. Reduced motion is emulated so that
// nothing is mid-glide, fonts are ready and every picture has decoded before
// a shot, and nothing waits on a timeout. Pictures below the first screen are
// lazy and a full-page shot does not scroll to them, so each is made eager
// first, which changes when it loads and not what it draws. Without this a
// colour gone muddy, a title that wraps, or a ring lost would pass every
// other check, since none of them looks.
//
// The baselines are in tests/look/baselines/ and are one machine's (a Mac,
// Chromium 1.65.1's own). Another GPU or font stack draws them a little
// differently, and is not argued with from there.
//
// The wobble was measured before the tolerance was chosen: see TOLERANCE.
import { expect, test, type Page } from '@playwright/test';

/**
 * Over 8 runs of the unchanged page, each on a page just started, against a
 * baseline written with no allowance at all (threshold 0, 0 pixels), the
 * largest difference in any of the five pictures was 0 pixels, on this
 * Mac with Chromium from Playwright 1.65.1, 2026-11-22. So the allowance is
 * only a sliver: 20 pixels, and a colour distance of 0.02 (of 1, in YIQ) for
 * a pixel to count at all, which is under what anti-aliasing of a re-drawn
 * glyph would move. A real change (a title's size, a token's colour) moves
 * hundreds to many thousands of pixels in these pictures.
 */
const TOLERANCE = { maxDiffPixels: 20, threshold: 0.02 };

/** Fonts ready, every image loaded now and decoded, with no timeout. */
async function settle(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await document.fonts.ready;
    const images = [...document.images];
    for (const image of images) image.loading = 'eager';
    await Promise.all(images.map((image) => image.decode()));
  });
}

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
});

for (const [width, height] of [
  [1440, 1000],
  [390, 844],
  [320, 700],
] as const) {
  test(`the home page at ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto('/');
    // Script has run once the row buttons have taken their state, except at
    // 320, where a row is stacked and has none.
    if (width >= 340)
      await expect(page.locator('[aria-disabled]').first()).toBeAttached();
    await settle(page);
    await expect(page).toHaveScreenshot(`home-${width}.png`, {
      fullPage: true,
      ...TOLERANCE,
    });
  });
}

test('the 404 at 1440', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/nowhere-here/');
  await settle(page);
  await expect(page).toHaveScreenshot('404-1440.png', {
    fullPage: true,
    ...TOLERANCE,
  });
});

test('the first row at 1440 with its second card focused by keyboard', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
  await expect(page.locator('[aria-disabled]').first()).toBeAttached();
  await settle(page);
  const row = page.locator('section.row').first();
  const second = row.locator('.card').nth(1);
  for (let press = 0; press < 30; press += 1) {
    await page.keyboard.press('Tab');
    if (await second.locator('.card-link:focus').count()) break;
  }
  await expect(second.locator('.card-link:focus')).toHaveCount(1);
  await expect(row).toHaveScreenshot('first-row-second-card-focused.png', {
    ...TOLERANCE,
  });
});
