// Holds part 4 of plans/cards.md, "the loop of the card most in focus"
// (criteria 8 and 9): once the reader has scrolled past the hero and settled
// for 600ms, exactly one card's loop plays, the one the rule names; a hovered
// or focused card takes it over after the same wait; no loop is asked for at
// load, while scrolling, or for a flipped card; Pause holds every card loop for
// the visit until Play; reduced motion plays nothing unasked; Save-Data fetches
// nothing; a loop that fails is taken down with its button; a late row's card
// waits for its picture; script off has no video and no button; a touch screen
// plays the nearest card with no hover.
//
// The page's clock is Playwright's, installed before the page opens and held,
// so that requestAnimationFrame, performance.now and Date step together, one
// frame to each 16ms run, and the settle time is stepped and never waited on.
// Media time is the browser's and not the clock's, so a loop's playing is asked
// of the video itself (`paused`, `currentTime`), as hero.spec.ts does. Which
// card should play is worked out here from the page's boxes, by the plan's
// words and not by the page's code: the cards with a loop, a picture arrived,
// a front showing and the whole frame in the window; the pointed one, or the
// nearest the window's centre, the earlier on a tie; none while more than half
// of the hero's frame is in the window. Every added video is seen by an
// observer from before the page's scripts run, and no test may ever see two in
// the rows at once. Each test counts what it reached. A card playing where an
// arrow press left it has its picture and Pause clear of both arrows.
import { expect, type Locator, type Page } from '@playwright/test';
import { DAY_ZERO, test } from '../clock';
import { partsUnderArrows } from './arrows';
import { untilScrolled } from './scrolling';

/** One frame of the stepped clock, in ms: where Playwright's rAF falls. */
const FRAME = 16;

/** The settle time, as the plan says it. */
const SETTLE = 600;

/** What the observer saw of the cards' videos. */
interface Seen {
  /** The most videos in the rows at any one look. */
  most: number;
  /** The entry of each card a video was added to, in order. */
  made: string[];
}

/** A request for a card's loop: a .webm that is not a hero's. */
const isCardLoop = (url: string): boolean =>
  /\.webm(\?|$)/.test(url) && !/\.hero\.[\w-]+\.webm/.test(url);

/** The card loops the page asks for, in order, as paths. */
function watchLoops(page: Page): string[] {
  const asked: string[] = [];
  page.on('request', (request) => {
    if (isCardLoop(request.url())) asked.push(new URL(request.url()).pathname);
  });
  return asked;
}

/** Counts every video added to a row, from before the page's own scripts. */
async function watchVideos(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const seen = { most: 0, made: [] as string[] };
    Reflect.set(window, '__cardVideos', seen);
    new MutationObserver((records) => {
      for (const record of records)
        for (const node of record.addedNodes)
          if (node instanceof HTMLVideoElement && node.closest('section.row'))
            seen.made.push(
              node.closest<HTMLElement>('li.card')?.dataset['entry'] ?? '?',
            );
      seen.most = Math.max(
        seen.most,
        document.querySelectorAll('section.row video').length,
      );
    }).observe(document, { subtree: true, childList: true });
  });
}

function seen(page: Page): Promise<Seen> {
  return page.evaluate(() => Reflect.get(window, '__cardVideos') as Seen);
}

/** Opens the page with the clock installed, then holds it. */
async function open(page: Page): Promise<void> {
  await watchVideos(page);
  await page.clock.install({ time: DAY_ZERO });
  await page.goto('/');
  await expect(page.locator('section.row[data-arrows]').first()).toBeAttached();
  await page.clock.pauseAt(DAY_ZERO + 1000);
}

/** Steps the held clock, a frame at a time, so that every frame is seen. */
async function step(page: Page, ms: number): Promise<void> {
  for (let done = 0; done < ms; done += FRAME) await page.clock.runFor(FRAME);
}

/**
 * Puts a row's pictures in the middle of the window and its strip at its
 * start, by jumps and never a glide, and comes back once the page has heard
 * the scroll: the browser tells it on its own next frame, in real time, and a
 * stepped settle that began before then would be counted from too early.
 */
