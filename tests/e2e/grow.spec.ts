// Holds part 2 of plans/motion.md, "the card grows": a card that has been
// hovered with a mouse, or whose link has keyboard focus, for the 600ms pause
// opens an enlarged copy of itself over its row, one and a half times as wide,
// inside the window, with the card's loop playing in it (or the card's own
// picture, where it has no loop) and its words beneath. The copy is a picture
// of the card and not a second control: hidden from the accessibility tree,
// nothing in it focusable, and a click on it follows the real card's link. It
// closes at once when the pointer leaves, when focus does, on Escape, when its
// strip scrolls and on resize, follows its card when the page scrolls, and
// only one is open at a time. It does not happen, and nothing is fetched, with
// reduced motion, with Save-Data (it grows with the still), on touch, for a
// card that is not a link, or with script off (nojs.spec.ts). Nothing is
// fetched at load, and a card's loop is asked for the first time it opens.
//
// Time is stepped and never waited on: Playwright's clock is installed before
// the page and paused once it is up, so requestAnimationFrame, performance.now
// and Date move only when a test runs the clock. What a test does wait for is
// a state: a video to be playing (media time is the browser's and the clock
// does not step it, so it is asked of the video), a CSS transition to be over
// (asked of the document's animations) or a strip to be at rest. Save-Data is
// stood in for, since headless Chromium has no such setting: the page's
// navigator.connection is made to say so. Touch is stood in for by a context
// with touch. That proves the rule and the reading, not a device. Each test
// counts what it reached.
import { expect, type Locator, type Page } from '@playwright/test';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { DAY_ZERO, test } from '../clock';
import { textPieces } from './text-pieces';

test.use({ viewport: { width: 1440, height: 1000 } });

/** One frame of the stepped clock, in ms: where Playwright's rAF falls. */
const FRAME = 16;

/**
 * The cards' loops the owner approved, counted from the folder they are kept
 * in. A hero loop (`<id>.hero.webm`) is the moving hero's and not a card's: it
 * is asked for once the page has loaded, held by hero.spec.ts, and is no part
 * of what a card fetches.
 */
const LOOP_FILES = readdirSync(
  join(import.meta.dirname, '../../src/content/loops'),
).filter(
  (name) => name.endsWith('.webm') && !name.endsWith('.hero.webm'),
).length;

/** A request for a card's loop, whatever its hashed name: not the hero's. */
const isLoop = (url: string): boolean =>
  /\.webm(\?|$)/.test(url) && !/\.hero\./.test(url);

/** The videos a card's copy made: the hero's own loop is not one of them. */
const VIDEO = 'video:not(.hero-loop)';

const row = (page: Page, at = 0): Locator =>
  page.locator('section.row').nth(at);

/** The first linked card with a loop in the first row, which is on screen. */
const looped = (page: Page): Locator =>
  row(page).locator('li.card[data-linked][data-loop]').first();

/** A linked card with no loop, in a row that is not late. */
const still = (page: Page): Locator =>
  page
    .locator(
      'section.row:not([data-late]) li.card[data-linked]:not([data-loop])',
    )
    .first();

/** A card that is not a link, which is not a control. */
const unlinked = (page: Page): Locator =>
  page.locator('li.card:not([data-linked])').first();

const grown = (page: Page): Locator => page.locator('.grown');

/** The requests the page makes, in order. */
function watch(page: Page): { urls: string[] } {
  const seen = { urls: [] as string[] };
  page.on('request', (request) => seen.urls.push(request.url()));
  return seen;
}

/**
 * The page with the clock installed from the start and then held, and script
 * run (the row buttons have their state).
 */
async function opened(page: Page): Promise<void> {
  await page.clock.install({ time: DAY_ZERO });
  await page.goto('/');
  await expect(page.locator('section.row[data-arrows]').first()).toBeAttached();
  await page.clock.pauseAt(DAY_ZERO + 1000);
}

/** Runs the held clock on by `ms`, a frame at a time, so every frame is seen. */
async function step(page: Page, ms: number): Promise<void> {
  for (let done = 0; done < ms; done += FRAME) await page.clock.runFor(FRAME);
}

/** Past the pause: just under it nothing, then enough for it to be over. */
async function pastPause(page: Page): Promise<void> {
  await step(page, 700);
}

/** Every transition and animation the document is running has finished. */
async function settled(page: Page): Promise<void> {
  await page.evaluate(() =>
    Promise.all(
      // A transition that is cut short (a card the pointer has left) rejects,
      // and is over all the same.
      document.getAnimations().map((each) => each.finished.catch(() => null)),
    ),
  );
}

/** The mouse moved to a card's middle, as a person does, after bringing it into view. */
async function pointAt(page: Page, card: Locator): Promise<void> {
  await card.scrollIntoViewIfNeeded();
  const box = await card.boundingBox();
  expect(box, 'the card is drawn').not.toBeNull();
  await page.mouse.move(
    (box?.x ?? 0) + (box?.width ?? 0) / 2,
    (box?.y ?? 0) + (box?.height ?? 0) / 2,
  );
}

