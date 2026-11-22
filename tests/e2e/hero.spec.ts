// Holds part 3 of plans/motion.md, "the moving hero": the day's feature is a
// band across the whole window under the header, its still filling it and its
// loop playing over the still, with its words on a solid panel at the lower
// left and a Pause button at the lower right (WCAG 2.2.2: a loop that starts
// by itself and runs past five seconds can be paused). It is held on each of
// the days that give a different feature, at a desk's width and a phone's:
//
//   - the band is the window's width and about the token's height, the still
//     is drawn in it, and the panel's words are 7:1 against the panel;
//   - no loop is asked for until the page has loaded (shown by holding the
//     pictures back, so that the load event cannot come, and finding that
//     the loop has not been asked for while the page's script has run), then
//     exactly one is, the day's, and no hidden candidate's;
//   - the video plays, muted, looping, inline, with the still as its poster;
//   - Pause, by a real click and by a real Enter, holds it and changes the
//     button's words and name; again, it plays; the button is the next Tab
//     stop after the Play link and 44 by 44;
//   - reduced motion: nothing plays or is asked for until the button is
//     pressed; Save-Data: no loop and no button; script off: the still and
//     the panel and no button; a loop that fails: the still stays and the
//     button is not left offering a video that is not there;
//   - the Play link still opens one new window at the feature's address;
//   - on a phone the loop and still sit above the panel, which is the whole
//     width, and nothing scrolls sideways.
//
// Media time is the browser's and not the page clock's (Playwright's clock
// holds Date, and Date is all this holds), so a loop's playing is asked of the
// video: its `paused` and its `currentTime`. Nothing waits on a timeout: each
// wait is for a state. Each test counts what it reached, so that finding
// nothing is a failure and not a pass.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, type Locator, type Page } from '@playwright/test';
import { noonOf, test } from '../clock';
import { candidatesOf, readRows } from './catalogue';
import { textPieces } from './text-pieces';

const catalogue = readRows();
const candidates = candidatesOf(catalogue);
const COUNT = candidates.length;

const TOKENS = readFileSync(
  join(import.meta.dirname, '../../src/styles/tokens.css'),
  'utf8',
);

/** The band's height, as a share of the window's, which is a token. */
const HERO_VH = Number(/--height-hero:\s*([\d.]+)vh/.exec(TOKENS)?.[1]);

/** The most the band is tall, in rem, which is a token. */
const HERO_MAX_REM = Number(
  /--height-hero-max:\s*([\d.]+)rem/.exec(TOKENS)?.[1],
);

/** A day number, near 2024, that falls at the given place in the list. */
function dayAt(place: number): number {
  const base = 20_000;
  return base - (base % COUNT) + place;
}

/** A request for a loop, whatever its hashed name. */
const isLoop = (url: string): boolean => /\.webm(\?|$)/.test(url);

const shown = (page: Page): Locator =>
  page.locator('section.feature:not([hidden])');
const pauseButton = (page: Page): Locator =>
  shown(page).locator('button[data-hero-button]');
const loopOf = (page: Page): Locator => shown(page).locator('video');

/** The loops the page asks for, in order, as paths. */
function watchLoops(page: Page): { paths: string[] } {
  const seen = { paths: [] as string[] };
  page.on('request', (request) => {
    if (isLoop(request.url())) seen.paths.push(new URL(request.url()).pathname);
  });
  return seen;
}

/** Everything the console and the page said that is an error. */
function watchTalk(page: Page): string[] {
  const talk: string[] = [];
  page.on('console', (message) => {
    if (['error', 'warning'].includes(message.type()))
      talk.push(
        `${message.type()}: ${message.text()} (${message.location().url})`,
      );
  });
  page.on('pageerror', (error) => talk.push(`uncaught: ${error.message}`));
  return talk;
}

/** Two frames, so that whatever was to be drawn or stopped has been. */
function frames(page: Page): Promise<void> {
  return page.evaluate(
    () =>
      new Promise<void>((done) =>
        requestAnimationFrame(() => requestAnimationFrame(() => done())),
      ),
  );
}

/** Whether a video is playing: not paused, and its media time has moved on. */
function isPlaying(video: Locator): Promise<boolean> {
  return video.evaluate(
    (el: HTMLVideoElement) => !el.paused && el.currentTime > 0.3,
  );
}

async function openOn(page: Page, place: number): Promise<void> {
  await page.clock.setFixedTime(noonOf(dayAt(place)));
  await page.goto('/');
}