async function centreRow(page: Page, row: number): Promise<void> {
  await page.evaluate(async (at) => {
    const section = document.querySelectorAll('section.row')[at];
    const strip = section?.querySelector<HTMLElement>('.strip');
    const frame = section?.querySelector('li.card .frame');
    if (strip === undefined || strip === null || !frame)
      throw new Error(`no row ${at}`);
    strip.scrollTo({ left: 0, behavior: 'instant' });
    const box = frame.getBoundingClientRect();
    const from = scrollY;
    const heard = new Promise<void>((done) =>
      document.addEventListener('scroll', () => done(), { once: true }),
    );
    window.scrollTo({
      top: from + box.top + box.height / 2 - innerHeight / 2,
      behavior: 'instant',
    });
    // A jump that moved nothing (the page's foot, or already there) is never
    // told.
    if (scrollY !== from) await heard;
  }, row);
}

/** The card the rule names now, by its place among the page's cards, or -1. */
function named(page: Page, pointed = -1): Promise<number> {
  return page.evaluate((pointedAt) => {
    const width = document.documentElement.clientWidth;
    const height = document.documentElement.clientHeight;
    const hero = document
      .querySelector('section.feature:not([hidden]) .feature-frame')
      ?.getBoundingClientRect();
    if (hero !== undefined && hero.width * hero.height > 0) {
      const across = Math.max(
        0,
        Math.min(hero.right, width) - Math.max(hero.left, 0),
      );
      const down = Math.max(
        0,
        Math.min(hero.bottom, height) - Math.max(hero.top, 0),
      );
      if ((across * down) / (hero.width * hero.height) > 0.5) return -1;
    }
    const cards = [...document.querySelectorAll<HTMLElement>('li.card')];
    const able = cards.flatMap((card, at) => {
      const image = card.querySelector<HTMLImageElement>('.frame img');
      const box = card.querySelector('.frame')?.getBoundingClientRect();
      const ok =
        card.dataset['loop'] !== undefined &&
        image !== null &&
        image.complete &&
        image.naturalWidth > 0 &&
        !card.hasAttribute('data-flipped') &&
        box !== undefined &&
        box.left >= -1 &&
        box.top >= -1 &&
        box.right <= width + 1 &&
        box.bottom <= height + 1;
      if (!ok || box === undefined) return [];
      return [
        {
          at,
          distance: Math.hypot(
            box.left + box.width / 2 - width / 2,
            box.top + box.height / 2 - height / 2,
          ),
        },
      ];
    });
    if (able.some((card) => card.at === pointedAt)) return pointedAt;
    let best = -1;
    let nearest = Infinity;
    for (const card of able)
      if (card.distance < nearest) {
        nearest = card.distance;
        best = card.at;
      }
    return best;
  }, pointed);
}

/** The places among the page's cards of every card holding a video. */
function playingAt(page: Page): Promise<number[]> {
  return page.evaluate(() => {
    const cards = [...document.querySelectorAll('li.card')];
    return [...document.querySelectorAll('section.row video')].map((video) =>
      cards.indexOf(video.closest('li.card') as Element),
    );
  });
}

const cardAt = (page: Page, at: number): Locator =>
  page.locator('li.card').nth(at);
const pauseButton = (page: Page): Locator =>
  page.locator('section.row button.card-pause');
const videoIn = (page: Page): Locator => page.locator('section.row video');

/** Whether a video is playing: not paused, and its media time has moved on. */
function isPlaying(video: Locator): Promise<boolean> {
  return video.evaluate(
    (el: HTMLVideoElement) => !el.paused && el.currentTime > 0.3,
  );
}

/** Every picture of a row has arrived (loaded now). */
async function rowArrived(page: Page, row: number): Promise<void> {
  await expect
    .poll(() =>
      page
        .locator('section.row')
        .nth(row)
        .locator('.frame img')
        .evaluateAll((all: HTMLImageElement[]) =>
          all.every((image) => image.complete && image.naturalWidth > 0),
        ),
    )
    .toBe(true);
}

/** Settles on a row: puts it in the middle, waits for its pictures, steps past the settle time. */
async function settleOn(page: Page, row: number): Promise<number> {
  await centreRow(page, row);
  await rowArrived(page, row);
  // Arrival may come after the scroll: a frame to hear it, then the wait.
  await step(page, FRAME * 2);
  await step(page, SETTLE + FRAME * 4);
  return named(page);
}

/** At most one video was ever in the rows. */
async function oneAtMost(page: Page): Promise<void> {
  expect((await seen(page)).most, 'videos in the rows at once').toBeLessThan(2);
}

