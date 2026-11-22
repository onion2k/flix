// Holds how a row's Previous and Next buttons behave once script has run: both
// shown where the row overflows and none where it fits, Previous disabled at
// the start and Next at the end, a click moving the strip about a page, a
// disabled button keeping focus and doing nothing, and the arrow key scrolling
// a focused strip. Waits are on a scroll position reached, never on a time.
import { expect, type Locator, type Page } from '@playwright/test';
import { test } from '../clock';
import { readRows } from './catalogue';

const catalogue = readRows();

function strip(page: Page, id: string): Locator {
  return page.locator(`section[id="${id}"]`).getByRole('list');
}

function previous(page: Page, id: string): Locator {
  return page
    .locator(`section[id="${id}"]`)
    .getByRole('button', { name: /^Previous/ });
}

function next(page: Page, id: string): Locator {
  return page
    .locator(`section[id="${id}"]`)
    .getByRole('button', { name: /^Next/ });
}

const left = (list: Locator) => list.evaluate((el) => el.scrollLeft);

async function overflows(list: Locator): Promise<boolean> {
  return list.evaluate((el) => el.scrollWidth - el.clientWidth > 1);
}

/** The strip has stopped: its position is the same across two frames. */
async function atRest(list: Locator): Promise<void> {
  await expect
    .poll(() =>
      list.evaluate(
        (el) =>
          new Promise<boolean>((done) => {
            const was = el.scrollLeft;
            requestAnimationFrame(() =>
              requestAnimationFrame(() => done(el.scrollLeft === was)),
            );
          }),
      ),
    )
    .toBe(true);
}

/** Two frames drawn: a state to wait on where nothing is meant to happen. */
async function settled(page: Page): Promise<void> {
  await page.evaluate(
    () =>
      new Promise<void>((done) =>
        requestAnimationFrame(() => requestAnimationFrame(() => done())),
      ),
  );
}

test.describe('at a desk', () => {
  test.use({ viewport: { width: 1440, height: 1000 } });

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('a row that overflows shows both buttons, Previous disabled at the start', async ({
    page,
  }) => {
    let reached = 0;
    for (const each of catalogue.rows) {
      if (!(await overflows(strip(page, each.id)))) continue;
      reached += 1;
      await expect(previous(page, each.id)).toBeVisible();
      await expect(next(page, each.id)).toBeVisible();
      await expect(previous(page, each.id)).toHaveAttribute(
        'aria-disabled',
        'true',
      );
      await expect(next(page, each.id)).toHaveAttribute(
        'aria-disabled',
        'false',
      );
    }
    expect(reached).toBeGreaterThan(0);
  });

  test('each button says which row it moves', async ({ page }) => {
    // Read from the markup and not by role: a row that fits keeps its
    // buttons hidden, and a hidden button has no role to be found by, but
    // it must already carry the name it will have when the window narrows.
    let reached = 0;
    for (const each of catalogue.rows) {
      const section = page.locator(`section[id="${each.id}"]`);
      await expect(
        section.locator('button[data-page="previous"]'),
      ).toHaveAttribute('aria-label', `Previous in ${each.title}`);
      await expect(section.locator('button[data-page="next"]')).toHaveAttribute(
        'aria-label',
        `Next in ${each.title}`,
      );
      reached += 1;
    }
    expect(reached).toBe(catalogue.rows.length);
  });

  test('Next moves the strip to the end of a short row, and then Next is disabled and Previous is not', async ({
    page,
  }) => {
    // The case is a row that holds less than a page beyond what shows, so
    // that a page is clamped to the end. Which row that is depends on the
    // catalogue, so it is found by its shape and not by its place.
    let first: (typeof catalogue.rows)[number] | undefined;
    for (const each of catalogue.rows) {
      const room = await strip(page, each.id).evaluate((el) => ({
        beyond: el.scrollWidth - el.clientWidth,
        page: el.clientWidth,
      }));
      if (room.beyond > 1 && room.beyond <= room.page) {
        first = each;
        break;
      }
    }
    if (first === undefined)
      throw new Error('no row holds less than a page beyond what shows');
    const list = strip(page, first.id);
    const furthest = await list.evaluate(
      (el) => el.scrollWidth - el.clientWidth,
    );
    expect(furthest).toBeGreaterThan(0);
    await next(page, first.id).click();
    await expect.poll(() => left(list)).toBeGreaterThan(furthest - 2);
    await expect(next(page, first.id)).toHaveAttribute('aria-disabled', 'true');
    await expect(previous(page, first.id)).toHaveAttribute(
      'aria-disabled',
      'false',
    );
    await previous(page, first.id).click();
    await expect.poll(() => left(list)).toBe(0);
    await expect(previous(page, first.id)).toHaveAttribute(
      'aria-disabled',
      'true',
    );
  });

  test('a disabled button keeps focus and does nothing', async ({ page }) => {
    const first = catalogue.rows[0];
    if (first === undefined) throw new Error('no rows were read');
    const button = previous(page, first.id);
    await expect(button).toHaveAttribute('aria-disabled', 'true');
    await button.focus();
    await expect(button).toBeFocused();
    await page.keyboard.press('Enter');
    await button.click({ force: true });
    await settled(page);
    await expect(button).toBeFocused();
    expect(await left(strip(page, first.id))).toBe(0);
    // A button that is not disabled is not `disabled`: that drops focus.
    expect(await button.evaluate((el: HTMLButtonElement) => el.disabled)).toBe(
      false,
    );
  });

  test('the right arrow key scrolls a focused strip', async ({ page }) => {
    const first = catalogue.rows[0];
    if (first === undefined) throw new Error('no rows were read');
    const list = strip(page, first.id);
    await list.focus();
    await page.keyboard.press('ArrowRight');
    await expect.poll(() => left(list)).toBeGreaterThan(0);
  });

  test('a window that grows until the row fits loses its buttons', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 3200, height: 1000 });
    let fitting = 0;
    for (const each of catalogue.rows) {
      if (await overflows(strip(page, each.id))) continue;
      fitting += 1;
      await expect(previous(page, each.id)).toBeHidden();
      await expect(next(page, each.id)).toBeHidden();
    }
    expect(fitting).toBeGreaterThan(0);
  });
});

test.describe('where a page is shorter than the row', () => {
  test.use({ viewport: { width: 700, height: 1000 } });

  test('Next moves the strip about a page, then to the end, and Previous goes back', async ({
    page,
  }) => {
    await page.goto('/');
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
    await expect(previous(page, first.id)).toHaveAttribute(
      'aria-disabled',
      'false',
    );
    await expect(next(page, first.id)).toHaveAttribute(
      'aria-disabled',
      'false',
    );
    // Then to the end, however many clicks away the catalogue has put it. A
    // click moves the strip less than a full page, since it comes to rest on
    // the start of a card, so the clicks are counted against the cards: each
    // must move the strip on, and there may be no more of them than cards.
    let clicks = 0;
    while (
      (await next(page, first.id).getAttribute('aria-disabled')) === 'false'
    ) {
      clicks += 1;
      expect(clicks).toBeLessThanOrEqual(first.entries.length);
      const before = await left(list);
      await next(page, first.id).click();
      await expect.poll(() => left(list)).toBeGreaterThan(before);
      await atRest(list);
    }
    expect(clicks).toBeGreaterThan(0);
    await expect.poll(() => left(list)).toBeGreaterThan(furthest - 2);
    await expect(next(page, first.id)).toHaveAttribute('aria-disabled', 'true');
    await previous(page, first.id).click();
    await expect.poll(() => left(list)).toBeLessThan(furthest - width * 0.6);
  });
});