/** The mouse away from every card. */
async function away(page: Page): Promise<void> {
  await page.mouse.move(5, 5);
}

/** Tab, as a user does, until focus is on this card's link. */
async function tabTo(page: Page, id: string): Promise<void> {
  for (let pressed = 0; pressed < 60; pressed += 1) {
    await page.keyboard.press('Tab');
    const here = await page.evaluate(
      () =>
        document.activeElement?.closest<HTMLElement>('li.card')?.dataset[
          'entry'
        ] ?? '',
    );
    if (here === id) return;
  }
  throw new Error(`Tab never reached the link of ${id}`);
}

async function idOf(card: Locator): Promise<string> {
  return (await card.getAttribute('data-entry')) ?? '';
}

/** What is open: how many, and for which card. */
async function open(page: Page): Promise<{ count: number; ids: string[] }> {
  return page.evaluate(() => ({
    count: document.querySelectorAll('.grown').length,
    ids: [...document.querySelectorAll<HTMLElement>('.grown')].map(
      (each) => each.dataset['for'] ?? '',
    ),
  }));
}

/** The grown card is open, for this card, and drawn at its full size. */
async function opens(page: Page, id: string): Promise<void> {
  await expect(grown(page)).toHaveCount(1);
  expect((await open(page)).ids).toEqual([id]);
  await settled(page);
}

/** A token's colour as the browser draws it, by a probe element. */
function tokenColour(page: Page, token: string): Promise<string> {
  return page.evaluate((name) => {
    const probe = document.createElement('div');
    probe.style.color = `var(${name})`;
    document.body.append(probe);
    const colour = getComputedStyle(probe).color;
    probe.remove();
    return colour;
  }, token);
}

/** The video of the open grown card has begun to play: media time is the browser's. */
async function playing(page: Page): Promise<void> {
  await expect
    .poll(() =>
      page.evaluate(() => {
        const video = document.querySelector<HTMLVideoElement>('.grown video');
        return video !== null && !video.paused && video.currentTime > 0.2;
      }),
    )
    .toBe(true);
}

/** A route on the whole context: stops every request that leaves the site. */
async function stopOutside(page: Page): Promise<string[]> {
  const own = new URL(page.url() || 'http://localhost:4390').origin;
  const asked: string[] = [];
  await page.context().route(
    (url) => url.origin !== own,
    (route) => {
      asked.push(route.request().url());
      return route.abort();
    },
  );
  return asked;
}

test.describe('the markup', () => {
  test('nothing is fetched at load: no loop is asked for, and the page holds no video', async ({
    page,
  }) => {
    const seen = watch(page);
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    // Twelve cards carry a loop's address, which is only an attribute.
    const addresses = await page
      .locator('li.card[data-loop]')
      .evaluateAll((cards) =>
        cards.map((card) => (card as HTMLElement).dataset['loop'] ?? ''),
      );
    expect(addresses.length).toBe(LOOP_FILES);
    expect(LOOP_FILES).toBeGreaterThan(0);
    for (const address of addresses)
      expect(address, 'a built address').toMatch(/^\/_astro\/.+\.webm$/);
    expect(seen.urls.filter(isLoop), 'loops asked for at load').toEqual([]);
    await expect(page.locator(VIDEO)).toHaveCount(0);
    await expect(grown(page)).toHaveCount(0);
  });

  test('a card has one picture in the accessibility tree before it grows, and no grown card is in the document', async ({
    page,
  }) => {
    await page.goto('/');
    // The rows that are not late: a late card's picture has its words only
    // once its row is near, and is held by late.spec.ts.
    const cards = page.locator('section.row:not([data-late]) li.card');
    const total = await cards.count();
    expect(total).toBeGreaterThan(10);
    for (let at = 0; at < total; at += 1)
      await expect(cards.nth(at).getByRole('img')).toHaveCount(1);
  });
});

