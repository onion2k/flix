// Holds moving about the page by arrow keys and by a gamepad. With focus on a
// card's link or the feature's link, with real key presses: Right and Left go
// to the next and previous linked card and stop at a row's ends; Home and End
// go to the ends; Down and Up go to the nearest linked card of the next row
// that has one, from the feature to the first row and back, passing over the
// row that has no link; a move puts real focus on the link, ringed and in the
// window, brings a late row's pictures in, and stops the key's own scrolling.
// Where it must not apply, it does not: a strip itself still scrolls, a nav
// link is left alone, and a held modifier leaves the key to the browser. The
// gamepad is stood in for, since there is no controller in a test: a
// navigator.getGamepads that returns what the test sets, with the standard
// mapping, 17 buttons and four axes, and the page's clock held by Playwright's
// clock, which steps requestAnimationFrame, performance.now and Date together,
// one frame to each 16ms run. Nothing waits on a time: the test says how far
// the clock moves and reads where focus is. That proves the reading and the
// timing, and not a device. Each test counts what it reached.
import { expect, type Page } from '@playwright/test';
import { test } from '../clock';
import { readRows } from './catalogue';

const catalogue = readRows();

test.use({ viewport: { width: 1440, height: 1000 } });

/** One frame of the stepped clock, in ms: where Playwright's rAF falls. */
const FRAME = 16;

/** Where focus is, as the page's own parts name it. */
interface Where {
  kind: 'feature' | 'card' | 'strip' | 'other';
  /** The row's index among the rows, for a card or a strip. */
  row: number;
  entry: string;
  tag: string;
}

async function ready(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.locator('[aria-disabled]').first()).toBeAttached();
}

function where(page: Page): Promise<Where> {
  return page.evaluate((): Where => {
    const el = document.activeElement;
    const rows = [...document.querySelectorAll('section.row')];
    const none = { row: -1, entry: '', tag: el?.tagName.toLowerCase() ?? '' };
    if (el === null) return { kind: 'other', ...none };
    const feature = el.closest<HTMLElement>('section.feature');
    if (feature !== null && el.matches('a.button'))
      return {
        kind: 'feature',
        row: -1,
        entry: feature.dataset['entry'] ?? '',
        tag: 'a',
      };
    const card = el.closest<HTMLElement>('li.card');
    if (card !== null && el.matches('a.card-link'))
      return {
        kind: 'card',
        row: rows.indexOf(card.closest('section.row') as Element),
        entry: card.dataset['entry'] ?? '',
        tag: 'a',
      };
    if (el.matches('ul.strip'))
      return {
        kind: 'strip',
        row: rows.indexOf(el.closest('section.row') as Element),
        entry: '',
        tag: 'ul',
      };
    return { kind: 'other', ...none };
  });
}

/** Every row's cards, and which of them are linked, from the page. */
async function rowsOnPage(
  page: Page,
): Promise<{ all: string[]; linked: string[] }[]> {
  return page.evaluate(() =>
    [...document.querySelectorAll('section.row')].map((section) => ({
      all: [...section.querySelectorAll<HTMLElement>('li.card')].map(
        (li) => li.dataset['entry'] ?? '',
      ),
      linked: [
        ...section.querySelectorAll<HTMLElement>('li.card[data-linked]'),
      ].map((li) => li.dataset['entry'] ?? ''),
    })),
  );
}

/** Tab, as a user does, until focus is on a card's link. */
async function tabToCard(page: Page): Promise<void> {
  for (let pressed = 0; pressed < 60; pressed += 1) {
    await page.keyboard.press('Tab');
    if ((await where(page)).kind === 'card') return;
  }
  throw new Error('Tab never reached a card link');
}

/**
 * Nothing on the page is still scrolling: two reads, one poll apart, gave the
 * same positions. It does not use the page's frames, since a test with the
 * clock held would never get one.
 */
async function still(page: Page): Promise<void> {
  let was = '';
  await expect
    .poll(async () => {
      const now = await page.evaluate(() =>
        JSON.stringify([
          scrollX,
          scrollY,
          ...[...document.querySelectorAll('ul.strip')].map(
            (strip) => strip.scrollLeft,
          ),
        ]),
      );
      const same = now === was;
      was = now;
      return same;
    })
    .toBe(true);
}

