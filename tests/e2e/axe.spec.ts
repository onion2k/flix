// Runs the axe audit over the built home page, 404 and privacy page at a
// desk's width and a phone's, and once more over the home page with a card
// focused, with every
// WCAG tag the installed axe has for 2.0, 2.1 and 2.2 (A, AA and the AAA rules
// it holds; it has no AAA tags for 2.1 or 2.2) and its best-practice rules.
// A violation fails the test, printed with its rule id and the elements; an
// incomplete result (axe could not decide) is attached to the report as JSON
// and counted, and does not fail. Without it nothing checks the page's
// structure, names, roles and targets against the rules a machine can read.
// If axe could not be injected under the page's content policy this spec
// alone would need a context with `bypassCSP: true`; it did not, since axe
// is run through the page's own evaluate, so none is used.
import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';
import { test } from '../clock';
import { settleOnFirstRow } from './card-loop';

const TAGS = [
  'wcag2a',
  'wcag2aa',
  'wcag2aaa',
  'wcag21a',
  'wcag21aa',
  'wcag22aa',
  'best-practice',
];
const WIDTHS = [1440, 390];

/** Runs the audit, fails on a violation, and attaches and counts the rest. */
async function audit(page: Page, label: string): Promise<void> {
  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  await test.info().attach(`axe incomplete: ${label}`, {
    body: JSON.stringify(results.incomplete, null, 2),
    contentType: 'application/json',
  });
  test.info().annotations.push({
    type: 'measured',
    description: `${label}: ${results.passes.length} rules passed, ${results.violations.length} violated, ${results.incomplete.length} incomplete`,
  });
  // Reading no rule at all would be a pass for the wrong reason.
  expect(results.passes.length, 'rules that passed').toBeGreaterThan(10);
  expect(
    results.violations.map(
      (violation) =>
        `${violation.id} (${violation.impact ?? 'no impact'}): ${violation.nodes
          .map((node) => node.target.join(' '))
          .join(' | ')}`,
    ),
    `axe violations on ${label}`,
  ).toEqual([]);
}

for (const width of WIDTHS) {
  test.describe(`at ${width} wide`, () => {
    test.use({ viewport: { width, height: width > 800 ? 1000 : 844 } });

    test('the home page has no axe violation', async ({ page }) => {
      await page.goto('/');
      await expect(
        page.locator('section.row[data-arrows]').first(),
      ).toBeAttached();
      await audit(page, `home at ${width}`);
    });

    test('the 404 has no axe violation', async ({ page }) => {
      await page.goto('/nowhere-here/');
      await audit(page, `404 at ${width}`);
    });

    test('the privacy page has no axe violation', async ({ page }) => {
      await page.goto('/privacy/');
      await audit(page, `privacy at ${width}`);
    });
  });
}

test('the home page with a card focused has no axe violation', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
  await expect(page.locator('section.row[data-arrows]').first()).toBeAttached();
  // Tab for real until a card's flip button has focus, as a keyboard user
  // would.
  for (let press = 0; press < 30; press += 1) {
    await page.keyboard.press('Tab');
    const onCard = await page.evaluate(
      () => document.activeElement?.matches('.card-flip') ?? false,
    );
    if (onCard) break;
  }
  await expect(page.locator('.card-flip:focus')).toHaveCount(1);
  await audit(page, 'home with a card focused');
});

test('the home page with a best card hovered, its foil moved and the card tilted, has no axe violation', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/');
  await expect(page.locator('section.row[data-arrows]').first()).toBeAttached();
  const card = page.locator('li.card[data-best]').first();
  await card.scrollIntoViewIfNeeded();
  const box = await card.boundingBox();
  if (box === null) throw new Error('the card is not drawn');
  await page.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.3, {
    steps: 4,
  });
  await expect
    .poll(() =>
      card.evaluate((el: HTMLElement) => el.style.getPropertyValue('--tilt-y')),
    )
    .toMatch(/deg$/);
  await audit(page, 'home with a best card hovered');
});

test('the home page with a card flipped has no axe violation', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
  await expect(page.locator('section.row[data-arrows]').first()).toBeAttached();
  // Flipped by a real Tab and Enter, so that focus is on its Play link.
  for (let press = 0; press < 30; press += 1) {
    await page.keyboard.press('Tab');
    const onCard = await page.evaluate(
      () => document.activeElement?.matches('.card-flip') ?? false,
    );
    if (onCard) break;
  }
  await page.keyboard.press('Enter');
  await expect(page.locator('li.card[data-flipped]')).toHaveCount(1);
  await expect(page.locator('li.card[data-flipped] .card-link')).toBeFocused();
  await page.evaluate(() =>
    Promise.all(
      document.getAnimations().map((each) => each.finished.catch(() => null)),
    ),
  );
  await audit(page, 'home with a card flipped');
});

test('the home page with a card’s loop playing and its Pause button focused has no axe violation', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/');
  const card = await settleOnFirstRow(page);
  await card.locator('button.card-flip').focus();
  await page.keyboard.press('Tab');
  await expect(card.locator('button.card-pause')).toBeFocused();
  await expect(card.locator('video')).toHaveCount(1);
  await audit(page, 'home with a card loop playing');
});

test('the home page has no axe violation once the late rows have loaded', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
  await expect(page.locator('section.row[data-arrows]').first()).toBeAttached();
  // Scroll down through every row, as a reader does, and wait for every
  // picture to come. A jump straight to the foot passes the middle rows by,
  // and their pictures are rightly never asked for.
  for (const row of await page.locator('section.row').all()) {
    await row.scrollIntoViewIfNeeded();
    await expect(row.locator('img[data-src]')).toHaveCount(0);
  }
  await expect(page.locator('section.row img[data-src]')).toHaveCount(0);
  await page.waitForFunction(() =>
    // The pictures of a feature candidate that is hidden are never fetched.
    [...document.images]
      .filter((img) => img.closest('[hidden]') === null)
      .every((img) => img.complete && img.naturalWidth > 0),
  );
  await audit(page, 'home with the late rows loaded');
});

// Where the browser cannot run WebGPU (stood in: no adapter) eight cards, and
// the feature's panel on its days, carry a line that says so; it must break no
// rule, at a desk and on a phone, with one of the cards flipped.
for (const width of WIDTHS) {
  test(`the home page with the WebGPU line drawn has no axe violation at ${width}`, async ({
    page,
  }) => {
    await page.addInitScript(() => Reflect.set(window, '__gpu', 'null'));
    await page.setViewportSize({ width, height: width > 800 ? 1000 : 844 });
    await page.goto('/');
    await expect(
      page.locator('section.row[data-arrows]').first(),
    ).toBeAttached();
    await expect(page.locator('html')).toHaveAttribute('data-webgpu', 'lacks');
    // The lines are drawn: one on each of eight fronts and eight backs.
    await expect(page.locator('.card-webgpu')).toHaveCount(8 + 8 + 2);
    await audit(page, `home with the WebGPU line at ${width}`);
    // And with one flipped, so that a back's line is in the tree.
    const card = page.locator('li.card[data-requires~="webgpu"]').first();
    await card.scrollIntoViewIfNeeded();
    await card.locator('button.card-flip').click();
    await expect(card).toHaveAttribute('data-flipped', '');
    await page.evaluate(() =>
      Promise.all(
        document.getAnimations().map((each) => each.finished.catch(() => null)),
      ),
    );
    await audit(page, `home with the WebGPU line, flipped, at ${width}`);
  });
}
