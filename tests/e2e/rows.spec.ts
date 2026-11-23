// Holds how a row is moved along once script has run: no scrollbar under it,
// an arrow on its left edge and one on its right wherever there is more that
// way (and none where there is not, hidden from the accessibility tree and the
// Tab order and not merely dimmed), each as tall as the cards' pictures and at
// the window's edge, a click or Enter moving the strip about a page, the old
// Previous and Next in the row's heading gone, and the page marks and the
// words that say which page the strip is on. A mark is a stop, a place the
// arrows take the strip, and the one live region for the rows says where an
// arrow press has landed, and says nothing for any other scroll. On a phone a
// row still scrolls, and its second card shows at least half of itself. The stops and
// the place of the lit mark are worked out here from the strip's own widths
// and a card's and not from the rule under test. Waits are on a state reached (a scroll end, a
// position), never on a time.
import { expect, type Locator, type Page } from '@playwright/test';
import { test } from '../clock';
import { readRows } from './catalogue';
import { atRest, untilScrolled } from './scrolling';

const catalogue = readRows();

// Chromium on this Mac draws overlay scrollbars that take no room (the system's
// setting), and headless Chromium hides them besides (--hide-scrollbars), so a
// test of one would find none drawn however the page was made. Both are turned
// off here, which gives the classic bar of 15px, so that a scrollbar that is
// there is measured as there. Nothing else in this file measures one.
test.use({
  launchOptions: {
    ignoreDefaultArgs: ['--hide-scrollbars'],
    args: ['--disable-features=OverlayScrollbar'],
  },
});

function section(page: Page, id: string): Locator {
  return page.locator(`section[id="${id}"]`);
}

function strip(page: Page, id: string): Locator {
  return section(page, id).getByRole('list');
}

/** The arrow as a reader meets it: not found at all while it is hidden. */
function previous(page: Page, id: string): Locator {
  return section(page, id).getByRole('button', { name: /^Previous/ });
}

function next(page: Page, id: string): Locator {
  return section(page, id).getByRole('button', { name: /^Next/ });
}

/** The marks the row draws, and the one that is lit. */
function marks(page: Page, id: string): Locator {
  return section(page, id).locator('.row-pages .page-mark');
}

function words(page: Page, id: string): Locator {
  return section(page, id).locator('[data-page-words]');
}

const left = (list: Locator) => list.evaluate((el) => el.scrollLeft);

async function overflows(list: Locator): Promise<boolean> {
  return list.evaluate((el) => el.scrollWidth - el.clientWidth > 1);
}

/** Script has run: every row has been given its arrows. */
async function ready(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.locator('section.row[data-arrows]').first()).toBeAttached();
}

/**
 * Moves a strip part way along with the mouse's wheel, over the empty band
 * below its cards (so that no card is pointed at and none is lit), and waits
 * for it to stop: a scroll that is not an arrow's, as a trackpad makes it.
 */
async function toMiddle(page: Page, list: Locator): Promise<void> {
  await list.scrollIntoViewIfNeeded();
  const box = await list.boundingBox();
  if (box === null) throw new Error('the strip is not drawn');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height - 8);
  await page.mouse.wheel(box.width * 0.45, 0);
  await expect.poll(() => left(list)).toBeGreaterThan(2);
  await atRest(list);
  const room = await list.evaluate((el) => el.scrollWidth - el.clientWidth);
  const at = await left(list);
  expect(at, 'the strip is neither at its start nor at its end').toBeLessThan(
    room - 2,
  );
}

/**
 * The row's stops, worked out here from the strip's own widths and the card's
 * and not from the rule under test: the start, a window on at a time, and the
 * end in place of any stop with less than a card of strip left after it.
 */
function stopsOf(list: Locator): Promise<number[]> {
  return list.evaluate((el) => {
    const furthest = el.scrollWidth - el.clientWidth;
    if (furthest <= 1) return [0];
    const card = el.querySelector('li')?.getBoundingClientRect().width ?? 0;
    const found = [0];
    for (let at = el.clientWidth; at < furthest; at += el.clientWidth) {
      if (furthest - at < card) break;
      found.push(at);
    }
    found.push(furthest);
    return found;
  });
}