test.describe('at a desk’s width', () => {
  test.use({ viewport: { width: 1440, height: 1000 } });
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
  });

  test('at load nothing is asked for but the hero’s loop, however long the clock runs', async ({
    page,
  }) => {
    const asked = watchLoops(page);
    await open(page);
    await step(page, 2000);
    expect(
      await named(page),
      'the rule names no card on the first screen',
    ).toBe(-1);
    expect(asked).toEqual([]);
    expect((await seen(page)).made).toEqual([]);
    await expect(pauseButton(page)).toHaveCount(0);
  });

  test('settled on a row for 600ms, exactly one video plays, in the card the rule names, and not before', async ({
    page,
  }) => {
    const asked = watchLoops(page);
    await open(page);
    await centreRow(page, 0);
    await rowArrived(page, 0);
    const want = await named(page);
    expect(want, 'a card qualifies').toBeGreaterThanOrEqual(0);
    // Short of the settle time nothing is asked for.
    await step(page, SETTLE - FRAME * 3);
    expect(asked, 'asked for before 600ms').toEqual([]);
    await expect(videoIn(page)).toHaveCount(0);
    await step(page, FRAME * 8);
    await expect(videoIn(page)).toHaveCount(1);
    expect(await playingAt(page)).toEqual([want]);
    const video = videoIn(page);
    await expect.poll(() => isPlaying(video)).toBe(true);
    const state = await video.evaluate((el: HTMLVideoElement) => ({
      muted: el.muted,
      loop: el.loop,
      inline: el.playsInline,
      hidden: el.getAttribute('aria-hidden'),
      src: new URL(el.src).pathname,
    }));
    const loop = await cardAt(page, want).getAttribute('data-loop');
    expect(state).toEqual({
      muted: true,
      loop: true,
      inline: true,
      hidden: 'true',
      src: loop,
    });
    expect(asked).toEqual([loop]);
    // It covers its card's picture.
    const frame = await cardAt(page, want).locator('.frame').boundingBox();
    const box = await video.boundingBox();
    expect(box?.x).toBeCloseTo(frame?.x ?? -1, 0);
    expect(box?.width).toBeCloseTo(frame?.width ?? -1, 0);
    expect(box?.height).toBeCloseTo(frame?.height ?? -1, 0);
    // The button is on it, and says what it will do.
    await expect(pauseButton(page)).toHaveCount(1);
    await expect(cardAt(page, want).locator('button.card-pause')).toBeVisible();
    await expect(pauseButton(page)).toHaveAccessibleName(
      'Pause the card videos',
    );
    await oneAtMost(page);
  });

  test('a quick scroll past three rows, under 600ms at each, asks for no loop', async ({
    page,
  }) => {
    const asked = watchLoops(page);
    await open(page);
    let passed = 0;
    for (const row of [0, 1, 2]) {
      await centreRow(page, row);
      await step(page, SETTLE - FRAME * 8);
      passed += 1;
    }
    await page.evaluate(async () => {
      const heard = new Promise<void>((done) =>
        document.addEventListener('scroll', () => done(), { once: true }),
      );
      window.scrollTo({ top: 0, behavior: 'instant' });
      await heard;
    });
    await step(page, SETTLE * 2);
    expect(passed).toBe(3);
    expect(asked).toEqual([]);
    expect((await seen(page)).made).toEqual([]);
  });

  test('a mouse held on another qualifying card takes the loop over after the settle time, and the first video is gone', async ({
    page,
  }) => {
    const asked = watchLoops(page);
    await open(page);
    const first = await settleOn(page, 0);
    await expect(videoIn(page)).toHaveCount(1);
    expect(await playingAt(page)).toEqual([first]);
    // Another card of the row that qualifies.
    const other = first === 0 ? 1 : 0;
    expect(await named(page, other)).toBe(other);
    const box = await cardAt(page, other).locator('.frame').boundingBox();
    await page.mouse.move(
      (box?.x ?? 0) + (box?.width ?? 0) / 2,
      (box?.y ?? 0) + (box?.height ?? 0) / 2,
    );
    // Before the settle time the first still plays.
    await step(page, SETTLE - FRAME * 3);
    expect(await playingAt(page)).toEqual([first]);
    await step(page, FRAME * 8);
    expect(await playingAt(page)).toEqual([other]);
    await expect.poll(() => isPlaying(videoIn(page))).toBe(true);
    await expect(cardAt(page, first).locator('video')).toHaveCount(0);
    await expect(
      cardAt(page, other).locator('button.card-pause'),
    ).toBeVisible();
    expect(asked).toHaveLength(2);
    await oneAtMost(page);
  });

  test('keyboard focus takes it over the same way; Pause is the Tab stop after its card’s flip button', async ({
    page,
  }) => {
    await open(page);
    const first = await settleOn(page, 0);
    expect(await playingAt(page)).toEqual([first]);
    await cardAt(page, first).locator('button.card-flip').focus();
    await page.keyboard.press('Tab');
    expect(
      await page.evaluate(() => document.activeElement?.className),
      'the stop after the flip button',
    ).toBe('card-pause');
    expect(
      await pauseButton(page).evaluate((el) => el.matches(':focus-visible')),
    ).toBe(true);
    await page.keyboard.press('Tab');
    const focused = await page.evaluate(() => {
      const card = document.activeElement?.closest('li.card');
      return {
        at: [...document.querySelectorAll('li.card')].indexOf(card as Element),
        what: document.activeElement?.className,
      };
    });
    expect(focused.what).toBe('card-flip');
    expect(focused.at).toBe(first + 1);
    const want = await named(page, first + 1);
    expect(want, 'the focused card qualifies').toBe(first + 1);
    await step(page, SETTLE - FRAME * 3);
    expect(await playingAt(page)).toEqual([first]);
    await step(page, FRAME * 8);
    expect(await playingAt(page)).toEqual([first + 1]);
    await expect.poll(() => isPlaying(videoIn(page))).toBe(true);
    await oneAtMost(page);
  });

  test('flipping the playing card stops it at once, and no loop is asked for a flipped card', async ({
    page,
  }) => {
    const asked = watchLoops(page);
    await open(page);
    const first = await settleOn(page, 0);
    const card = cardAt(page, first);
    const loop = (await card.getAttribute('data-loop')) ?? '';
    await expect(card.locator('video')).toHaveCount(1);
    const box = await card.locator('.frame').boundingBox();
    await page.mouse.click(
      (box?.x ?? 0) + (box?.width ?? 0) / 3,
      (box?.y ?? 0) + (box?.height ?? 0) / 3,
    );
    await expect(card).toHaveAttribute('data-flipped', '');
    await step(page, FRAME);
    await expect(card.locator('video')).toHaveCount(0);
    await expect(card.locator('button.card-pause')).toHaveCount(0);
    // Held on it, flipped: its loop is never asked for again, nor played.
    await step(page, SETTLE * 2);
    await expect(card.locator('video')).toHaveCount(0);
    expect(asked.filter((path) => path === loop)).toHaveLength(1);
    const entry = await card.getAttribute('data-entry');
    expect(
      (await seen(page)).made.filter((made) => made === entry),
      'videos made for the card',
    ).toHaveLength(1);
    await oneAtMost(page);
  });

  test('a press on Pause does not flip its card', async ({ page }) => {
    await open(page);
    const first = await settleOn(page, 0);
    await pauseButton(page).click();
    await step(page, FRAME * 2);
    await expect(cardAt(page, first)).not.toHaveAttribute('data-flipped');
    const size = await pauseButton(page).boundingBox();
    expect(size?.width).toBeGreaterThanOrEqual(44);
    expect(size?.height).toBeGreaterThanOrEqual(44);
  });

  for (const how of ['a real click', 'a real Enter']) {
    test(`Pause by ${how} holds it and says Play; another row starts nothing and shows the button; Play starts it`, async ({
      page,
    }) => {
      const asked = watchLoops(page);
      await open(page);
      const first = await settleOn(page, 0);
      const video = videoIn(page);
      await expect.poll(() => isPlaying(video)).toBe(true);
      const press = async (): Promise<void> => {
        if (how === 'a real click') await pauseButton(page).click();
        else {
          await pauseButton(page).focus();
          await page.keyboard.press('Enter');
        }
      };
      await press();
      await expect
        .poll(() => video.evaluate((el: HTMLVideoElement) => el.paused))
        .toBe(true);
      await expect(pauseButton(page)).toHaveAccessibleName(
        'Play the card videos',
      );
      expect(await playingAt(page)).toEqual([first]);
      // Another row: nothing starts, and the button there says Play.
      await page.mouse.move(2, 2);
      const next = await settleOn(page, 1);
      expect(next).toBeGreaterThanOrEqual(0);
      await step(page, SETTLE);
      expect(asked, 'no loop asked for while held').toHaveLength(1);
      await expect(videoIn(page)).toHaveCount(0);
      await expect(pauseButton(page)).toHaveCount(1);
      await expect(
        cardAt(page, next).locator('button.card-pause'),
      ).toBeVisible();
      await expect(pauseButton(page)).toHaveAccessibleName(
        'Play the card videos',
      );
      await press();
      await expect(videoIn(page)).toHaveCount(1);
      expect(await playingAt(page)).toEqual([next]);
      await expect.poll(() => isPlaying(videoIn(page))).toBe(true);
      await expect(pauseButton(page)).toHaveAccessibleName(
        'Pause the card videos',
      );
      expect(asked).toHaveLength(2);
      await oneAtMost(page);
    });
  }

  test('arrow keys from Pause move in the grid, and never land on it', async ({
    page,
  }) => {
    await open(page);
    const first = await settleOn(page, 0);
    await pauseButton(page).focus();
    await page.keyboard.press('ArrowRight');
    const after = await page.evaluate(() => ({
      at: [...document.querySelectorAll('li.card')].indexOf(
        document.activeElement?.closest('li.card') as Element,
      ),
      what: document.activeElement?.className,
    }));
    expect(after).toEqual({ at: first + 1, what: 'card-flip' });
    await page.keyboard.press('ArrowLeft');
    expect(await page.evaluate(() => document.activeElement?.className)).toBe(
      'card-flip',
    );
  });

  test('a tab hidden takes the loop down', async ({ page }) => {
    await open(page);
    await settleOn(page, 0);
    await expect(videoIn(page)).toHaveCount(1);
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', {
        value: 'hidden',
        configurable: true,
      });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await step(page, FRAME);
    await expect(videoIn(page)).toHaveCount(0);
    await expect(pauseButton(page)).toHaveCount(0);
  });

  test('a loop made to fail is taken down with its button, and the still stands', async ({
    page,
  }) => {
    const asked = watchLoops(page);
    await page.route(
      (url) => isCardLoop(url.href),
      (route) => route.abort(),
    );
    await open(page);
    const first = await settleOn(page, 0);
    expect(asked.length, 'a loop was asked for').toBeGreaterThan(0);
    await expect.poll(() => playingAt(page)).toEqual([]);
    await step(page, FRAME);
    await expect(cardAt(page, first).locator('button.card-pause')).toHaveCount(
      0,
    );
    await expect(cardAt(page, first).locator('.frame img')).toBeVisible();
    // Each card is tried once and given up on: no loop is asked for twice,
    // however long the reader stays.
    for (let round = 0; round < 8; round += 1) {
      await step(page, SETTLE + FRAME * 4);
      await expect.poll(() => playingAt(page)).toEqual([]);
    }
    expect(new Set(asked).size).toBe(asked.length);
    await oneAtMost(page);
  });

  test('a late row’s card plays only once its picture has arrived', async ({
    page,
  }) => {
    const waiting: (() => void)[] = [];
    let released = false;
    const late = /\.(avif|webp|jpe?g)(\?|$)/;
    await open(page);
    // Held from here: the late row's pictures are asked for once it is near.
    await page.route(late, async (route) => {
      if (!released) await new Promise<void>((done) => waiting.push(done));
      await route.continue().catch(() => undefined);
    });
    await centreRow(page, 2);
    await expect.poll(() => waiting.length).toBeGreaterThan(0);
    await step(page, SETTLE * 2);
    expect(await named(page), 'nothing qualifies while it waits').toBe(-1);
    expect(await playingAt(page)).toEqual([]);
    released = true;
    for (const done of waiting) done();
    await rowArrived(page, 2);
    await step(page, FRAME * 2);
    const want = await named(page);
    expect(want).toBeGreaterThanOrEqual(0);
    await step(page, SETTLE + FRAME * 4);
    expect(await playingAt(page)).toEqual([want]);
  });
});