/** The ring that is seen: the first outline, on the link or its card, of 2px. */
function ringed(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const el = document.activeElement;
    if (el === null) return false;
    return [el, el.closest('li'), el.closest('section.feature')]
      .filter((each): each is Element => each !== null)
      .map((each) => getComputedStyle(each))
      .some(
        (each) =>
          each.outlineStyle !== 'none' &&
          parseFloat(each.outlineWidth) >= 2 &&
          each.outlineColor !== 'rgba(0, 0, 0, 0)',
      );
  });
}

function insideWindow(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const el = document.activeElement;
    if (el === null) return false;
    const box = (el.closest('li') ?? el).getBoundingClientRect();
    return (
      box.left >= -1 &&
      box.top >= -1 &&
      box.right <= innerWidth + 1 &&
      box.bottom <= innerHeight + 1
    );
  });
}

/** Focus is on `entry` in that row, seen: ringed and wholly in the window. */
async function landed(page: Page, row: number, entry: string): Promise<void> {
  await expect
    .poll(async () => {
      const now = await where(page);
      return `${now.kind} ${now.row} ${now.entry}`;
    })
    .toBe(`card ${row} ${entry}`);
  await expect.poll(() => insideWindow(page)).toBe(true);
  expect(await ringed(page)).toBe(true);
}

/** Starts recording whether each arrow key's default was prevented. */
async function recordKeys(page: Page): Promise<void> {
  await page.evaluate(() => {
    const seen: boolean[] = [];
    Reflect.set(window, '__keys', seen);
    // Bubble phase on window: after the page's own listeners have run.
    window.addEventListener('keydown', (event) => {
      // A held modifier is a keydown of its own, which is not the question.
      if (/^(Arrow|Home$|End$)/.test(event.key))
        seen.push(event.defaultPrevented);
    });
  });
}

function keysPrevented(page: Page): Promise<boolean[]> {
  return page.evaluate(() => Reflect.get(window, '__keys') as boolean[]);
}