test.describe('a mouse on a card with a loop', () => {
  test('nothing in the pause, then the grown card opens over its card, wider by one and a half, inside the window, playing its loop, fetched once', async ({
    page,
  }) => {
    const seen = watch(page);
    const noise: string[] = [];
    page.on('console', (message) => {
      if (['error', 'warning'].includes(message.type()))
        noise.push(message.text());
    });
    page.on('pageerror', (error) => noise.push(error.message));
    await opened(page);
    // The second card, which has room for the grown one on both sides.
    const card = row(page).locator('li.card[data-linked][data-loop]').nth(1);
    const id = await idOf(card);
    const address = (await card.getAttribute('data-loop')) ?? '';
    expect(address).toMatch(/\.webm$/);
    await pointAt(page, card);
    // Just under the pause: nothing, and nothing asked for.
    await step(page, 560);
    await expect(grown(page)).toHaveCount(0);
    expect(seen.urls.filter(isLoop)).toEqual([]);
    // Past it: the grown card, for this card.
    await step(page, 100);
    await opens(page, id);
    const box = await card.boundingBox();
    const big = await grown(page).boundingBox();
    expect(box && big, 'both are drawn').toBeTruthy();
    if (box === null || big === null) return;
    // One and a half times as wide, to a pixel, centred, a little above, and
    // inside the window.
    expect(Math.abs(big.width - box.width * 1.5)).toBeLessThanOrEqual(1);
    expect(
      Math.abs(big.x + big.width / 2 - (box.x + box.width / 2)),
    ).toBeLessThanOrEqual(1);
    expect(big.y).toBeLessThan(box.y);
    expect(big.x).toBeGreaterThanOrEqual(0);
    expect(big.y).toBeGreaterThanOrEqual(0);
    expect(big.x + big.width).toBeLessThanOrEqual(1440);
    expect(big.y + big.height).toBeLessThanOrEqual(1000);
    // It covers the card's picture.
    expect(big.y + big.height).toBeGreaterThan(box.y + box.height / 2);
    // The video is the card's loop, muted, looping, inline, and it plays.
    const video = grown(page).locator('video');
    await expect(video).toHaveCount(1);
    expect(await video.getAttribute('src')).toBe(address);
    expect(
      await video.evaluate((el: HTMLVideoElement) => ({
        muted: el.muted,
        loop: el.loop,
        inline: el.playsInline,
        controls: el.controls,
      })),
    ).toEqual({ muted: true, loop: true, inline: true, controls: false });
    await playing(page);
    // The words are the card's own, from the card.
    const words = await grown(page).evaluate((el) => ({
      label: el.querySelector('.label')?.textContent?.trim(),
      title: el.querySelector('h3')?.textContent?.trim(),
      description: el.querySelector('.description')?.textContent?.trim(),
      play: el.querySelector('.grown-play')?.textContent?.trim(),
    }));
    const mine = await card.evaluate((el) => ({
      label: el.querySelector('.label')?.textContent?.trim(),
      title: el.querySelector('h3')?.textContent?.trim(),
      description: el.querySelector('.description')?.textContent?.trim(),
    }));
    expect(words).toMatchObject(mine);
    expect(words.play).toBe(`Play ${mine.title}`);
    // The loop was asked for, and only the card's own.
    const asked = seen.urls.filter(isLoop);
    expect(asked.length).toBeGreaterThan(0);
    expect(new Set(asked.map((url) => new URL(url).pathname))).toEqual(
      new Set([address]),
    );
    expect(asked.length, 'requests for the loop').toBe(1);
    expect(noise, 'console while it grew').toEqual([]);
  });

  test('with room above, its top is a little above its card’s top', async ({
    page,
  }) => {
    await opened(page);
    const card = row(page).locator('li.card[data-linked][data-loop]').nth(1);
    await card.scrollIntoViewIfNeeded();
    // The row is brought up the window, so that there is room for the copy.
    await page.evaluate(() => {
      const top = document
        .querySelector('section.row')
        ?.getBoundingClientRect().top;
      window.scrollBy({ top: (top ?? 0) - 150, behavior: 'instant' });
    });
    await pointAt(page, card);
    await pastPause(page);
    await opens(page, await idOf(card));
    const box = await card.boundingBox();
    const big = await grown(page).boundingBox();
    if (box === null || big === null) throw new Error('not drawn');
    expect(box.y - big.y).toBeGreaterThan(0);
    expect(box.y - big.y).toBeLessThan(100);
  });

  test('the first card of the row, at the window’s edge, grows inside it and still covers its card', async ({
    page,
  }) => {
    await opened(page);
    const card = looped(page);
    await pointAt(page, card);
    await pastPause(page);
    await opens(page, await idOf(card));
    const box = await card.boundingBox();
    const big = await grown(page).boundingBox();
    if (box === null || big === null) throw new Error('not drawn');
    expect(big.x).toBeGreaterThanOrEqual(16);
    expect(Math.abs(big.width - box.width * 1.5)).toBeLessThanOrEqual(1);
    expect(big.x).toBeLessThanOrEqual(box.x);
    expect(big.x + big.width).toBeGreaterThanOrEqual(box.x + box.width);
  });

  test('the loop is the card’s own: another card’s grown copy plays another file', async ({
    page,
  }) => {
    await opened(page);
    const addresses: string[] = [];
    const cards = row(page).locator('li.card[data-linked][data-loop]');
    const total = Math.min(await cards.count(), 3);
    expect(total).toBeGreaterThanOrEqual(2);
    for (let at = 0; at < total; at += 1) {
      const card = cards.nth(at);
      await away(page);
      await pointAt(page, card);
      await pastPause(page);
      await opens(page, await idOf(card));
      addresses.push(
        (await grown(page).locator('video').getAttribute('src')) ?? '',
      );
    }
    expect(new Set(addresses).size).toBe(total);
  });

  test('leaving the card closes it at once, before another frame', async ({
    page,
  }) => {
    await opened(page);
    const card = looped(page);
    await pointAt(page, card);
    await pastPause(page);
    await opens(page, await idOf(card));
    await away(page);
    expect((await open(page)).count).toBe(0);
    // And the video is gone with it: nothing keeps playing out of sight.
    await expect(page.locator(VIDEO)).toHaveCount(0);
  });

  test('a pointer that is let go before the pause ends starts nothing, and fetches nothing', async ({
    page,
  }) => {
    const seen = watch(page);
    await opened(page);
    const card = looped(page);
    await pointAt(page, card);
    await step(page, 300);
    await away(page);
    await step(page, 2000);
    expect((await open(page)).count).toBe(0);
    expect(seen.urls.filter(isLoop)).toEqual([]);
  });

  test('moving on to the grown card keeps it open, and leaving that closes it', async ({
    page,
  }) => {
    await opened(page);
    const card = looped(page);
    await pointAt(page, card);
    await pastPause(page);
    await opens(page, await idOf(card));
    // Onto the part of it that is below the card's own words, and about.
    const big = await grown(page).boundingBox();
    if (big === null) throw new Error('the grown card is not drawn');
    await page.mouse.move(big.x + big.width / 2, big.y + big.height - 20);
    await page.mouse.move(big.x + 30, big.y + 30);
    await step(page, 1000);
    expect((await open(page)).count).toBe(1);
    await page.mouse.move(big.x + big.width + 40, big.y + 30);
    expect((await open(page)).count).toBe(0);
  });

  test('opening it again fetches nothing more than the browser’s own cache is asked', async ({
    page,
  }) => {
    const seen = watch(page);
    await opened(page);
    const card = looped(page);
    for (let round = 0; round < 2; round += 1) {
      await away(page);
      await pointAt(page, card);
      await pastPause(page);
      await opens(page, await idOf(card));
      await playing(page);
    }
    const asked = seen.urls.filter(isLoop);
    // The first open asked for it; the second may be answered by the cache,
    // and is not a different file in any case.
    expect(asked.length).toBeGreaterThan(0);
    expect(new Set(asked).size).toBe(1);
  });
});

