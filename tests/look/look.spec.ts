// Takes the pictures the look is held to: the built home page at a desk's
// width, a phone's and 320px, the 404 at a desk's, the privacy page at a desk's
// width and a phone's, the first row with its second card focused by a real
// Tab, the first row with a card flipped at a desk's width and a phone's, the
// moving hero with its loop held, and the first row with its card in focus
// playing its loop, held, at a desk's width and a phone's. Reduced motion is emulated so that
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
import { expect, type Page } from '@playwright/test';
import { noonOf, test } from '../clock';
import { candidatesOf, readRows } from '../e2e/catalogue';

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
  await expect(page.locator('section.row img[data-src]')).toHaveCount(0);
  await page.evaluate(async () => {
    await document.fonts.ready;
    // A hidden feature candidate's picture has no address by design, and an
    // image with none cannot be decoded.
    const images = [...document.images].filter(
      (image) => image.currentSrc !== '' || image.src !== '',
    );
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
      // Script has run once the rows have been given their arrows (the mark
      // is set at every width, a stacked row's included, though it draws
      // none).
      await expect(
        opened.locator('section.row[data-arrows]').first(),
      ).toBeAttached();
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
  await expect(page.locator('section.row[data-arrows]').first()).toBeAttached();
  await settle(page);
  const row = page.locator('section.row').first();
  const second = row.locator('.card').nth(1);
  for (let press = 0; press < 30; press += 1) {
    await page.keyboard.press('Tab');
    if (await second.locator('.card-flip:focus').count()) break;
  }
  await expect(second.locator('.card-flip:focus')).toHaveCount(1);
  await expect(row).toHaveScreenshot('first-row-second-card-focused.png', {
    ...TOLERANCE,
  });
});