test.describe('keys', () => {
  test('the catalogue has a row of linked cards, and one row with none', async ({
    page,
  }) => {
    await ready(page);
    const rows = await rowsOnPage(page);
    expect(rows.map((row) => row.all)).toEqual(
      catalogue.rows.map((row) => row.entries),
    );
    expect(rows[0]?.linked.length).toBeGreaterThan(3);
    expect(rows.some((row) => row.linked.length === 0)).toBe(true);
    expect(rows.filter((row) => row.linked.length > 0).length).toBeGreaterThan(
      2,
    );
  });

  test('Right walks the first row card by card, stops at its end, and Left walks back', async ({
    page,
  }) => {
    await ready(page);
    const first = (await rowsOnPage(page))[0];
    if (first === undefined) throw new Error('no rows');
    await tabToCard(page);
    await landed(page, 0, first.linked[0] ?? '');
    await recordKeys(page);
    let reached = 1;
    for (const entry of first.linked.slice(1)) {
      await page.keyboard.press('ArrowRight');
      await landed(page, 0, entry);
      reached += 1;
    }
    expect(reached).toBe(first.linked.length);
    // At the end nothing moves, and the key is still the grid's.
    await still(page);
    await page.keyboard.press('ArrowRight');
    await still(page);
    await landed(page, 0, first.linked.at(-1) ?? '');
    const presses = await keysPrevented(page);
    expect(presses.length).toBe(first.linked.length);
    expect(presses.every(Boolean)).toBe(true);
    for (const entry of first.linked.slice(0, -1).reverse()) {
      await page.keyboard.press('ArrowLeft');
      await landed(page, 0, entry);
    }
    await still(page);
    await page.keyboard.press('ArrowLeft');
    await still(page);
    await landed(page, 0, first.linked[0] ?? '');
  });

  test('Home and End go to the ends of the row', async ({ page }) => {
    await ready(page);
    const first = (await rowsOnPage(page))[0];
    if (first === undefined) throw new Error('no rows');
    await tabToCard(page);
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('End');
    await landed(page, 0, first.linked.at(-1) ?? '');
    await page.keyboard.press('Home');
    await landed(page, 0, first.linked[0] ?? '');
    await page.keyboard.press('End');
    await landed(page, 0, first.linked.at(-1) ?? '');
  });

  test('a Right press does not also scroll the strip by the key’s own amount, nor the window sideways', async ({
    page,
  }) => {
    await ready(page);
    await tabToCard(page);
    await still(page);
    const strip = page.locator('section.row').first().locator('ul.strip');
    expect(await strip.evaluate((el) => el.scrollLeft)).toBe(0);
    // The second card is wholly in the window at a desk's width, so bringing
    // it into view moves nothing, and any scroll is the key's own.
    await page.keyboard.press('ArrowRight');
    await still(page);
    expect(await strip.evaluate((el) => el.scrollLeft)).toBe(0);
    expect(await page.evaluate(() => scrollX)).toBe(0);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });

  test('Down and Up go to the nearest linked card of the next row that has one, through every row and back to the feature', async ({
    page,
  }) => {
    await ready(page);
    const rows = await rowsOnPage(page);
    const withLinks = rows
      .map((row, at) => ({ at, linked: row.linked }))
      .filter((row) => row.linked.length > 0);
    await tabToCard(page);
    // From the row's far end, so that the nearest is not the first card.
    await page.keyboard.press('End');
    await still(page);

    /** The linked card of `row` nearest sideways to the focused one, from the page. */
    const nearest = (row: number) =>
      page.evaluate((target) => {
        const centre = (el: Element) => {
          const box = el.getBoundingClientRect();
          return box.left + box.width / 2;
        };
        const from = document.activeElement;
        if (from === null) return '';
        const here = centre(from.closest('li') ?? from);
        const cards = [
          ...(document
            .querySelectorAll('section.row')
            [target]?.querySelectorAll<HTMLElement>('li.card[data-linked]') ??
            []),
        ];
        let best = '';
        let gap = Infinity;
        for (const card of cards) {
          const away = Math.abs(centre(card) - here);
          if (away < gap) {
            gap = away;
            best = card.dataset['entry'] ?? '';
          }
        }
        return best;
      }, row);

    let nearestNotFirst = 0;
    let reached = 0;
    for (const row of withLinks.slice(1)) {
      await still(page);
      const expected = await nearest(row.at);
      expect(expected).not.toBe('');
      if (expected !== row.linked[0]) nearestNotFirst += 1;
      await page.keyboard.press('ArrowDown');
      await landed(page, row.at, expected);
      reached += 1;
    }
    expect(reached).toBe(withLinks.length - 1);
    // The nearest and the first differed somewhere, or this proved nothing.
    expect(nearestNotFirst).toBeGreaterThan(0);

    // Down from the last row with a link moves nothing: the unlinked row below
    // it is never landed on.
    await recordKeys(page);
    const last = withLinks.at(-1);
    const stood = await where(page);
    await still(page);
    await page.keyboard.press('ArrowDown');
    await still(page);
    expect(await where(page)).toEqual(stood);
    expect(stood.row).toBe(last?.at);
    expect(await keysPrevented(page)).toEqual([true]);

    // And back up, each time to the nearest, to the feature's link.
    for (const row of withLinks.slice(0, -1).reverse()) {
      await still(page);
      const expected = await nearest(row.at);
      await page.keyboard.press('ArrowUp');
      await landed(page, row.at, expected);
    }
    await page.keyboard.press('ArrowUp');
    await expect.poll(async () => (await where(page)).kind).toBe('feature');
    expect((await where(page)).entry).toBe(catalogue.feature);
    expect(await ringed(page)).toBe(true);

    // Up from the feature moves nothing, and Left and Right nothing either.
    await still(page);
    for (const key of ['ArrowUp', 'ArrowLeft', 'ArrowRight', 'Home', 'End']) {
      await page.keyboard.press(key);
      await still(page);
      expect((await where(page)).kind).toBe('feature');
    }
    // Down from the feature goes to the first row's nearest card.
    const firstRow = withLinks[0];
    const expected = await nearest(firstRow?.at ?? 0);
    await page.keyboard.press('ArrowDown');
    await landed(page, firstRow?.at ?? 0, expected);
  });

  test('moving into a late row loads its pictures', async ({ page }) => {
    await ready(page);
    const rows = await rowsOnPage(page);
    const late = rows.findIndex((row, at) => at >= 2 && row.linked.length > 0);
    expect(late).toBeGreaterThan(1);
    const pictures = page.locator('section.row').nth(late).locator('li.card');
    const total = await pictures.count();
    const drawn = () =>
      page
        .locator('section.row')
        .nth(late)
        .locator('li.card img')
        .evaluateAll(
          (imgs) =>
            imgs.filter((img) => (img as HTMLImageElement).naturalWidth > 0)
              .length,
        );
    expect(await drawn()).toBe(0);
    await tabToCard(page);
    let pressed = 0;
    while ((await where(page)).row < late && pressed < 10) {
      await still(page);
      await page.keyboard.press('ArrowDown');
      pressed += 1;
      await expect.poll(async () => (await where(page)).row).toBe(pressed);
    }
    expect((await where(page)).row).toBe(late);
    await expect.poll(drawn).toBe(total);
  });

  test('a strip with focus still scrolls with Right, and focus stays on it', async ({
    page,
  }) => {
    await ready(page);
    const strip = page.locator('section.row').first().locator('ul.strip');
    await strip.focus();
    await recordKeys(page);
    await page.keyboard.press('ArrowRight');
    await expect
      .poll(() => strip.evaluate((el) => el.scrollLeft))
      .toBeGreaterThan(0);
    expect((await where(page)).kind).toBe('strip');
    expect(await keysPrevented(page)).toEqual([false]);
  });

  test('a nav link, a row button and the page are left to the browser', async ({
    page,
  }) => {
    await ready(page);
    const nav = page.getByRole('navigation').getByRole('link').first();
    await nav.focus();
    await recordKeys(page);
    for (const key of ['ArrowRight', 'ArrowDown', 'Home']) {
      await page.keyboard.press(key);
    }
    await expect(nav).toBeFocused();
    const button = page
      .locator('section.row')
      .first()
      .getByRole('button', { name: /^Next/ });
    await button.focus();
    await page.keyboard.press('ArrowRight');
    await expect(button).toBeFocused();
    // Home with no focus in the grid is the browser's to take, so the keys
    // were all left alone.
    expect((await keysPrevented(page)).every((each) => !each)).toBe(true);
    expect((await keysPrevented(page)).length).toBe(4);
  });

  for (const modifier of ['Shift', 'Alt', 'Control', 'Meta']) {
    test(`with ${modifier} held on a card, focus does not move and the key is not taken`, async ({
      page,
    }) => {
      await ready(page);
      await tabToCard(page);
      await still(page);
      const stood = await where(page);
      await recordKeys(page);
      await page.keyboard.press(`${modifier}+ArrowRight`);
      await still(page);
      expect(await where(page)).toEqual(stood);
      expect(await keysPrevented(page)).toEqual([false]);
    });
  }

  test('Tab is as it was: the feature, then the first row’s strip, then its first card', async ({
    page,
  }) => {
    await ready(page);
    const seen: string[] = [];
    for (let pressed = 0; pressed < 60; pressed += 1) {
      await page.keyboard.press('Tab');
      const now = await where(page);
      seen.push(now.kind);
      if (now.kind === 'card') break;
    }
    const strip = seen.indexOf('strip');
    expect(seen.indexOf('feature')).toBeGreaterThanOrEqual(0);
    expect(strip).toBeGreaterThan(seen.indexOf('feature'));
    expect(seen.at(-1)).toBe('card');
    expect(seen.length - 1).toBeGreaterThan(strip);
  });
});