test.describe('a mouse on a card with no loop', () => {
  test('it grows with its own picture, no video, and fetches no loop', async ({
    page,
  }) => {
    const seen = watch(page);
    await opened(page);
    const card = still(page);
    await expect(card).toHaveCount(1);
    const id = await idOf(card);
    await pointAt(page, card);
    await pastPause(page);
    await opens(page, id);
    await expect(grown(page).locator('video')).toHaveCount(0);
    const picture = grown(page).locator('img');
    await expect(picture).toHaveCount(1);
    // It is the card's own file, so nothing new was asked for.
    const mine = await card
      .locator('img')
      .first()
      .evaluate((el: HTMLImageElement) => el.currentSrc);
    expect(mine).not.toBe('');
    expect(await picture.evaluate((el: HTMLImageElement) => el.src)).toBe(mine);
    await expect
      .poll(() =>
        picture.evaluate(
          (el: HTMLImageElement) => el.complete && el.naturalWidth > 0,
        ),
      )
      .toBe(true);
    expect(seen.urls.filter(isLoop)).toEqual([]);
  });

  test('a card that is not a link does not grow', async ({ page }) => {
    await opened(page);
    const card = unlinked(page);
    await expect(card).toHaveCount(1);
    await pointAt(page, card);
    await step(page, 3000);
    expect((await open(page)).count).toBe(0);
  });
});