/** How many stops, and so marks, the strip has. */
async function pagesOf(list: Locator): Promise<number> {
  return (await stopsOf(list)).length;
}

/** The stop a strip is at or nearest to. */
async function pageOf(list: Locator): Promise<number> {
  const stops = await stopsOf(list);
  const at = await left(list);
  let best = 0;
  stops.forEach((stop, index) => {
    if (Math.abs(stop - at) < Math.abs((stops[best] ?? 0) - at)) best = index;
  });
  return best;
}

test.describe('at a desk', () => {
  test.use({ viewport: { width: 1440, height: 1000 } });

  test.beforeEach(async ({ page }) => {
    await ready(page);
  });

  test('no strip shows a scrollbar', async ({ page }) => {
    let reached = 0;
    for (const each of catalogue.rows) {
      const list = strip(page, each.id);
      // A strip's box is its own height and a scrollbar's, since it has no
      // border: the two are equal only where nothing is drawn below.
      const bar = await list.evaluate((el: HTMLElement) => ({
        offset: el.offsetHeight,
        client: el.clientHeight,
        borders:
          parseFloat(getComputedStyle(el).borderTopWidth) +
          parseFloat(getComputedStyle(el).borderBottomWidth),
      }));
      expect(bar.offset).toBe(bar.client + bar.borders);
      // The row is one that scrolls, or the count proves nothing.
      if (await overflows(list)) reached += 1;
    }
    expect(reached).toBeGreaterThan(0);
  });

  test('a row that overflows has Next and no Previous at the start', async ({
    page,
  }) => {
    let reached = 0;
    for (const each of catalogue.rows) {
      if (!(await overflows(strip(page, each.id)))) continue;
      reached += 1;
      await expect(next(page, each.id)).toBeVisible();
      await expect(previous(page, each.id)).toHaveCount(0);
      // Not there to press: hidden from the tree, not dimmed.
      await expect(
        section(page, each.id).locator('button[data-page="previous"]'),
      ).toBeHidden();
      await expect(
        section(page, each.id).locator('button[data-page="previous"]'),
      ).not.toHaveAttribute('aria-disabled');
    }
    expect(reached).toBeGreaterThan(0);
  });

  test('each arrow says which row it moves, whether or not it is shown', async ({
    page,
  }) => {
    // Read from the markup and not by role: an arrow that is hidden has no
    // role to be found by, but it must carry the name it will have.
    let reached = 0;
    for (const each of catalogue.rows) {
      const row = section(page, each.id);
      await expect(row.locator('button[data-page="previous"]')).toHaveAttribute(
        'aria-label',
        `Previous in ${each.title}`,
      );
      await expect(row.locator('button[data-page="next"]')).toHaveAttribute(
        'aria-label',
        `Next in ${each.title}`,
      );
      reached += 1;
    }
    expect(reached).toBe(catalogue.rows.length);
  });

  test('the arrows are real buttons with a chevron that is not read', async ({
    page,
  }) => {
    let reached = 0;
    for (const each of catalogue.rows) {
      for (const which of ['previous', 'next']) {
        const arrow = section(page, each.id).locator(
          `button[data-page="${which}"]`,
        );
        expect(await arrow.evaluate((el) => el.tagName)).toBe('BUTTON');
        await expect(arrow).toHaveAttribute('type', 'button');
        const svg = arrow.locator('svg');
        await expect(svg).toHaveCount(1);
        await expect(svg).toHaveAttribute('aria-hidden', 'true');
        reached += 1;
      }
    }
    expect(reached).toBe(catalogue.rows.length * 2);
  });

  test('the old Previous and Next in the row’s heading are gone', async ({
    page,
  }) => {
    await expect(page.locator('.row-head button')).toHaveCount(0);
    await expect(page.locator('.row-buttons')).toHaveCount(0);
    await expect(page.locator('.row-button')).toHaveCount(0);
    // One of each arrow a row, and only in the row's own box.
    for (const each of catalogue.rows) {
      await expect(
        section(page, each.id).locator('button[data-page]'),
      ).toHaveCount(2);
    }
  });

  test('an arrow is over the strip’s cards, and under nothing of the row’s', async ({
    page,
  }) => {
    const first = catalogue.rows[0];
    if (first === undefined) throw new Error('no rows were read');
    const arrow = next(page, first.id);
    const box = await arrow.boundingBox();
    const hit = await page.evaluate(
      ({ x, y }) => {
        const found = document.elementFromPoint(x, y);
        return found?.closest('button[data-page]')?.getAttribute('data-page');
      },
      { x: (box?.x ?? 0) + (box?.width ?? 0) / 2, y: (box?.y ?? 0) + 20 },
    );
    expect(hit).toBe('next');
  });

  test('a real click on Next moves the strip about a page, and Enter on Next does the same', async ({
    page,
  }) => {
    const first = catalogue.rows[0];
    if (first === undefined) throw new Error('no rows were read');
    const list = strip(page, first.id);
    const { width, card } = await list.evaluate((el) => ({
      width: el.clientWidth,
      card: el.querySelector('li')?.getBoundingClientRect().width ?? 0,
    }));
    await untilScrolled(list, () => next(page, first.id).click());
    await atRest(list);
    const once = await left(list);
    // About a page: it comes to rest on the start of a card, so a little under
    // or over (by less than a card), never none and never two.
    expect(once).toBeGreaterThan(width * 0.6);
    expect(once).toBeLessThanOrEqual(width + card);
    // Back to the start by Previous, and then the same step by Enter.
    await untilScrolled(list, () => previous(page, first.id).click());
    await atRest(list);
    expect(await left(list)).toBe(0);
    await next(page, first.id).focus();
    await untilScrolled(list, () => page.keyboard.press('Enter'));
    await atRest(list);
    expect(await left(list)).toBe(once);
  });

  test('Space works an arrow too', async ({ page }) => {
    const first = catalogue.rows[0];
    if (first === undefined) throw new Error('no rows were read');
    const list = strip(page, first.id);
    await next(page, first.id).focus();
    await untilScrolled(list, () => page.keyboard.press('Space'));
    expect(await left(list)).toBeGreaterThan(0);
  });

  test('an arrow that goes while it has focus hands focus to the strip, not to the page', async ({
    page,
  }) => {
    const first = catalogue.rows[0];
    if (first === undefined) throw new Error('no rows were read');
    const list = strip(page, first.id);
    await next(page, first.id).focus();
    let presses = 0;
    while ((await next(page, first.id).count()) > 0) {
      presses += 1;
      expect(presses).toBeLessThanOrEqual(first.entries.length);
      await untilScrolled(list, () => page.keyboard.press('Enter'));
      await atRest(list);
    }
    expect(presses).toBeGreaterThan(0);
    await expect(next(page, first.id)).toHaveCount(0);
    // Focus is somewhere a keyboard can carry on from: on the strip or the
    // arrow that remains in the row, never lost to the body.
    const where = await page.evaluate(() => {
      const active = document.activeElement;
      return {
        body: active === document.body,
        inRow: active?.closest('section.row') !== null,
      };
    });
    expect(where.body).toBe(false);
    expect(where.inRow).toBe(true);
  });

  test('the right arrow key still scrolls a focused strip', async ({
    page,
  }) => {
    const first = catalogue.rows[0];
    if (first === undefined) throw new Error('no rows were read');
    const list = strip(page, first.id);
    await list.focus();
    await page.keyboard.press('ArrowRight');
    await expect.poll(() => left(list)).toBeGreaterThan(0);
  });

  test('a window that grows until the row fits loses its arrows and its marks', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 3200, height: 1000 });
    let fitting = 0;
    for (const each of catalogue.rows) {
      if (await overflows(strip(page, each.id))) continue;
      fitting += 1;
      await expect(previous(page, each.id)).toHaveCount(0);
      await expect(next(page, each.id)).toHaveCount(0);
      await expect(marks(page, each.id)).toHaveCount(0);
      await expect(words(page, each.id)).toHaveText('');
    }
    expect(fitting).toBeGreaterThan(0);
  });

  test('the page marks are one a page, one is lit, and the words say which', async ({
    page,
  }) => {
    let reached = 0;
    for (const each of catalogue.rows) {
      const list = strip(page, each.id);
      if (!(await overflows(list))) {
        await expect(marks(page, each.id)).toHaveCount(0);
        continue;
      }
      reached += 1;
      const pages = await pagesOf(list);
      expect(pages).toBeGreaterThan(1);
      await expect(marks(page, each.id)).toHaveCount(pages);
      await expect(
        section(page, each.id).locator('.row-pages [data-current]'),
      ).toHaveCount(1);
      await expect(marks(page, each.id).first()).toHaveAttribute(
        'data-current',
        '',
      );
      await expect(words(page, each.id)).toHaveText(
        `Page 1 of ${pages}, ${each.title}`,
      );
      // The marks are decoration beside the words.
      await expect(
        section(page, each.id).locator('.row-pages'),
      ).toHaveAttribute('aria-hidden', 'true');
    }
    expect(reached).toBeGreaterThan(0);
  });

  test('the lit mark and the words follow the strip as it settles', async ({
    page,
  }) => {
    const first = catalogue.rows[0];
    if (first === undefined) throw new Error('no rows were read');
    const list = strip(page, first.id);
    const pages = await pagesOf(list);
    expect(pages).toBeGreaterThan(1);
    const seen: number[] = [];
    let clicks = 0;
    while ((await next(page, first.id).count()) > 0) {
      clicks += 1;
      expect(clicks).toBeLessThanOrEqual(first.entries.length);
      await untilScrolled(list, () => next(page, first.id).click());
      await atRest(list);
      const at = await pageOf(list);
      seen.push(at);
      await expect(marks(page, first.id).nth(at)).toHaveAttribute(
        'data-current',
        '',
      );
      await expect(
        section(page, first.id).locator('.row-pages [data-current]'),
      ).toHaveCount(1);
      await expect(words(page, first.id)).toHaveText(
        `Page ${at + 1} of ${pages}, ${first.title}`,
      );
    }
    // It went from the first page to the last.
    expect(seen.at(-1)).toBe(pages - 1);
    // And back to the start, where the first mark is lit.
    while ((await previous(page, first.id).count()) > 0) {
      await untilScrolled(list, () => previous(page, first.id).click());
      await atRest(list);
    }
    await expect(marks(page, first.id).first()).toHaveAttribute(
      'data-current',
      '',
    );
  });

  test('the words are written once for a page, not once for a frame of the glide', async ({
    page,
  }) => {
    const first = catalogue.rows[0];
    if (first === undefined) throw new Error('no rows were read');
    const list = strip(page, first.id);
    const counted = await page.evaluate(
      ({ id }) => {
        const row = document.querySelector(`section[id="${id}"]`);
        const target = row?.querySelector('[data-page-words]');
        const scroller = row?.querySelector('ul.strip');
        if (!target || !scroller) throw new Error('the row is not there');
        const state = { writes: 0, scrolls: 0 };
        new MutationObserver((records) => {
          state.writes += records.length;
        }).observe(target, {
          childList: true,
          characterData: true,
          subtree: true,
        });
        scroller.addEventListener('scroll', () => (state.scrolls += 1), {
          passive: true,
        });
        (window as unknown as { counted: typeof state }).counted = state;
        return true;
      },
      { id: first.id },
    );
    expect(counted).toBe(true);
    await untilScrolled(list, () => next(page, first.id).click());
    await atRest(list);
    const state = await page.evaluate(
      () =>
        (window as unknown as { counted: { writes: number; scrolls: number } })
          .counted,
    );
    // A glide of many frames fired many scrolls; the page changed once.
    expect(state.scrolls).toBeGreaterThan(3);
    expect(state.writes).toBeGreaterThan(0);
    expect(state.writes).toBeLessThanOrEqual(2);
  });

  test('the first row at a desk has two marks, and one Next goes to the end', async ({
    page,
  }) => {
    const first = catalogue.rows[0];
    if (first === undefined) throw new Error('no rows were read');
    const list = strip(page, first.id);
    // The row is a window and a bit: a mark is a place the arrows go, so two.
    await expect(marks(page, first.id)).toHaveCount(2);
    const furthest = await list.evaluate(
      (el) => el.scrollWidth - el.clientWidth,
    );
    expect(furthest).toBeGreaterThan(0);
    await untilScrolled(list, () => next(page, first.id).click());
    await atRest(list);
    expect(await left(list)).toBeGreaterThan(furthest - 2);
    await expect(next(page, first.id)).toHaveCount(0);
    await expect(marks(page, first.id).nth(1)).toHaveAttribute(
      'data-current',
      '',
    );
    await untilScrolled(list, () => previous(page, first.id).click());
    await atRest(list);
    expect(await left(list)).toBe(0);
    await expect(marks(page, first.id).nth(0)).toHaveAttribute(
      'data-current',
      '',
    );
  });

  test('every mark is a place the arrows go: Next from each stop lands on the next', async ({
    page,
  }) => {
    let reached = 0;
    for (const each of catalogue.rows) {
      const list = strip(page, each.id);
      if (!(await overflows(list))) continue;
      const stops = await stopsOf(list);
      expect(stops.length).toBeGreaterThan(1);
      let landed = 1;
      while ((await next(page, each.id).count()) > 0) {
        await untilScrolled(list, () => next(page, each.id).click());
        await atRest(list);
        landed += 1;
        expect(landed).toBeLessThanOrEqual(stops.length);
      }
      // Next ran out exactly when the marks did.
      expect(landed).toBe(stops.length);
      reached += 1;
    }
    expect(reached).toBeGreaterThan(0);
  });

  // The live region: one for the page's rows, empty until an arrow has been
  // pressed and the strip has stopped, and then the row's words, once. Nothing
  // but an arrow fills it, so a wheel, a drag or a key on the strip is silent.
  const LIVE = '[data-rows-live]';

  test('the live region is one, polite, and empty when the page has loaded', async ({
    page,
  }) => {
    await expect(page.locator(LIVE)).toHaveCount(1);
    await expect(page.locator(LIVE)).toHaveAttribute('aria-live', 'polite');
    await expect(page.locator(LIVE)).toHaveText('');
  });

  test('after a Next click and the strip settling, the live region holds the row’s words, once', async ({
    page,
  }) => {
    const first = catalogue.rows[0];
    if (first === undefined) throw new Error('no rows were read');
    const list = strip(page, first.id);
    await page.evaluate((selector) => {
      const target = document.querySelector(selector);
      if (target === null) throw new Error('no live region');
      const state = { writes: 0 };
      new MutationObserver((records) => {
        state.writes += records.length;
      }).observe(target, {
        childList: true,
        characterData: true,
        subtree: true,
      });
      (window as unknown as { live: typeof state }).live = state;
    }, LIVE);
    const pages = await pagesOf(list);
    await untilScrolled(list, () => next(page, first.id).click());
    await atRest(list);
    const at = await pageOf(list);
    await expect(page.locator(LIVE)).toHaveText(
      `Page ${at + 1} of ${pages}, ${first.title}`,
    );
    const writes = await page.evaluate(
      () => (window as unknown as { live: { writes: number } }).live.writes,
    );
    expect(writes, 'the region was written once').toBeGreaterThan(0);
    expect(writes, 'and not once a frame').toBeLessThanOrEqual(2);
  });

  test('a wheel scroll leaves the live region as it was, empty or filled', async ({
    page,
  }) => {
    const first = catalogue.rows[0];
    if (first === undefined) throw new Error('no rows were read');
    const list = strip(page, first.id);
    await toMiddle(page, list);
    await expect(page.locator(LIVE)).toHaveText('');
    // And with something said, a later wheel scroll does not change it.
    await untilScrolled(list, () => next(page, first.id).click());
    await atRest(list);
    const said = await page.locator(LIVE).textContent();
    expect(said).not.toBe('');
    await page.evaluate((selector) => {
      const target = document.querySelector(selector);
      const state = { writes: 0 };
      new MutationObserver((records) => {
        state.writes += records.length;
      }).observe(target as Node, {
        childList: true,
        characterData: true,
        subtree: true,
      });
      (window as unknown as { live: typeof state }).live = state;
    }, LIVE);
    await list.focus();
    await page.keyboard.press('ArrowLeft');
    await expect
      .poll(() => left(list))
      .toBeLessThan(
        (await list.evaluate((el) => el.scrollWidth - el.clientWidth)) - 2,
      );
    await atRest(list);
    await page.mouse.wheel(-200, 0);
    await atRest(list);
    expect(await page.locator(LIVE).textContent()).toBe(said);
    expect(
      await page.evaluate(
        () => (window as unknown as { live: { writes: number } }).live.writes,
      ),
    ).toBe(0);
  });

  test('the words are not a live region, so a glide announces nothing', async ({
    page,
  }) => {
    let reached = 0;
    for (const each of catalogue.rows) {
      const target = words(page, each.id);
      await expect(target).toHaveCount(1);
      await expect(target).not.toHaveAttribute('aria-live');
      await expect(target).not.toHaveAttribute('role');
      reached += 1;
    }
    expect(reached).toBe(catalogue.rows.length);
  });
});