/** The stand-in for a gamepad, and what a test can set on it. */
interface Pad {
  present: boolean;
  buttons: boolean[];
  axes: number[];
  /** How many times the page has asked navigator.getGamepads. */
  calls: number;
}

async function standInPad(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const pad = {
      present: false,
      buttons: Array.from({ length: 17 }, () => false),
      axes: [0, 0, 0, 0],
      calls: 0,
    };
    Reflect.set(window, '__pad', pad);
    Reflect.set(navigator, 'getGamepads', () => {
      pad.calls += 1;
      if (!pad.present) return [null, null, null, null];
      return [
        {
          id: 'Stand-in standard pad',
          index: 0,
          connected: true,
          mapping: 'standard',
          timestamp: 0,
          axes: [...pad.axes],
          buttons: pad.buttons.map((pressed) => ({
            pressed,
            touched: pressed,
            value: pressed ? 1 : 0,
          })),
        },
        null,
        null,
        null,
      ];
    });
  });
}

/** Sets what the stand-in holds, as the pad would after the user's hands. */
function hold(
  page: Page,
  held: { buttons?: number[]; axes?: number[] },
): Promise<void> {
  return page.evaluate((now) => {
    const pad = Reflect.get(window, '__pad') as Pad;
    pad.buttons = pad.buttons.map(
      (_, at) => now.buttons?.includes(at) ?? false,
    );
    pad.axes = now.axes ?? [0, 0, 0, 0];
  }, held);
}