test.describe('the keyboard', () => {
  test('focus on the link opens it after the pause, with the ring on it, and Tab away closes it', async ({
    page,
  }) => {
    const seen = watch(page);
    await opened(page);
    const card = looped(page);
    const id = await idOf(card);
    await tabTo(page, id);
    await step(page, 560);
    await expect(grown(page)).toHaveCount(0);
    expect(seen.urls.filter(isLoop)).toEqual([]);
    await step(page, 100);
    await opens(page, id);
    await playing(page);
    expect(seen.urls.filter(isLoop).length).toBe(1);
    // The ring is on the grown card, in the accent, solid.
    const ring = await grown(page).evaluate((el) => {
      const style = getComputedStyle(el);
      return {
        style: style.outlineStyle,
        width: parseFloat(style.outlineWidth),
        colour: style.outlineColor,
      };
    });
    expect(ring.style).toBe('solid');
    expect(ring.width).toBeGreaterThanOrEqual(3);
    expect(ring.colour).toBe(await tokenColour(page, '--color-accent'));
    // Tab away: the next stop is the next card's link, not anything in the
    // grown card, and the grown card is gone before another frame.
    await page.keyboard.press('Tab');
    expect((await open(page)).count).toBe(0);
    const next = await page.evaluate(
      () =>
        document.activeElement?.closest<HTMLElement>('li.card')?.dataset[
          'entry'
        ] ?? '',
    );
    expect(next).not.toBe('');
    expect(next).not.toBe(id);
  });

  test('a grown card opened by a mouse has no ring', async ({ page }) => {
    await opened(page);
    const card = looped(page);
    await pointAt(page, card);
    await pastPause(page);
    await opens(page, await idOf(card));
    expect(
      await grown(page).evaluate((el) => getComputedStyle(el).outlineStyle),
    ).toBe('none');
  });

  test('Escape closes it, with the mouse on the card and with the focus on its link, and it does not come back', async ({
    page,
  }) => {
    await opened(page);
    const card = looped(page);
    const id = await idOf(card);
    await pointAt(page, card);
    await pastPause(page);
    await opens(page, id);
    await page.keyboard.press('Escape');
    expect((await open(page)).count).toBe(0);
    await step(page, 2000);
    expect((await open(page)).count, 'it came back').toBe(0);
    await away(page);
    await tabTo(page, id);
    await pastPause(page);
    await opens(page, id);
    await page.keyboard.press('Escape');
    expect((await open(page)).count).toBe(0);
    await step(page, 2000);
    expect((await open(page)).count, 'it came back').toBe(0);
    // Focus is where it was, so Escape took nothing else.
    expect(
      await page.evaluate(
        () => document.activeElement?.matches('a.card-link') ?? false,
      ),
    ).toBe(true);
  });

  test('arrow keys land on a card that then grows, and the one they left closes', async ({
    page,
  }) => {
    await opened(page);
    const first = looped(page);
    const firstId = await idOf(first);
    await tabTo(page, firstId);
    await pastPause(page);
    await opens(page, firstId);
    await page.keyboard.press('ArrowRight');
    // The one left is gone at once; the new one is not there before its pause.
    expect((await open(page)).count).toBe(0);
    const landed = await page.evaluate(
      () =>
        document.activeElement?.closest<HTMLElement>('li.card')?.dataset[
          'entry'
        ] ?? '',
    );
    expect(landed).not.toBe('');
    expect(landed).not.toBe(firstId);
    await pastPause(page);
    await opens(page, landed);
    expect((await open(page)).count).toBe(1);
  });

  test('Surprise me lands on a card that then grows', async ({ page }) => {
    await page.addInitScript('window.ooerflixSeed = 7;');
    await page.clock.install({ time: DAY_ZERO });
    await page.goto('/');
    await expect(
      page.getByRole('button', { name: 'Surprise me' }),
    ).toBeVisible();
    await page.clock.pauseAt(DAY_ZERO + 1000);
    await page.getByRole('button', { name: 'Surprise me' }).click();
    const landed = await page.evaluate(
      () =>
        document.activeElement?.closest<HTMLElement>('li.card')?.dataset[
          'entry'
        ] ?? '',
    );
    expect(landed, 'a card has focus').not.toBe('');
    // The glide that brings a card into view is real time: wait for it.
    await expect
      .poll(async () => {
        await step(page, 100);
        return (await open(page)).ids;
      })
      .toEqual([landed]);
  });
});

