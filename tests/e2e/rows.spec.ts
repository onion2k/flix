// Holds how a row's Previous and Next buttons behave once script has run: both
// shown where the row overflows and none where it fits, Previous disabled at
// the start and Next at the end, a click moving the strip about a page, a
// disabled button keeping focus and doing nothing, and the arrow key scrolling
// a focused strip. Waits are on a scroll position reached, never on a time.
import { expect, test, type Locator, type Page } from '@playwright/test';
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
    for (const each of catalogue.rows) {
      await expect(previous(page, each.id)).toHaveAccessibleName(
        `Previous in ${each.title}`,
      );
      await expect(next(page, each.id)).toHaveAccessibleName(
        `Next in ${each.title}`,
      );
    }
  });

  test('Next moves the strip to the end of a short row, and then Next is disabled and Previous is not', async ({
    page,
  }) => {
    const first = catalogue.rows[0];
    if (first === undefined) throw new Error('no rows were read');
    const list = strip(page, first.id);
    // At this width the row holds less than a page beyond what shows, so a
    // page is clamped to the end.
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
    await next(page, first.id).click();
    await expect.poll(() => left(list)).toBeGreaterThan(furthest - 2);
    await expect(next(page, first.id)).toHaveAttribute('aria-disabled', 'true');
    await previous(page, first.id).click();
    await expect.poll(() => left(list)).toBeLessThan(furthest - width * 0.6);
  });
});