test.describe('where a page is shorter than the row', () => {
  test.use({ viewport: { width: 700, height: 1000 } });

  test('Next moves the strip about a page, then to the end, and Previous goes back', async ({
    page,
  }) => {
    await ready(page);
    const first = catalogue.rows[0];
    if (first === undefined) throw new Error('no rows were read');
    const list = strip(page, first.id);
    const width = await list.evaluate((el) => el.clientWidth);
    const furthest = await list.evaluate(
      (el) => el.scrollWidth - el.clientWidth,
    );
    // The case is only this one if a page is shorter than the way to the end.
    expect(furthest).toBeGreaterThan(width);
    await next(page, first.id).click();
    await expect.poll(() => left(list)).toBeGreaterThan(width * 0.6);
    expect(await left(list)).toBeLessThanOrEqual(width + 2);
    await expect(previous(page, first.id)).toBeVisible();
    await expect(next(page, first.id)).toBeVisible();
    // Then to the end, however many clicks away the catalogue has put it. A
    // click moves the strip less than a full page, since it comes to rest on
    // the start of a card, so the clicks are counted against the cards: each
    // must move the strip on, and there may be no more of them than cards.
    let clicks = 0;
    while ((await next(page, first.id).count()) > 0) {
      clicks += 1;
      expect(clicks).toBeLessThanOrEqual(first.entries.length);
      const before = await left(list);
      await next(page, first.id).click();
      await expect.poll(() => left(list)).toBeGreaterThan(before);
      await atRest(list);
    }
    expect(clicks).toBeGreaterThan(0);
    await expect.poll(() => left(list)).toBeGreaterThan(furthest - 2);
    await expect(next(page, first.id)).toHaveCount(0);
    await previous(page, first.id).click();
    await expect.poll(() => left(list)).toBeLessThan(furthest - width * 0.6);
  });
});