test.describe('reduced motion, at a desk’s width', () => {
  test.use({ viewport: { width: 1440, height: 1000 } });

  test('no video unasked on any row, a Play button on the card in focus, and a press fetches and plays', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const asked = watchLoops(page);
    await open(page);
    let rows = 0;
    for (const row of [0, 1, 2, 3]) {
      const want = await settleOn(page, row);
      if (want < 0) continue;
      rows += 1;
      await step(page, SETTLE);
      await expect(videoIn(page)).toHaveCount(0);
      await expect(
        cardAt(page, want).locator('button.card-pause'),
      ).toBeVisible();
      await expect(pauseButton(page)).toHaveAccessibleName(
        'Play the card videos',
      );
    }
    expect(rows).toBe(4);
    expect(asked).toEqual([]);
    const want = await settleOn(page, 0);
    await pauseButton(page).click();
    await expect(videoIn(page)).toHaveCount(1);
    expect(await playingAt(page)).toEqual([want]);
    await expect.poll(() => isPlaying(videoIn(page))).toBe(true);
    expect(asked).toHaveLength(1);
    // Moving on asks again: nothing plays by itself on the next card.
    await settleOn(page, 1);
    await step(page, SETTLE);
    await expect(videoIn(page)).toHaveCount(0);
    expect(asked).toHaveLength(1);
  });
});