/** The day's feature's title, as drawn. */
async function titleOf(page: Page): Promise<string> {
  return (
    (await shown(page).getByRole('heading', { level: 2 }).textContent()) ?? ''
  );
}

test('has what it reads: three days, a token for the height', () => {
  expect(COUNT).toBeGreaterThanOrEqual(3);
  expect(HERO_VH).toBeGreaterThan(0);
  expect(HERO_MAX_REM).toBeGreaterThan(0);
});

for (let place = 0; place < COUNT; place += 1) {
  test.describe(`on the day that is place ${place} in the list (${candidates[place]})`, () => {
    test.describe('at a desk’s width', () => {
      test.use({ viewport: { width: 1440, height: 1000 } });

      test('the hero is the window’s width and the token’s height, its still fills it, and its panel’s words are 7:1', async ({
        page,
      }) => {
        await openOn(page, place);
        const hero = shown(page);
        await expect(hero).toHaveAttribute(
          'data-entry',
          candidates[place] ?? '',
        );
        const still = hero.locator('img');
        await expect
          .poll(() => still.evaluate((el: HTMLImageElement) => el.naturalWidth))
          .toBeGreaterThan(0);
        const window_ = await page.evaluate(() => ({
          width: document.documentElement.clientWidth,
          height: window.innerHeight,
          rem: parseFloat(getComputedStyle(document.documentElement).fontSize),
        }));
        const box = await hero.boundingBox();
        const stillBox = await still.boundingBox();
        expect(box, 'the hero is drawn').not.toBeNull();
        expect(box?.x).toBe(0);
        expect(box?.width).toBeCloseTo(window_.width, 0);
        // The token's share of the window, but not past its own most.
        expect(box?.height).toBeCloseTo(
          Math.min(
            (window_.height * HERO_VH) / 100,
            HERO_MAX_REM * window_.rem,
          ),
          0,
        );
        // The still fills the band: object-fit cover, so its box is the band's.
        expect(stillBox?.x).toBe(0);
        expect(stillBox?.width).toBeCloseTo(box?.width ?? 0, 0);
        expect(stillBox?.height).toBeCloseTo(box?.height ?? 0, 0);

        // The panel is at the lower left, solid, and holds the words.
        const panel = hero.locator('.words');
        const panelBox = await panel.boundingBox();
        expect(panelBox).not.toBeNull();
        expect(panelBox?.x ?? -1).toBeGreaterThan(0);
        expect(panelBox?.x ?? 1e9).toBeLessThan((box?.width ?? 0) / 2);
        expect((panelBox?.y ?? 0) + (panelBox?.height ?? 0)).toBeGreaterThan(
          (box?.y ?? 0) + (box?.height ?? 0) * 0.8,
        );
        expect(
          (panelBox?.y ?? 0) + (panelBox?.height ?? 0),
        ).toBeLessThanOrEqual((box?.y ?? 0) + (box?.height ?? 0));
        expect(
          await panel.evaluate((el) => getComputedStyle(el).backgroundColor),
        ).toBe(
          await page.evaluate(() => {
            const probe = document.createElement('i');
            probe.style.color = getComputedStyle(
              document.documentElement,
            ).getPropertyValue('--color-ground');
            document.body.append(probe);
            const colour = getComputedStyle(probe).color;
            probe.remove();
            return colour;
          }),
        );
        await expect(hero.locator('[data-label]')).toBeVisible();
        await expect(hero.getByRole('heading', { level: 2 })).toBeVisible();
        await expect(hero.locator('a.button')).toBeVisible();

        await page.evaluate(() => document.fonts.ready);
        const pieces = await textPieces(
          page,
          'section.feature:not([hidden]) .words',
        );
        // The label, the title, the description and the Play link's words.
        expect(pieces.length, 'text nodes in the panel').toBeGreaterThanOrEqual(
          4,
        );
        const short = pieces.filter(
          (piece) => piece.ratio < (piece.large ? 4.5 : 7),
        );
        expect(
          short.map((piece) => `${piece.ratio.toFixed(2)}:1 "${piece.text}"`),
        ).toEqual([]);
      });

      test('no loop is asked for before the page has loaded, then exactly the day’s, and never a hidden candidate’s', async ({
        page,
      }) => {
        const seen = watchLoops(page);
        // Every picture is held at a route, so that the load event cannot
        // come: the page's script runs, and the loop must still not be asked
        // for. Then they are let go, and load comes, and so does the loop.
        const waiting: (() => void)[] = [];
        let released = false;
        await page.route(/\.(avif|webp|jpe?g|png)(\?|$)/, async (route) => {
          if (!released) await new Promise<void>((done) => waiting.push(done));
          await route.continue().catch(() => undefined);
        });
        await page.clock.setFixedTime(noonOf(dayAt(place)));
        await page.goto('/', { waitUntil: 'commit' });
        await page.waitForLoadState('domcontentloaded');
        // The page's own script has run once Surprise me is shown.
        await expect(
          page.getByRole('button', { name: 'Surprise me' }),
        ).toBeVisible();
        await frames(page);
        expect(
          await page.evaluate(() => document.readyState),
          'the load event is held back',
        ).not.toBe('complete');
        expect(waiting.length, 'pictures were held').toBeGreaterThan(0);
        expect(seen.paths, 'loops asked for before load').toEqual([]);
        expect(await loopOf(page).count(), 'no video before load').toBe(0);

        released = true;
        for (const done of waiting) done();
        await page.waitForLoadState('load');
        await expect.poll(() => seen.paths.length).toBe(1);
        await page.waitForLoadState('networkidle');

        // The one loop is the day's own, and none of the others is.
        const own = await shown(page).getAttribute('data-hero-loop');
        expect(own, 'the day’s section names its loop').toMatch(/\.webm$/);
        expect(seen.paths).toEqual([own]);
        const others = await page
          .locator('section.feature[hidden]')
          .evaluateAll((all) =>
            all.map((el) => el.getAttribute('data-hero-loop')),
          );
        expect(others.length, 'hidden candidates were read').toBe(COUNT - 1);
        for (const address of others) {
          expect(address, 'a hidden candidate names its loop').toMatch(
            /\.webm$/,
          );
          expect(seen.paths).not.toContain(address);
        }
      });

      test('the video plays, muted and looped and inline, with the still as its poster', async ({
        page,
      }) => {
        await openOn(page, place);
        const video = loopOf(page);
        await expect(video).toHaveCount(1);
        await expect.poll(() => isPlaying(video)).toBe(true);
        const state = await video.evaluate((el: HTMLVideoElement) => ({
          muted: el.muted,
          loop: el.loop,
          inline: el.playsInline,
          poster: el.poster,
        }));
        expect(state.muted).toBe(true);
        expect(state.loop).toBe(true);
        expect(state.inline).toBe(true);
        const still = await shown(page)
          .locator('img')
          .evaluate((el: HTMLImageElement) => el.currentSrc);
        expect(new URL(state.poster).pathname).toBe(new URL(still).pathname);
        // It covers the band, over the still.
        const box = await shown(page).boundingBox();
        const videoBox = await video.boundingBox();
        expect(videoBox?.x).toBe(0);
        expect(videoBox?.width).toBeCloseTo(box?.width ?? 0, 0);
        expect(videoBox?.height).toBeCloseTo(box?.height ?? 0, 0);
      });

      for (const how of [
        'a real click',
        'a real Enter on the focused button',
      ]) {
        test(`Pause by ${how} holds the loop and says Play, and again plays it and says Pause`, async ({
          page,
        }) => {
          const talk = watchTalk(page);
          await openOn(page, place);
          const title = await titleOf(page);
          const button = pauseButton(page);
          const video = loopOf(page);
          await expect(button).toBeVisible();
          await expect(button).toHaveText('Pause');
          await expect(button).toHaveAccessibleName(`Pause the ${title} video`);
          await expect.poll(() => isPlaying(video)).toBe(true);

          const press = async (): Promise<void> => {
            if (how === 'a real click') await button.click();
            else {
              await button.focus();
              await page.keyboard.press('Enter');
            }
          };

          await press();
          await expect(button).toHaveText('Play');
          await expect(button).toHaveAccessibleName(`Play the ${title} video`);
          await expect
            .poll(() => video.evaluate((el: HTMLVideoElement) => el.paused))
            .toBe(true);
          // Held: its media time stands still across frames.
          const held = await video.evaluate(
            (el: HTMLVideoElement) => el.currentTime,
          );
          await frames(page);
          await frames(page);
          expect(
            await video.evaluate((el: HTMLVideoElement) => el.currentTime),
          ).toBe(held);

          await press();
          await expect(button).toHaveText('Pause');
          await expect(button).toHaveAccessibleName(`Pause the ${title} video`);
          await expect
            .poll(() =>
              video.evaluate(
                (el: HTMLVideoElement, from) =>
                  !el.paused && el.currentTime !== from,
                held,
              ),
            )
            .toBe(true);
          expect(talk).toEqual([]);
        });
      }

      test('the button is the next Tab stop after the Play link, at least 44 by 44, at the lower right', async ({
        page,
      }) => {
        await openOn(page, place);
        const button = pauseButton(page);
        await expect(button).toBeVisible();
        const link = shown(page).locator('a.button');
        await link.focus();
        await page.keyboard.press('Tab');
        await expect(button).toBeFocused();
        const box = await button.boundingBox();
        const hero = await shown(page).boundingBox();
        expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);
        expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
        expect((box?.x ?? 0) + (box?.width ?? 0)).toBeGreaterThan(
          (hero?.width ?? 0) * 0.9,
        );
        expect((box?.y ?? 0) + (box?.height ?? 0)).toBeGreaterThan(
          (hero?.y ?? 0) + (hero?.height ?? 0) * 0.8,
        );
        // Its words, drawn on a solid ground, are 7:1 as well.
        const pieces = await textPieces(
          page,
          'section.feature:not([hidden]) button[data-hero-button]',
        );
        expect(pieces.length).toBeGreaterThan(0);
        for (const piece of pieces)
          expect(piece.ratio).toBeGreaterThanOrEqual(7);
      });

      test('with reduced motion nothing plays or is asked for until the button is pressed, which then fetches and plays it', async ({
        page,
      }) => {
        await page.emulateMedia({ reducedMotion: 'reduce' });
        const seen = watchLoops(page);
        await openOn(page, place);
        const title = await titleOf(page);
        const button = pauseButton(page);
        await expect(button).toBeVisible();
        await expect(button).toHaveText('Play');
        await expect(button).toHaveAccessibleName(`Play the ${title} video`);
        await page.waitForLoadState('networkidle');
        await frames(page);
        expect(seen.paths, 'loops asked for').toEqual([]);
        await expect(loopOf(page)).toHaveCount(0);
        // The still is what shows.
        await expect
          .poll(() =>
            shown(page)
              .locator('img')
              .evaluate((el: HTMLImageElement) => el.naturalWidth),
          )
          .toBeGreaterThan(0);

        await button.click();
        await expect(loopOf(page)).toHaveCount(1);
        await expect.poll(() => isPlaying(loopOf(page))).toBe(true);
        await expect(button).toHaveText('Pause');
        expect(seen.paths).toEqual([
          await shown(page).getAttribute('data-hero-loop'),
        ]);
      });

      test('with Save-Data on there is the still and no loop and no button, and with it present and off the loop plays', async ({
        page,
      }) => {
        const seen = watchLoops(page);
        await page.addInitScript(() => {
          Object.defineProperty(navigator, 'connection', {
            value: { saveData: true },
            configurable: true,
          });
        });
        await openOn(page, place);
        expect(
          await page.evaluate(
            () =>
              (navigator as Navigator & { connection?: { saveData?: boolean } })
                .connection?.saveData,
          ),
        ).toBe(true);
        await page.waitForLoadState('networkidle');
        await frames(page);
        // The button is in the markup, and hidden; the video is never made.
        await expect(pauseButton(page)).toHaveCount(1);
        await expect(pauseButton(page)).toBeHidden();
        await expect(loopOf(page)).toHaveCount(0);
        expect(seen.paths, 'loops asked for').toEqual([]);
        await expect
          .poll(() =>
            shown(page)
              .locator('img')
              .evaluate((el: HTMLImageElement) => el.naturalWidth),
          )
          .toBeGreaterThan(0);
      });

      test('with Save-Data present and off, the loop plays (so that the stand-in is not what stops it)', async ({
        page,
      }) => {
        await page.addInitScript(() => {
          Object.defineProperty(navigator, 'connection', {
            value: { saveData: false },
            configurable: true,
          });
        });
        await openOn(page, place);
        await expect.poll(() => isPlaying(loopOf(page))).toBe(true);
        await expect(pauseButton(page)).toBeVisible();
      });

      test('a loop that fails leaves the still, says nothing but the failed request, and leaves no button offering it', async ({
        page,
      }) => {
        const talk = watchTalk(page);
        const seen = watchLoops(page);
        await page.route(/\.webm(\?|$)/, (route) => route.abort());
        await openOn(page, place);
        await page.waitForLoadState('networkidle');
        await expect.poll(() => seen.paths.length).toBe(1);
        // The video is taken down and the button with it.
        await expect(loopOf(page)).toHaveCount(0);
        await expect(pauseButton(page)).toBeHidden();
        // The still, and the panel with its Play link, stand as they were.
        await expect
          .poll(() =>
            shown(page)
              .locator('img')
              .evaluate((el: HTMLImageElement) => el.naturalWidth),
          )
          .toBeGreaterThan(0);
        await expect(shown(page).locator('a.button')).toBeVisible();
        // Only the aborted request itself may have been said.
        const rest = talk.filter(
          (line) =>
            !(/Failed to load resource/.test(line) && /\.webm/.test(line)),
        );
        expect(rest).toEqual([]);
        expect(seen.paths.length, 'asked for once, not again and again').toBe(
          1,
        );
      });

      test('the Play link opens one new window at the feature’s address and leaves this page where it was', async ({
        page,
        context,
      }) => {
        await openOn(page, place);
        const own = new URL(page.url()).origin;
        const asked: string[] = [];
        await context.route(
          (url) => url.origin !== own,
          (route) => {
            asked.push(route.request().url());
            return route.abort();
          },
        );
        const link = shown(page).locator('a.button');
        const href = new URL((await link.getAttribute('href')) ?? '').href;
        const before = page.url();
        const opened = context.waitForEvent('page');
        await link.click();
        const popup = await opened;
        await expect.poll(() => asked).toEqual([href]);
        expect(context.pages().length).toBe(2);
        expect(page.url()).toBe(before);
        await popup.close();
      });
    });

    test.describe('at a phone’s width', () => {
      test.use({ viewport: { width: 390, height: 844 } });

      test('the loop and still are above the panel, which is the whole width, and nothing scrolls sideways', async ({
        page,
      }) => {
        await openOn(page, place);
        const hero = shown(page);
        const video = loopOf(page);
        await expect.poll(() => isPlaying(video)).toBe(true);
        const still = await hero.locator('img').boundingBox();
        const loop = await video.boundingBox();
        const panel = await hero.locator('.words').boundingBox();
        expect(still, 'the still is drawn').not.toBeNull();
        expect(panel, 'the panel is drawn').not.toBeNull();
        // Above, not behind: the picture's bottom is at or above the panel's top.
        expect((still?.y ?? 0) + (still?.height ?? 0)).toBeLessThanOrEqual(
          (panel?.y ?? 0) + 1,
        );
        expect((loop?.y ?? 0) + (loop?.height ?? 0)).toBeLessThanOrEqual(
          (panel?.y ?? 0) + 1,
        );
        expect(still?.width).toBeCloseTo(390, 0);
        expect(loop?.width).toBeCloseTo(390, 0);
        expect(panel?.x).toBe(0);
        expect(panel?.width).toBeCloseTo(390, 0);
        // The button is on the picture, at its lower right.
        const button = await pauseButton(page).boundingBox();
        expect((button?.y ?? 0) + (button?.height ?? 0)).toBeLessThanOrEqual(
          (still?.y ?? 0) + (still?.height ?? 0) + 1,
        );
        expect(button?.width ?? 0).toBeGreaterThanOrEqual(44);
        expect(button?.height ?? 0).toBeGreaterThanOrEqual(44);
        expect(
          await page.evaluate(
            () =>
              (document.scrollingElement?.scrollWidth ?? 0) <=
              window.innerWidth,
          ),
        ).toBe(true);
      });
    });
  });
}

test.describe('with script off', () => {
  test.use({
    javaScriptEnabled: false,
    viewport: { width: 1440, height: 1000 },
  });

  test('the still and the panel are there, and there is no button and no video', async ({
    page,
  }) => {
    await page.goto('/');
    const hero = shown(page);
    await expect(hero).toHaveCount(1);
    await expect(hero).toHaveAttribute('data-entry', candidates[0] ?? '');
    // The placeholder is not drawn with script off, so the one seen is the
    // noscript's own.
    const still = hero.locator('img:visible');
    await expect(still).toHaveCount(1);
    await expect
      .poll(() => still.evaluate((el: HTMLImageElement) => el.naturalWidth))
      .toBeGreaterThan(0);
    const box = await hero.boundingBox();
    expect(box?.width).toBeCloseTo(1440, 0);
    await expect(hero.locator('.words')).toBeVisible();
    await expect(hero.getByRole('heading', { level: 2 })).toBeVisible();
    await expect(hero.locator('a.button')).toBeVisible();
    await expect(hero.getByRole('button')).toHaveCount(0);
    await expect(pauseButton(page)).toBeHidden();
    await expect(loopOf(page)).toHaveCount(0);
  });
});