// The first row at 1440 part way along, as a reader sees it once script has
// run: no scrollbar, an arrow on each edge over the cut-off cards, and the
// marks at the top right with the middle page lit. The strip is put there by a
// jump (reduced motion is emulated, so it does not glide) and waited on until
// it is at rest, so that the same cards show every run. Without it the
// arrows, which are drawn over the pictures, would be looked at only as the
// first page shows them, with Next alone.
test('the first row at 1440 part way along, with both arrows and the page marks', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
  await expect(page.locator('section.row[data-arrows]').first()).toBeAttached();
  await settle(page);
  const row = page.locator('section.row').first();
  await row.evaluate((el: HTMLElement) => {
    const strip = el.querySelector<HTMLElement>('.strip');
    if (strip === null) throw new Error('the row has no strip');
    strip.scrollTo({ left: strip.clientWidth * 0.6 });
  });
  await expect(row.getByRole('button', { name: /^Previous/ })).toBeVisible();
  await expect(row.getByRole('button', { name: /^Next/ })).toBeVisible();
  await expect(row.locator('.page-mark[data-current]')).toHaveCount(1);
  await page.evaluate(
    () =>
      new Promise<void>((done) =>
        requestAnimationFrame(() => requestAnimationFrame(() => done())),
      ),
  );
  await expect(row).toHaveScreenshot('first-row-part-way-1440.png', {
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
  await expect(page.locator('section.row[data-arrows]').first()).toBeAttached();
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

// The top of the home page on a day that is not the first candidate's: the
// feature the list gives for a day that is place 2 in it, in the window and
// not the whole page (a window the size of the first screen, so that the
// picture is one the reader sees). Every other picture is of day 0, which is
// the first candidate, so without this the other features are never looked at.
test('the top of the home page at 1440 on a day that shows another feature', async ({
  page,
}) => {
  const count = candidatesOf(readRows()).length;
  expect(count).toBeGreaterThan(2);
  const base = 20_000;
  await page.clock.setFixedTime(noonOf(base - (base % count) + 2));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
  await expect(page.locator('section.row[data-arrows]').first()).toBeAttached();
  await settle(page);
  await expect(page.locator('section.feature:not([hidden])')).toHaveAttribute(
    'data-entry',
    candidatesOf(readRows())[2] ?? '',
  );
  await expect(page).toHaveScreenshot('home-top-another-day-1440.png', {
    ...TOLERANCE,
  });
});

// The first row with Chopdrop's card flipped, at a desk's width and a phone's,
// as a reader sees it once they have pressed it: its back on the panel colour,
// with its label, title, description, Play link and Close button, beside the
// fronts of the row's other cards. Reduced motion is emulated (as for every
// picture here), so the faces swap at once and nothing is part way through its
// turn. The strip and the page are put where the card is the same every run by
// jumps, never a glide, and the card is flipped by a real click on its
// picture. The mouse is then taken off the row, so that no card is hovered and
// none of the others is dimmed.
for (const [width, height] of [
  [1440, 1000],
  [390, 844],
] as const) {
  test(`the first row at ${width} with Chopdrop flipped`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto('/');
    await expect(
      page.locator('section.row[data-arrows]').first(),
    ).toBeAttached();
    await settle(page);
    const row = page.locator('section.row').first();
    const chopdrop = row.locator('li.card[data-entry="chopdrop"]');
    await row.evaluate((el: HTMLElement, id) => {
      const strip = el.querySelector<HTMLElement>('.strip');
      const card = el.querySelector<HTMLElement>(`li.card[data-entry="${id}"]`);
      if (strip === null || card === null) throw new Error('no row or card');
      // The card is put at the strip's start, one of its snap points, so that
      // the snap leaves it there.
      strip.scrollTo({
        left: card.offsetLeft - strip.offsetLeft,
        behavior: 'instant',
      });
      window.scrollTo({ top: el.offsetTop - 24, behavior: 'instant' });
    }, 'chopdrop');
    await page.evaluate(
      () =>
        new Promise<void>((done) =>
          requestAnimationFrame(() => requestAnimationFrame(() => done())),
        ),
    );
    const box = await chopdrop.locator('.frame').boundingBox();
    expect(box, 'the picture is drawn').not.toBeNull();
    await page.mouse.click(
      (box?.x ?? 0) + (box?.width ?? 0) / 2,
      (box?.y ?? 0) + (box?.height ?? 0) / 2,
    );
    await expect(chopdrop).toHaveAttribute('data-flipped', '');
    await page.mouse.move(2, 2);
    await page.evaluate(() =>
      Promise.all(
        document.getAnimations().map((each) => each.finished.catch(() => null)),
      ),
    );
    // On a phone the back is a sheet at the foot of the window, not in the
    // row, so the window is pictured, the row and the sheet over the page.
    if (width === 390)
      await expect(page).toHaveScreenshot(
        `first-row-chopdrop-flipped-${width}.png`,
        { ...TOLERANCE },
      );
    else
      await expect(row).toHaveScreenshot(
        `first-row-chopdrop-flipped-${width}.png`,
        { ...TOLERANCE },
      );
  });
}

// The top of the home page at 1440 as a reader with no wish for less motion
// sees it: the moving hero, its loop playing over the still, the day-0
// feature's panel at the lower left and the button at the lower right. The
// other pictures of the home page are taken with reduced motion, which shows
// the still and a button that reads Play; this is the one that shows the loop.
// A playing loop is a different frame every time, so it is held: the video is
// paused by the reader's own control, set to 2.0 seconds and waited for to have
// drawn that frame (`seeked`), and the button therefore reads Play, which is
// what a held hero says. The window is the picture, so the first row's tops
// are in it, drawn once their pictures have arrived.
test('the top of the home page at 1440 with the hero’s loop held at 2.0 seconds', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
  const hero = page.locator('section.feature:not([hidden])');
  const video = hero.locator('video');
  await expect(video).toHaveCount(1);
  await expect
    .poll(() =>
      video.evaluate(
        (el: HTMLVideoElement) => !el.paused && el.currentTime > 0.3,
      ),
    )
    .toBe(true);
  await hero.locator('button[data-hero-button]').click();
  await video.evaluate(async (el: HTMLVideoElement) => {
    const seeked = new Promise((done) =>
      el.addEventListener('seeked', done, { once: true }),
    );
    el.currentTime = 2;
    await seeked;
  });
  expect(
    await video.evaluate((el: HTMLVideoElement) => ({
      paused: el.paused,
      at: el.currentTime,
    })),
  ).toEqual({ paused: true, at: 2 });
  await expect(hero.locator('button[data-hero-button]')).toHaveText('Play');
  await page.evaluate(() => document.fonts.ready);
  // Every picture that is in the window has arrived and is drawn.
  await expect
    .poll(() =>
      page.evaluate(() =>
        [...document.images]
          .filter((image) => {
            const box = image.getBoundingClientRect();
            return box.top < window.innerHeight && box.bottom > 0;
          })
          .every((image) => image.complete && image.naturalWidth > 0),
      ),
    )
    .toBe(true);
  await page.evaluate(() =>
    Promise.all(
      document.getAnimations().map((each) => each.finished.catch(() => null)),
    ),
  );
  await expect(page).toHaveScreenshot('hero-loop-held-1440.png', {
    ...TOLERANCE,
  });
});

// The first row in the middle of the window, as a reader who has settled on it
// sees it, with no wish for less motion: the card in focus plays its loop over
// its picture and carries the Pause button at its picture's lower right. A
// playing loop is a different frame every time, so it is held as the hero's
// is: paused by the reader's own control, set to 2.0 seconds and waited for to
// have drawn that frame (`seeked`), and the button therefore shows its play
// mark, which is what a held card loop shows. The mouse is off the row, so that
// no card is hovered and none of the others is dimmed.
for (const [width, height] of [
  [1440, 1000],
  [390, 844],
] as const) {
  test(`the first row at ${width} with its card in focus playing, held at 2.0 seconds`, async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.setViewportSize({ width, height });
    await page.goto('/');
    await expect(
      page.locator('section.row[data-arrows]').first(),
    ).toBeAttached();
    await settle(page);
    const row = page.locator('section.row').first();
    await row.evaluate((el: HTMLElement) => {
      const frame = el.querySelector('li.card .frame');
      const box = frame?.getBoundingClientRect();
      if (box === undefined) throw new Error('no card');
      window.scrollTo({
        top: scrollY + box.top + box.height / 2 - innerHeight / 2,
        behavior: 'instant',
      });
    });
    await page.mouse.move(2, 2);
    const video = row.locator('video');
    await expect(video).toHaveCount(1);
    await expect
      .poll(() =>
        video.evaluate(
          (el: HTMLVideoElement) => !el.paused && el.currentTime > 0.3,
        ),
      )
      .toBe(true);
    const pause = row.locator('button.card-pause');
    await pause.click();
    await page.mouse.move(2, 2);
    await video.evaluate(async (el: HTMLVideoElement) => {
      const seeked = new Promise((done) =>
        el.addEventListener('seeked', done, { once: true }),
      );
      el.currentTime = 2;
      await seeked;
    });
    expect(
      await video.evaluate((el: HTMLVideoElement) => ({
        paused: el.paused,
        at: el.currentTime,
      })),
    ).toEqual({ paused: true, at: 2 });
    await expect(pause).toHaveAccessibleName('Play the card videos');
    // The click left focus on the button; a mouse press shows no ring, and
    // the picture is of the row as a reader looking at it sees it.
    await page.evaluate(() => (document.activeElement as HTMLElement).blur());
    await page.evaluate(() =>
      Promise.all(
        document.getAnimations().map((each) => each.finished.catch(() => null)),
      ),
    );
    await expect(row).toHaveScreenshot(
      `first-row-card-loop-held-${width}.png`,
      { ...TOLERANCE },
    );
  });
}