test.describe('only one, and what closes it', () => {
  test('one at a time: a focus-opened card closes when the mouse opens another', async ({
    page,
  }) => {
    await opened(page);
    const cards = row(page).locator('li.card[data-linked]');
    const a = cards.nth(0);
    const b = cards.nth(2);
    await tabTo(page, await idOf(a));
    await pastPause(page);
    await opens(page, await idOf(a));
    await pointAt(page, b);
    for (let frames = 0; frames < 50; frames += 1) {
      await page.clock.runFor(FRAME);
      expect((await open(page)).count, 'open at once').toBeLessThanOrEqual(1);
    }
    await opens(page, await idOf(b));
  });

  test('one at a time: moving from a card to its neighbour never leaves two', async ({
    page,
  }) => {
    await opened(page);
    const cards = row(page).locator('li.card[data-linked]');
    const a = cards.nth(0);
    const b = cards.nth(1);
    await pointAt(page, a);
    await pastPause(page);
    await opens(page, await idOf(a));
    await pointAt(page, b);
    expect((await open(page)).count, 'right after the move').toBe(0);
    await pastPause(page);
    await opens(page, await idOf(b));
  });

  test('scrolling its strip by the row button closes it at once', async ({
    page,
  }) => {
    await opened(page);
    const card = looped(page);
    const id = await idOf(card);
    await tabTo(page, id);
    await pastPause(page);
    await opens(page, id);
    // The button is pressed by script so that neither the mouse nor focus
    // moves: what closes it is the strip's scroll and nothing else.
    await page.evaluate(() =>
      document
        .querySelector<HTMLButtonElement>('section.row [data-page="next"]')
        ?.click(),
    );
    await expect(grown(page)).toHaveCount(0);
    expect(
      await page.evaluate(
        () => document.activeElement?.matches('a.card-link') ?? false,
      ),
      'focus is still on the link',
    ).toBe(true);
  });

  test('a row’s edge arrow is above its cards and below a grown card', async ({
    page,
  }) => {
    await opened(page);
    // The fourth card is the one the Next arrow is drawn over, so that its
    // copy, which is kept inside the window, is the one that lands on the
    // arrow's place. It is pointed at where it shows, left of the arrow.
    const card = row(page).locator('li.card[data-linked]').nth(3);
    const arrow = row(page).getByRole('button', { name: /^Next/ });
    await expect(arrow).toBeVisible();
    await arrow.scrollIntoViewIfNeeded();
    const at = await card.boundingBox();
    expect(at, 'the card is drawn').not.toBeNull();
    const over = await arrow.boundingBox();
    expect(over, 'the arrow is drawn').not.toBeNull();
    // Without a copy, the arrow is what is on top of the card under it.
    const under = {
      x: (over?.x ?? 0) + (over?.width ?? 0) / 2,
      y: (over?.y ?? 0) + (over?.height ?? 0) / 2,
    };
    expect(
      await page.evaluate(
        ({ x, y }) =>
          document
            .elementFromPoint(x, y)
            ?.closest('button[data-page]')
            ?.getAttribute('data-page'),
        under,
      ),
      'the arrow is above the card’s own picture',
    ).toBe('next');
    await page.mouse.move((at?.x ?? 0) + 40, (at?.y ?? 0) + 40);
    await pastPause(page);
    await opens(page, await idOf(card));
    // The copy covers the arrow's place, so that is what is on top there.
    const copy = await grown(page).boundingBox();
    expect((copy?.x ?? 0) + (copy?.width ?? 0)).toBeGreaterThan(under.x);
    expect(
      await page.evaluate(
        ({ x, y }) =>
          document.elementFromPoint(x, y)?.closest('.grown') !== null,
        under,
      ),
      'a grown card is above the arrow',
    ).toBe(true);
  });

  test('the pointer leaving a grown card onto an arrow closes it, as leaving onto anything else does', async ({
    page,
  }) => {
    await opened(page);
    // The third card's copy ends short of the arrow, so that the arrow is
    // there to be moved onto.
    const card = row(page).locator('li.card[data-linked]').nth(2);
    await pointAt(page, card);
    await pastPause(page);
    await opens(page, await idOf(card));
    const copy = await grown(page).boundingBox();
    const arrow = await row(page)
      .getByRole('button', { name: /^Next/ })
      .boundingBox();
    expect((copy?.x ?? 0) + (copy?.width ?? 0)).toBeLessThan(arrow?.x ?? 0);
    await page.mouse.move(
      (arrow?.x ?? 0) + (arrow?.width ?? 0) / 2,
      (arrow?.y ?? 0) + (arrow?.height ?? 0) / 2,
      { steps: 8 },
    );
    await expect(grown(page)).toHaveCount(0);
  });

  test('a small scroll of its strip closes it, and the card, still focused and in view, opens again after the pause', async ({
    page,
  }) => {
    await opened(page);
    const card = looped(page);
    const id = await idOf(card);
    await tabTo(page, id);
    await pastPause(page);
    await opens(page, id);
    const strip = row(page).locator('.strip');
    await strip.evaluate((el) => {
      el.scrollBy({ left: 30, behavior: 'instant' });
    });
    await expect(grown(page)).toHaveCount(0);
    await pastPause(page);
    await opens(page, id);
  });

  test('a resize closes it', async ({ page }) => {
    await opened(page);
    const card = looped(page);
    await pointAt(page, card);
    await pastPause(page);
    await opens(page, await idOf(card));
    await page.setViewportSize({ width: 1300, height: 1000 });
    await expect(grown(page)).toHaveCount(0);
  });

  test('a page scroll takes it along with its card, which it stays over', async ({
    page,
  }) => {
    await opened(page);
    const card = looped(page);
    await pointAt(page, card);
    await pastPause(page);
    await opens(page, await idOf(card));
    const offset = async () => {
      const box = await card.boundingBox();
      const big = await grown(page).boundingBox();
      if (box === null || big === null) throw new Error('not drawn');
      return { x: big.x - box.x, y: big.y - box.y, top: box.y };
    };
    const before = await offset();
    await page.evaluate(() =>
      window.scrollBy({ top: 120, behavior: 'instant' }),
    );
    await step(page, 100);
    const after = await offset();
    expect(after.top, 'the page moved').toBeLessThan(before.top);
    expect(Math.abs(after.x - before.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(after.y - before.y)).toBeLessThanOrEqual(1);
    expect((await open(page)).count).toBe(1);
  });
});

test.describe('a picture of the card, not a second control', () => {
  test('it is hidden from the tree, holds nothing that takes focus, and is not a stop of its own', async ({
    page,
  }) => {
    await opened(page);
    const card = looped(page);
    const id = await idOf(card);
    await tabTo(page, id);
    await pastPause(page);
    await opens(page, id);
    const found = await grown(page).evaluate((el) => {
      const before = document.activeElement;
      el.focus();
      const tookFocus = document.activeElement === el;
      (before as HTMLElement | null)?.focus();
      return {
        hidden: el.getAttribute('aria-hidden'),
        focusable: el.querySelectorAll(
          'a[href], button, input, select, textarea, summary, [tabindex], [contenteditable], video[controls], audio[controls], iframe',
        ).length,
        tabindex: el.getAttribute('tabindex'),
        tookFocus,
        // Each thing inside is tried: none may take focus when it is asked to.
        inside: [...el.querySelectorAll<HTMLElement | SVGElement>('*')].filter(
          (each) => {
            each.focus();
            return document.activeElement === each;
          },
        ).length,
      };
    });
    expect(found.hidden).toBe('true');
    expect(found.focusable, 'focusable things inside').toBe(0);
    expect(found.inside, 'things inside that took focus').toBe(0);
    expect(found.tabindex).toBeNull();
    expect(found.tookFocus, 'it took focus').toBe(false);
    // Tab leaves the card for the next link, and never lands in the copy.
    await page.keyboard.press('Tab');
    expect(
      await page.evaluate(
        () => document.activeElement?.closest('.grown') !== null,
      ),
    ).toBe(false);
  });

  test('the accessibility tree is the same before and after a card grows, and a card has one picture', async ({
    page,
  }) => {
    await opened(page);
    const card = looped(page);
    const id = await idOf(card);
    const body = page.locator('body');
    const before = await body.ariaSnapshot();
    const pictures = await page.getByRole('img').count();
    expect(await card.getByRole('img').count(), 'before').toBe(1);
    await pointAt(page, card);
    await pastPause(page);
    await opens(page, id);
    await playing(page);
    expect(await card.getByRole('img').count(), 'while grown').toBe(1);
    expect(await page.getByRole('img').count(), 'pictures in the page').toBe(
      pictures,
    );
    expect(await body.ariaSnapshot()).toBe(before);
    await away(page);
    expect(await body.ariaSnapshot()).toBe(before);
  });

  test('a real click anywhere on it follows the real card’s link: one new window at its address, and this page stays', async ({
    page,
    context,
  }) => {
    await opened(page);
    const asked = await stopOutside(page);
    const card = looped(page);
    const id = await idOf(card);
    const href = new URL(
      (await card.locator('a.card-link').getAttribute('href')) ?? '',
    ).href;
    const before = page.url();
    await pointAt(page, card);
    await pastPause(page);
    await opens(page, id);
    const big = await grown(page).boundingBox();
    if (big === null) throw new Error('the grown card is not drawn');
    // On its words, below the picture, and not on any part of the real card.
    const opened_ = context.waitForEvent('page');
    await page.mouse.click(big.x + 24, big.y + big.height - 12);
    const popup = await opened_;
    await expect.poll(() => asked).toEqual([href]);
    expect(context.pages().length).toBe(2);
    expect(page.url()).toBe(before);
    expect(await popup.evaluate(() => window.opener === null)).toBe(true);
    await popup.close();
  });

  test('a click on its picture follows it too', async ({ page, context }) => {
    await opened(page);
    const asked = await stopOutside(page);
    const card = looped(page);
    const href = new URL(
      (await card.locator('a.card-link').getAttribute('href')) ?? '',
    ).href;
    await pointAt(page, card);
    await pastPause(page);
    await opens(page, await idOf(card));
    const big = await grown(page).boundingBox();
    if (big === null) throw new Error('the grown card is not drawn');
    const opened_ = context.waitForEvent('page');
    await page.mouse.click(big.x + big.width / 2, big.y + 80);
    const popup = await opened_;
    await expect.poll(() => asked).toEqual([href]);
    await popup.close();
  });
});

test.describe('house lights, and the words as drawn', () => {
  test('the other cards of the row stay dim while one is grown, and the grown card is not dimmed', async ({
    page,
  }) => {
    await opened(page);
    const card = looped(page);
    const id = await idOf(card);
    await pointAt(page, card);
    await pastPause(page);
    await opens(page, id);
    const filters = async () =>
      row(page)
        .locator('li.card')
        .evaluateAll((all) =>
          all.map((each) => ({
            id: (each as HTMLElement).dataset['entry'] ?? '',
            filter: getComputedStyle(
              each.querySelector('.frame img, picture.frame img') as Element,
            ).filter,
          })),
        );
    const check = async (when: string) => {
      const found = await filters();
      expect(found.length, 'cards in the row').toBeGreaterThan(3);
      for (const each of found) {
        if (each.id === id) expect(each.filter, `${when}: ${id}`).toBe('none');
        else expect(each.filter, `${when}: ${each.id}`).not.toBe('none');
      }
      const mine = await grown(page).evaluate((el) =>
        [...el.querySelectorAll('img, video')].map(
          (each) => getComputedStyle(each).filter,
        ),
      );
      expect(mine.length).toBeGreaterThan(0);
      expect(mine.every((filter) => filter === 'none')).toBe(true);
    };
    await check('grown');
    // With the pointer on the grown card the real card is no longer the one
    // hovered, and the lights must not come up.
    const big = await grown(page).boundingBox();
    if (big === null) throw new Error('the grown card is not drawn');
    await page.mouse.move(big.x + 40, big.y + big.height - 40);
    await settled(page);
    await check('pointer on the grown card');
  });

  test('every word of the grown card is 7:1 or better as drawn (4.5:1 if large)', async ({
    page,
  }) => {
    await opened(page);
    const card = looped(page);
    await pointAt(page, card);
    await pastPause(page);
    await opens(page, await idOf(card));
    await page.evaluate(() => document.fonts.ready);
    const pieces = await textPieces(page, '.grown');
    expect(pieces.length, 'text nodes measured').toBeGreaterThanOrEqual(4);
    const short = pieces.filter(
      (piece) => piece.ratio < (piece.large ? 4.5 : 7),
    );
    expect(
      short.map(
        (piece) =>
          `${piece.ratio.toFixed(2)}:1 "${piece.text}" ${piece.colour} on ${piece.background}`,
      ),
    ).toEqual([]);
    // And the rest of the page, with a card grown, is as it was.
    const all = await textPieces(page);
    expect(
      all.filter((piece) => piece.ratio < (piece.large ? 4.5 : 7)),
    ).toEqual([]);
  });
});

test.describe('where it does nothing, and fetches nothing', () => {
  /** Hover and focus a looped card for a long time: nothing opens and no loop is asked for. */
  async function nothing(page: Page, seen: { urls: string[] }): Promise<void> {
    const card = looped(page);
    const id = await idOf(card);
    await pointAt(page, card);
    await step(page, 5000);
    expect((await open(page)).count, 'opened on hover').toBe(0);
    await away(page);
    await tabTo(page, id);
    await step(page, 5000);
    expect((await open(page)).count, 'opened on focus').toBe(0);
    expect(seen.urls.filter(isLoop), 'loops asked for').toEqual([]);
    await expect(page.locator(VIDEO)).toHaveCount(0);
  }

  test('with reduced motion nothing grows, nothing plays and nothing is fetched', async ({
    page,
  }) => {
    const seen = watch(page);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await opened(page);
    await nothing(page, seen);
  });

  test('with Save-Data on it grows with the still and fetches no loop', async ({
    page,
  }) => {
    const seen = watch(page);
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'connection', {
        value: { saveData: true },
        configurable: true,
      });
    });
    await opened(page);
    expect(
      await page.evaluate(
        () =>
          (navigator as Navigator & { connection?: { saveData?: boolean } })
            .connection?.saveData,
      ),
    ).toBe(true);
    const card = looped(page);
    const id = await idOf(card);
    await pointAt(page, card);
    await pastPause(page);
    await opens(page, id);
    await expect(grown(page).locator('video')).toHaveCount(0);
    await expect(grown(page).locator('img')).toHaveCount(1);
    await step(page, 3000);
    expect(seen.urls.filter(isLoop), 'loops asked for').toEqual([]);
    await expect(page.locator(VIDEO)).toHaveCount(0);
  });

  test('with Save-Data present and off, it plays the loop (so that the stand-in above is not what stops it)', async ({
    page,
  }) => {
    const seen = watch(page);
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'connection', {
        value: { saveData: false },
        configurable: true,
      });
    });
    await opened(page);
    const card = looped(page);
    await pointAt(page, card);
    await pastPause(page);
    await opens(page, await idOf(card));
    await playing(page);
    expect(seen.urls.filter(isLoop).length).toBe(1);
  });

  test('a touch pointerenter on a mouse-and-hover desk is not a hover', async ({
    page,
  }) => {
    const seen = watch(page);
    await opened(page);
    const card = looped(page);
    await card.dispatchEvent('pointerenter', {
      pointerType: 'touch',
      isPrimary: true,
    });
    await step(page, 3000);
    expect((await open(page)).count).toBe(0);
    expect(seen.urls.filter(isLoop)).toEqual([]);
    // The same event of type mouse does start it, so that the above is the
    // type and not the way the event was made.
    await card.dispatchEvent('pointerenter', {
      pointerType: 'mouse',
      isPrimary: true,
    });
    await pastPause(page);
    await opens(page, await idOf(card));
  });
});

test.describe('on a touch screen', () => {
  test.use({ hasTouch: true });

  test('a tap opens the game and nothing grows or is fetched', async ({
    page,
    context,
  }) => {
    const seen = watch(page);
    await opened(page);
    expect(
      await page.evaluate(() => matchMedia('(hover: none)').matches),
      'this context is a touch one',
    ).toBe(true);
    const asked = await stopOutside(page);
    const card = looped(page);
    const href = new URL(
      (await card.locator('a.card-link').getAttribute('href')) ?? '',
    ).href;
    const opened_ = context.waitForEvent('page');
    await card.tap();
    const popup = await opened_;
    await expect.poll(() => asked).toEqual([href]);
    await popup.close();
    await step(page, 5000);
    expect((await open(page)).count).toBe(0);
    expect(seen.urls.filter(isLoop)).toEqual([]);
    // Even an event of type mouse is not a hover where there is none.
    await card.dispatchEvent('pointerenter', {
      pointerType: 'mouse',
      isPrimary: true,
    });
    await step(page, 5000);
    expect((await open(page)).count).toBe(0);
    expect(seen.urls.filter(isLoop)).toEqual([]);
    await expect(page.locator(VIDEO)).toHaveCount(0);
  });
});
