// Takes the pictures the look is held to: the built home page at a desk's
// width, a phone's and 320px, the 404 at a desk's, the privacy page at a desk's
// width and a phone's, and the first row with its second card focused by a
// real Tab. Reduced motion is emulated so that
// nothing is mid-glide, fonts are ready and every picture has decoded before
// a shot, and nothing waits on a timeout. Without this a colour gone muddy, a
// title that wraps, or a ring lost would pass every other check, since none of
// them looks.
//
// A picture of a whole page is taken in a window made as tall as the page,
// and never with Playwright's full-page shot (see openWhole, below, for the
// fault that was found in it). The baselines are in tests/look/baselines/ and
// are one machine's (a Mac, Chromium 1.65.1's own). Another font stack draws
// them a little differently, and is not argued with from there.
//
// The wobble was measured before the tolerance was chosen: see TOLERANCE.
import { expect, test, type Page } from '@playwright/test';
import { readRows } from '../e2e/catalogue';

/** The entries of the rows after the second, which wait for script. */
const LATE_IDS = readRows()
  .rows.slice(2)
  .flatMap((row) => row.entries);

/**
 * Over 8 runs of the unchanged page, each on a page just started, against a
 * baseline written with no allowance at all (threshold 0, 0 pixels), the
 * largest difference in any of the five pictures there then were was 0
 * pixels, on this Mac with Chromium from Playwright 1.65.1, 2026-11-22. That
 * was before a fault in how whole pages were pictured was found (see
 * openWhole); with it put right, the eight pictures passed 48 runs of 48
 * inside this allowance, six at once, on the same day. So the allowance is
 * only a sliver: 20 pixels, and a colour distance of 0.02 (of 1, in YIQ) for
 * a pixel to count at all, which is under what anti-aliasing of a re-drawn
 * glyph would move. A real change (a title's size, a token's colour) moves
 * hundreds to many thousands of pixels in these pictures.
 */
const TOLERANCE = { maxDiffPixels: 20, threshold: 0.02 };

/**
 * Fonts ready, every image loaded now and decoded, with no timeout. The late
 * rows' pictures wait for script until their row is near, so first the page
 * is scrolled to its foot a window at a time and back as a reader would, and
 * every picture is waited for to have an address. A page with no late row has none to wait for.
 */
async function settle(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const frames = () =>
      new Promise<void>((done) =>
        requestAnimationFrame(() => requestAnimationFrame(() => done())),
      );
    // A window's height at a time, so that every row is passed through: a row
    // jumped over is not near at any moment, and so is not brought in.
    const foot = document.documentElement.scrollHeight;
    for (let at = 0; at < foot; at += window.innerHeight) {
      window.scrollTo(0, at);
      await frames();
    }
    window.scrollTo(0, 0);
    await frames();
  });
  await expect(page.locator('img[data-src]')).toHaveCount(0);
  await page.evaluate(async () => {
    await document.fonts.ready;
    const images = [...document.images];
    for (const image of images) image.loading = 'eager';
    await Promise.all(images.map((image) => image.decode()));
  });
}

/**
 * Opens a page in a window as tall as the page itself, loaded afresh at that
 * size, so that an ordinary screenshot holds the whole of it and nothing about
 * the window changes after the page has drawn.
 *
 * Playwright's full-page shot was used first and gave the home page two
 * drawings, by chance, 5929 pixels apart. While it captures, the window's
 * width collapses for a moment, and every picture fetches the smallest file in
 * its srcset. The feature's smallest, 640 wide, is also one of its own card's
 * candidates, and when the width comes back Chromium may draw that card from
 * the 640 file it now has cached and not from its own 480, depending on which
 * request finished first. Only the card that shares a picture with the feature
 * was ever touched. This was first put down to the GPU and then to a coarse
 * first resample, and each of those workarounds only made it rarer. Measured
 * on 2026-11-22: with the full-page shot, 8 runs of 18 drew the 640 file; in a
 * window as tall as the page, 30 runs of 30 drew the 480 and fetched nothing
 * else.
 */
async function openWhole(
  page: Page,
  path: string,
  width: number,
  height: number,
  ready: (page: Page) => Promise<void> = () => Promise.resolve(),
): Promise<void> {
  await page.setViewportSize({ width, height });
  await page.goto(path);
  await ready(page);
  await settle(page);
  const tall = await page.evaluate(() => document.documentElement.scrollHeight);
  await page.setViewportSize({ width, height: tall });
  await page.reload();
  await ready(page);
  await settle(page);
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
    await openWhole(page, '/', width, height, async (opened) => {
      // Script has run once the row buttons have taken their state, except
      // at 320, where a row is stacked and has none; and the header's
      // Surprise me button is shown by the same script, at every width.
      if (width >= 340)
        await expect(opened.locator('[aria-disabled]').first()).toBeAttached();
      await expect(
        opened.getByRole('button', { name: 'Surprise me' }),
      ).toBeVisible();
    });
    await expect(page).toHaveScreenshot(`home-${width}.png`, TOLERANCE);
  });
}

test('the 404 at 1440', async ({ page }) => {
  await openWhole(page, '/nowhere-here/', 1440, 1000);
  await expect(page).toHaveScreenshot('404-1440.png', TOLERANCE);
});

for (const width of [1440, 390]) {
  test(`the privacy page at ${width}`, async ({ page }) => {
    await openWhole(
      page,
      '/privacy/',
      width,
      width > 800 ? 1000 : 844,
      async (opened) => {
        await expect(opened.getByRole('heading', { level: 1 })).toHaveText(
          'Privacy',
        );
      },
    );
    await expect(page).toHaveScreenshot(`privacy-${width}.png`, TOLERANCE);
  });
}

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

// The Toys row at 1440 as it waits: its pictures' requests are held at a route
// (and let go after the shot), so that what is drawn is each frame's own
// colour, mixed with the panel, and no picture. The colours are each picture's
// and are not tokens, so this is the one place they are seen and held.
test('the Toys row at 1440 with its pictures held back', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  let release: () => void = () => undefined;
  const gate = new Promise<void>((done) => {
    release = done;
  });
  await page.route(/\/_astro\/.*\.(avif|webp|jpe?g|png)$/, async (route) => {
    // The first two rows and the feature are not held, only the late rows'.
    const url = new URL(route.request().url()).pathname;
    const waits = LATE_IDS.some((id) => url.startsWith(`/_astro/${id}.`));
    if (waits) await gate;
    await route.continue().catch(() => undefined);
  });
  await page.goto('/');
  await expect(page.locator('[aria-disabled]').first()).toBeAttached();
  const row = page.locator('section[id="toys"]');
  await row.evaluate((el) => {
    el.scrollIntoView();
  });
  await expect(row.locator('img[data-src]')).toHaveCount(0);
  await expect(row).toHaveScreenshot('late-row-waiting-1440.png', {
    ...TOLERANCE,
  });
  release();
});