test.describe('Save-Data, at a desk’s width', () => {
  test.use({ viewport: { width: 1440, height: 1000 } });

  test('no video, no button and no request, on any row', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'connection', {
        value: { saveData: true },
        configurable: true,
      });
    });
    const asked = watchLoops(page);
    await open(page);
    let rows = 0;
    for (const row of [0, 1, 2, 3]) {
      const want = await settleOn(page, row);
      if (want >= 0) rows += 1;
      await step(page, SETTLE);
      await expect(videoIn(page)).toHaveCount(0);
      await expect(pauseButton(page)).toHaveCount(0);
    }
    expect(rows).toBe(4);
    expect(asked).toEqual([]);
  });
});

test.describe('with script off', () => {
  test.use({
    viewport: { width: 1440, height: 1000 },
    javaScriptEnabled: false,
  });

  test('a row in the middle has no video and no button', async ({ page }) => {
    const asked = watchLoops(page);
    await page.goto('/');
    await page.locator('section.row').first().scrollIntoViewIfNeeded();
    await page.mouse.wheel(0, 300);
    await page.waitForLoadState('networkidle');
    await expect(page.locator('li.card')).not.toHaveCount(0);
    await expect(videoIn(page)).toHaveCount(0);
    await expect(page.locator('button.card-pause')).toHaveCount(0);
    expect(asked).toEqual([]);
  });
});