// The best cards' shine (part 5 of plans/cards.md), as a reader with no
// preference for less motion sees it: the first row at a desk's width with the
// mouse held over Aquaclysm, its sheen there and the card tilted toward it, and
// the first row at a phone's width (a touch screen) at a fixed scroll, where
// the sheen is set by each card's place in the window. Save-Data is stood in,
// so that no loop plays and the stills are what is pictured, and every ease is
// waited for to end. Without these the foil would be pictured only at rest, in
// the pictures above, which emulate reduced motion.
test.describe('the shine', () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'connection', {
        value: { saveData: true },
        configurable: true,
      });
    });
  });

  test('the first row at 1440 with the mouse held over Aquaclysm', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto('/');
    await expect(
      page.locator('section.row[data-arrows]').first(),
    ).toBeAttached();
    await settle(page);
    const row = page.locator('section.row').first();
    await row.evaluate((el: HTMLElement) => {
      window.scrollTo({ top: el.offsetTop - 24, behavior: 'instant' });
    });
    const card = row.locator('li.card[data-entry="aquaclysm"]');
    const box = await card.boundingBox();
    if (box === null) throw new Error('the card is not drawn');
    await page.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.3, {
      steps: 4,
    });
    await expect
      .poll(() =>
        card.evaluate((el: HTMLElement) =>
          el.style.getPropertyValue('--tilt-y'),
        ),
      )
      .toMatch(/deg$/);
    await page.evaluate(() =>
      Promise.all(
        document.getAnimations().map((each) => each.finished.catch(() => null)),
      ),
    );
    await expect(row).toHaveScreenshot('first-row-shine-mouse-1440.png', {
      ...TOLERANCE,
    });
  });

  test.describe('on a touch screen', () => {
    test.use({ hasTouch: true, isMobile: true });

    test('the first row at 390 at a fixed scroll', async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto('/');
      await expect(
        page.locator('section.row[data-arrows]').first(),
      ).toBeAttached();
      await settle(page);
      const row = page.locator('section.row').first();
      await row.evaluate((el: HTMLElement) => {
        window.scrollTo({ top: el.offsetTop - 200, behavior: 'instant' });
      });
      const card = row.locator('li.card[data-entry="aquaclysm"]');
      await expect
        .poll(() =>
          card.evaluate((el: HTMLElement) =>
            el.style.getPropertyValue('--shine-y'),
          ),
        )
        .not.toBe('');
      await page.evaluate(() =>
        Promise.all(
          document
            .getAnimations()
            .map((each) => each.finished.catch(() => null)),
        ),
      );
      await expect(row).toHaveScreenshot('first-row-shine-scroll-390.png', {
        ...TOLERANCE,
      });
    });
  });
});