test.describe('where a row has three stops or more', () => {
  test.use({ viewport: { width: 700, height: 1000 } });

  test.beforeEach(async ({ page }) => {
    await ready(page);
  });

  test('the arrows cover the cards’ pictures, as tall as them and aligned, at the window’s edges', async ({
    page,
  }) => {
    const first = catalogue.rows[0];
    if (first === undefined) throw new Error('no rows were read');
    const list = strip(page, first.id);
    await untilScrolled(list, () => next(page, first.id).click());
    await atRest(list);
    await expect(previous(page, first.id)).toBeVisible();
    await expect(next(page, first.id)).toBeVisible();
    const picture = await section(page, first.id)
      .locator('li.card .frame')
      .first()
      .boundingBox();
    const window = await page.evaluate(
      () => document.documentElement.clientWidth,
    );
    expect(picture).not.toBeNull();
    for (const which of [previous, next]) {
      const box = await which(page, first.id).boundingBox();
      expect(box).not.toBeNull();
      expect(box?.y ?? 0).toBeCloseTo(picture?.y ?? -1, 0);
      expect(box?.height ?? 0).toBeCloseTo(picture?.height ?? -1, 0);
      expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);
    }
    const before = await previous(page, first.id).boundingBox();
    const after = await next(page, first.id).boundingBox();
    expect(before?.x ?? 99).toBeLessThanOrEqual(1);
    expect((after?.x ?? 0) + (after?.width ?? 0)).toBeGreaterThanOrEqual(
      window - 1,
    );
    expect((after?.x ?? 0) + (after?.width ?? 0)).toBeLessThanOrEqual(
      window + 1,
    );
  });

  test('both arrows part way along, and at the end Previous and no Next', async ({
    page,
  }) => {
    // Found by shape: a row with three stops or more, so that a step by the
    // arrow is neither the start nor the end.
    let target: (typeof catalogue.rows)[number] | undefined;
    for (const each of catalogue.rows)
      if ((await pagesOf(strip(page, each.id))) >= 3) target = each;
    if (target === undefined) throw new Error('no row has three stops');
    const list = strip(page, target.id);
    await untilScrolled(list, () => next(page, target.id).click());
    await atRest(list);
    await expect(previous(page, target.id)).toBeVisible();
    await expect(next(page, target.id)).toBeVisible();
    let clicks = 0;
    while ((await next(page, target.id).count()) > 0) {
      clicks += 1;
      expect(clicks).toBeLessThanOrEqual(target.entries.length);
      await untilScrolled(list, () => next(page, target.id).click());
      await atRest(list);
    }
    await expect(next(page, target.id)).toHaveCount(0);
    await expect(previous(page, target.id)).toBeVisible();
    const furthest = await list.evaluate(
      (el) => el.scrollWidth - el.clientWidth,
    );
    expect(await left(list)).toBeGreaterThan(furthest - 2);
    // And back to the start: Previous goes, Next returns.
    while ((await previous(page, target.id).count()) > 0) {
      await untilScrolled(list, () => previous(page, target.id).click());
      await atRest(list);
    }
    expect(await left(list)).toBe(0);
    await expect(next(page, target.id)).toBeVisible();
  });

  test('the lit mark and the words follow the arrows through a middle stop', async ({
    page,
  }) => {
    await ready(page);
    const first = catalogue.rows[0];
    if (first === undefined) throw new Error('no rows were read');
    const list = strip(page, first.id);
    const pages = await pagesOf(list);
    expect(pages).toBeGreaterThan(2);
    await expect(marks(page, first.id)).toHaveCount(pages);
    const lit: number[] = [];
    while ((await next(page, first.id).count()) > 0) {
      await untilScrolled(list, () => next(page, first.id).click());
      await atRest(list);
      const at = await pageOf(list);
      lit.push(at);
      await expect(marks(page, first.id).nth(at)).toHaveAttribute(
        'data-current',
        '',
      );
      await expect(words(page, first.id)).toHaveText(
        `Page ${at + 1} of ${pages}, ${first.title}`,
      );
    }
    // Every stop was lit in turn, the middle ones included.
    expect(lit).toEqual(Array.from({ length: pages - 1 }, (_, i) => i + 1));
  });
});