function calls(page: Page): Promise<number> {
  return page.evaluate(() => (Reflect.get(window, '__pad') as Pad).calls);
}

/** The clock is held from the start, and the pad is plugged in. */
async function connected(page: Page): Promise<void> {
  await standInPad(page);
  await page.clock.install({ time: 0 });
  await ready(page);
  // Held: from here nothing moves until the test steps it.
  await page.clock.pauseAt(1000);
  await page.evaluate(() => {
    (Reflect.get(window, '__pad') as Pad).present = true;
    window.dispatchEvent(new Event('gamepadconnected'));
  });
}

/** Steps the held clock, a frame at a time, so that every frame is seen. */
async function step(page: Page, ms: number): Promise<void> {
  for (let done = 0; done < ms; done += FRAME) await page.clock.runFor(FRAME);
}

/** The place of the focused card among its row's linked cards. */
async function place(page: Page): Promise<number> {
  const here = await where(page);
  const rows = await rowsOnPage(page);
  return rows[here.row]?.linked.indexOf(here.entry) ?? -1;
}

test.describe('a gamepad', () => {
  test('with none connected nothing is read, however long the clock runs', async ({
    page,
  }) => {
    await standInPad(page);
    await page.clock.install({ time: 0 });
    await ready(page);
    await page.clock.pauseAt(1000);
    await step(page, 1000);
    expect(await calls(page)).toBe(0);
  });

  test('right on the d-pad held moves once at once, again after 400ms, then every 150ms', async ({
    page,
  }) => {
    await connected(page);
    await tabToCardByKeys(page);
    const start = await place(page);
    await hold(page, { buttons: [15] });
    await step(page, FRAME);
    expect(await place(page)).toBe(start + 1);
    // 384ms on from that move: not yet 400.
    await step(page, 384 - FRAME);
    expect(await place(page)).toBe(start + 1);
    // Past 400ms, within a frame of it: the second move.
    await step(page, 2 * FRAME);
    expect(await place(page)).toBe(start + 2);
    // Then not before 150ms (100ms on is under it, whatever frame it fell on).
    await step(page, 96);
    expect(await place(page)).toBe(start + 2);
    // And again in the 150ms: by 64 more it is past it, and only once.
    await step(page, 64);
    expect(await place(page)).toBe(start + 3);
    await step(page, 160);
    expect(await place(page)).toBe(start + 4);
    // Let go: nothing more.
    await hold(page, {});
    await step(page, 600);
    expect(await place(page)).toBe(start + 4);
  });

  test('the left stick past the dead zone does the same, and under it does nothing', async ({
    page,
  }) => {
    await connected(page);
    await tabToCardByKeys(page);
    const start = await place(page);
    const before = await calls(page);
    await hold(page, { axes: [0.45, 0, 0, 0] });
    await step(page, 1000);
    expect(await place(page)).toBe(start);
    // It was read all that while, and held nothing.
    expect(await calls(page)).toBeGreaterThan(before + 20);

    await hold(page, { axes: [0.9, 0, 0, 0] });
    await step(page, FRAME);
    expect(await place(page)).toBe(start + 1);
    await step(page, 384 - FRAME);
    expect(await place(page)).toBe(start + 1);
    await step(page, 2 * FRAME);
    expect(await place(page)).toBe(start + 2);
    await step(page, 160);
    expect(await place(page)).toBe(start + 3);
    // Left, by the stick, goes back, at once.
    await hold(page, { axes: [-0.9, 0, 0, 0] });
    await step(page, FRAME);
    expect(await place(page)).toBe(start + 2);
  });

  test('the stronger axis wins, and the d-pad beats the stick', async ({
    page,
  }) => {
    await connected(page);
    await tabToCardByKeys(page);
    // Down is stronger than right, so down: to the next row.
    await hold(page, { axes: [0.6, 0.9, 0, 0] });
    await step(page, FRAME);
    expect((await where(page)).row).toBe(1);
    await hold(page, {});
    await step(page, FRAME);
    // The d-pad's up beats the stick's right.
    await hold(page, { buttons: [12], axes: [0.9, 0, 0, 0] });
    await step(page, FRAME);
    expect((await where(page)).row).toBe(0);
  });

  test('with focus outside the grid the first direction focuses the feature’s link, and the next goes on from it', async ({
    page,
  }) => {
    await connected(page);
    expect((await where(page)).kind).toBe('other');
    await hold(page, { buttons: [13] });
    await step(page, FRAME);
    await expect(
      page.locator('section.feature:not([hidden]) a.button'),
    ).toBeFocused();
    await hold(page, {});
    await step(page, FRAME);
    await hold(page, { buttons: [13] });
    await step(page, FRAME);
    expect((await where(page)).kind).toBe('card');
    expect((await where(page)).row).toBe(0);
  });

  test('the first button follows the focused link, once a press and not again while held', async ({
    page,
  }) => {
    // Clicks are counted and stopped, so that the page stays to be read; the
    // next test sees the request itself.
    await connected(page);
    await page.evaluate(() => {
      const clicks: string[] = [];
      Reflect.set(window, '__clicks', clicks);
      document.addEventListener(
        'click',
        (event) => {
          const link = (event.target as Element).closest('a');
          if (link !== null) clicks.push(link.href);
          event.preventDefault();
        },
        true,
      );
    });
    const clicked = () =>
      page.evaluate(() => Reflect.get(window, '__clicks') as string[]);
    // Outside the grid nothing is focused, so the button does nothing.
    await hold(page, { buttons: [0] });
    await step(page, FRAME);
    expect(await clicked()).toEqual([]);
    await hold(page, {});
    await step(page, FRAME);

    await tabToCardByKeys(page);
    const href = await page.evaluate(
      () => (document.activeElement as HTMLAnchorElement).href,
    );
    await hold(page, { buttons: [0] });
    await step(page, FRAME);
    expect(await clicked()).toEqual([href]);
    // Held for a long time: still once.
    await step(page, 1000);
    expect(await clicked()).toEqual([href]);
    // Let go and press again: a second press.
    await hold(page, {});
    await step(page, FRAME);
    await hold(page, { buttons: [0] });
    await step(page, FRAME);
    expect(await clicked()).toEqual([href, href]);
  });

  test('the first button asks for the card’s address, and the page asks for it once', async ({
    page,
  }) => {
    await connected(page);
    await tabToCardByKeys(page);
    const href = await page.evaluate(
      () => (document.activeElement as HTMLAnchorElement).href,
    );
    const asked: string[] = [];
    await page.route(href, (route) => {
      asked.push(route.request().url());
      return route.abort();
    });
    await hold(page, { buttons: [0] });
    await step(page, FRAME);
    await expect.poll(() => asked.length).toBe(1);
    expect(asked[0]).toBe(href);
  });

  test('after the pad is disconnected no frame reads it, and a new one is read again', async ({
    page,
  }) => {
    await connected(page);
    await tabToCardByKeys(page);
    await hold(page, { buttons: [15] });
    await step(page, FRAME);
    expect(await calls(page)).toBeGreaterThan(0);
    await page.evaluate(() => {
      (Reflect.get(window, '__pad') as Pad).present = false;
      window.dispatchEvent(new Event('gamepaddisconnected'));
    });
    const at = await calls(page);
    const stood = await place(page);
    await step(page, 1000);
    expect(await calls(page)).toBe(at);
    expect(await place(page)).toBe(stood);

    // Plugged in again, it is read again.
    await page.evaluate(() => {
      (Reflect.get(window, '__pad') as Pad).present = true;
      window.dispatchEvent(new Event('gamepadconnected'));
    });
    await hold(page, { buttons: [15] });
    await step(page, FRAME);
    expect(await calls(page)).toBeGreaterThan(at);
    expect(await place(page)).toBe(stood + 1);
  });

  test('two connected events run one loop, so one move a frame at most', async ({
    page,
  }) => {
    await connected(page);
    await page.evaluate(() => {
      window.dispatchEvent(new Event('gamepadconnected'));
    });
    await tabToCardByKeys(page);
    const start = await place(page);
    const before = await calls(page);
    await hold(page, { buttons: [15] });
    await step(page, FRAME);
    expect(await place(page)).toBe(start + 1);
    // One read a frame: ten frames, ten calls, with only the one loop.
    await step(page, 9 * FRAME);
    expect(await calls(page)).toBe(before + 10);
  });
});

/** Focus the first card by real Tab, then let the page settle. */
async function tabToCardByKeys(page: Page): Promise<void> {
  await tabToCard(page);
  await still(page);
}