test.describe('a touch screen at a phone’s width', () => {
  test.use({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });

  test('the nearest card plays after the settle time, with no hover', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    const asked = watchLoops(page);
    await open(page);
    await step(page, 1000);
    expect(asked, 'nothing on the first screen').toEqual([]);
    const want = await settleOn(page, 0);
    expect(want).toBeGreaterThanOrEqual(0);
    expect(await playingAt(page)).toEqual([want]);
    await expect.poll(() => isPlaying(videoIn(page))).toBe(true);
    await expect(cardAt(page, want).locator('button.card-pause')).toBeVisible();
    expect(asked).toHaveLength(1);
    await oneAtMost(page);
  });
});

// The card a press of Next leaves at a phone's width is the one wholly in the
// window, and so the one that plays; on a phone the press used to leave it
// with its left 38px under Previous, its loop among them. Row one is pressed
// along with real clicks until the card it rests on has a loop, the settle
// time is stepped, and the playing card's picture and its Pause button are
// measured clear of both arrows.
test.describe('a card playing where an arrow press left it', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('its picture and its Pause button are clear of both arrows', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await open(page);
    await centreRow(page, 0);
    await rowArrived(page, 0);
    const row = page.locator('section.row').first();
    const list = row.getByRole('list');
    const ahead = row.getByRole('button', { name: /^Next/ });
    let presses = 0;
    let want = -1;
    while (want < 0 && (await ahead.count()) > 0) {
      presses += 1;
      expect(presses, 'presses along row one').toBeLessThan(10);
      await untilScrolled(list, () => ahead.click());
      await step(page, SETTLE + FRAME * 6);
      want = await named(page);
    }
    expect(
      want,
      'a card with a loop is left wholly in the window',
    ).toBeGreaterThan(0);
    expect(await playingAt(page)).toEqual([want]);
    await expect(row.getByRole('button', { name: /^Previous/ })).toBeVisible();
    const card = cardAt(page, want);
    const parts = await partsUnderArrows(
      card.locator('.frame, button.card-pause'),
    );
    expect(parts.seen, 'the picture and its Pause button').toBe(2);
    expect(parts.under).toEqual([]);
    await oneAtMost(page);
  });
});