// Part 2 of plans/cards.md: a phone keeps its sideways rows, with cards small
// enough that the next one is plainly there. At 78vw the second card showed
// 50px of 304, which read as one column; the bar is half of it, measured
// against the window and not the strip, at the strip's start.
test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('every row scrolls sideways, and its second card shows at least half of itself', async ({
    page,
  }) => {
    await ready(page);
    let reached = 0;
    for (const each of catalogue.rows) {
      if (each.entries.length < 2) continue;
      const list = strip(page, each.id);
      expect(await overflows(list), `${each.id} scrolls sideways`).toBe(true);
      expect(await left(list)).toBe(0);
      const seen = await list.evaluate((el) => {
        const second = el.querySelectorAll('li')[1];
        if (second === undefined) return null;
        const box = second.getBoundingClientRect();
        const inside =
          Math.min(box.right, window.innerWidth) - Math.max(box.left, 0);
        return { inside, width: box.width };
      });
      expect(seen, `${each.id} has a second card`).not.toBeNull();
      expect(seen?.width ?? 0).toBeGreaterThan(0);
      expect(
        (seen?.inside ?? 0) / (seen?.width ?? 1),
        `${each.id}'s second card is half in the window`,
      ).toBeGreaterThanOrEqual(0.5);
      reached += 1;
    }
    expect(reached).toBeGreaterThan(0);
  });
});

test.describe('below 340px, where a row stacks and does not scroll', () => {
  for (const width of [320, 339]) {
    test(`at ${width} wide there are no arrows and no marks`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 800 });
      await ready(page);
      for (const each of catalogue.rows) {
        await expect(
          section(page, each.id).locator('button[data-page]:visible'),
        ).toHaveCount(0);
        await expect(
          section(page, each.id).locator('.row-pages .page-mark:visible'),
        ).toHaveCount(0);
        await expect(words(page, each.id)).toHaveText('');
      }
    });
  }
});
