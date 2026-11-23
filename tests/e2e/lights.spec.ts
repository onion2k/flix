// Holds part 1 of plans/effects.md, "house lights": while a card is hovered
// with a mouse, or one of its controls holds keyboard focus, the pictures of
// the other cards in the same row dim, and nothing else does. The hovered or
// focused card's own picture, every picture in another row or in the feature,
// and every card's words stay as they were, so that text contrast is not
// touched. Every card is a control once script has run, since every card
// flips, so a card with no link lights its row like the rest (with script off
// it is not a control, and nothing here runs). Hover is for a mouse only: a
// tap on a touch screen leaves a stuck hover, and that dims nothing. The dim is a state, so it stays under reduced motion, where
// only its ease is gone. Without this a rule that dimmed the whole card (its
// words with it), the card that is the one pointed at, a stuck touch hover or
// an ease outside the no-preference block would pass every other test, since
// none of them hovers a card and looks at its neighbours. Each test counts
// what it reached and waits on a state, never on a time: an ease is waited
// out by asking the document for its running animations.
import { expect, type Locator, type Page } from '@playwright/test';
import { test } from '../clock';

test.use({ viewport: { width: 1440, height: 1000 } });

/** The pictures of a row's cards, which is where the dim is drawn. */
const PICTURE = '.frame img';

/** The amount the token gives, as the computed filter says it. */
async function dimmed(page: Page): Promise<string> {
  const amount = await page.evaluate(() =>
    getComputedStyle(document.documentElement)
      .getPropertyValue('--brightness-dim')
      .trim(),
  );
  const number = Number(amount);
  // A token missing, or one that dims to nothing or to black, is a fault.
  expect(number, 'the dim token').toBeGreaterThan(0.3);
  expect(number, 'the dim token').toBeLessThan(0.8);
  // The computed filter writes the number as the browser does, so it is read
  // as a number and written again, not copied as the token spells it.
  return `brightness(${number})`;
}

/** Two frames drawn and no transition or animation still running. */
async function quiet(page: Page): Promise<void> {
  await page.waitForFunction(
    () =>
      new Promise<boolean>((done) =>
        requestAnimationFrame(() =>
          requestAnimationFrame(() =>
            done(document.getAnimations().length === 0),
          ),
        ),
      ),
  );
}

/** The page has loaded and script has run (the rows have been given their arrows). */
async function ready(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.locator('section.row[data-arrows]').first()).toBeAttached();
}

/** The computed filter of every picture in a card, as a list. */
function filtersOf(card: Locator): Promise<string[]> {
  return card
    .locator(PICTURE)
    .evaluateAll((all) => all.map((el) => getComputedStyle(el).filter));
}

async function centre(card: Locator): Promise<{ x: number; y: number }> {
  await card.scrollIntoViewIfNeeded();
  const box = await card.boundingBox();
  expect(box, 'the card is drawn').not.toBeNull();
  return {
    x: (box?.x ?? 0) + (box?.width ?? 0) / 2,
    y: (box?.y ?? 0) + (box?.height ?? 0) / 2,
  };
}

/**
 * Says what is dimmed and what is not, by each card's picture: the cards of
 * `row` other than `lit` are all `filter`, `lit` is none, and no other card
 * in the page, nor the feature's picture, has any filter. Returns how many
 * pictures it checked, so that a test can say it reached some.
 */
async function expectLights(
  page: Page,
  row: Locator,
  lit: Locator,
  filter: string,
): Promise<number> {
  const cards = row.locator('.card');
  const total = await cards.count();
  expect(total, 'cards in the row').toBeGreaterThan(2);
  let checked = 0;
  for (let at = 0; at < total; at += 1) {
    const card = cards.nth(at);
    const isLit =
      (await card.evaluate(
        (el, other) => el === other,
        await lit.elementHandle(),
      )) === true;
    const expected = isLit ? 'none' : filter;
    // Waits out the ease: a picture still on its way is retried.
    await expect(card.locator(PICTURE).first()).toHaveCSS('filter', expected);
    const seen = await filtersOf(card);
    expect(seen.length, 'pictures in a card').toBeGreaterThan(0);
    expect(seen, `card ${at} (lit: ${isLit})`).toEqual(
      seen.map(() => expected),
    );
    checked += seen.length;
  }
  // Everything that is not in the row: the other rows' cards and the feature.
  const outside = await page.evaluate(
    (rowId) => {
      const own = document.getElementById(rowId ?? '');
      return [...document.querySelectorAll('img')]
        .filter((img) => own === null || !own.contains(img))
        .filter((img) => !img.closest('noscript'))
        .map((img) => getComputedStyle(img).filter);
    },
    await row.getAttribute('id'),
  );
  expect(outside.length, 'pictures outside the row').toBeGreaterThan(10);
  expect(outside.filter((each) => each !== 'none')).toEqual([]);
  return checked + outside.length;
}

test('hovering a linked card with a mouse dims the other pictures in its row and no others', async ({
  page,
}) => {
  await ready(page);
  const row = page.locator('section.row').first();
  const lit = row.locator('.card').nth(1);
  await expect(lit).toHaveAttribute('data-linked', '');
  const filter = await dimmed(page);
  const point = await centre(lit);
  await page.mouse.move(point.x, point.y);
  const checked = await expectLights(page, row, lit, filter);
  expect(checked, 'pictures checked').toBeGreaterThan(15);
  test.info().annotations.push({
    type: 'measured',
    description: `${checked} pictures checked while hovered`,
  });

  // Off the row: nothing is dimmed, anywhere.
  await page.mouse.move(2, 2);
  // Waits on the state, since a hover ends a frame after the mouse moves and
  // the ease out then takes its time.
  await expect(row.locator(PICTURE).nth(0)).toHaveCSS('filter', 'none');
  await quiet(page);
  const all = await page.evaluate(() =>
    [...document.querySelectorAll('img')].map(
      (img) => getComputedStyle(img).filter,
    ),
  );
  expect(all.length, 'pictures read').toBeGreaterThan(15);
  expect(all.filter((each) => each !== 'none')).toEqual([]);
});

test('the words of a dimmed card are as they were', async ({ page }) => {
  await ready(page);
  const row = page.locator('section.row').first();
  const words = async () =>
    row.locator('.card').evaluateAll((cards) =>
      cards.flatMap((card) =>
        [
          card,
          ...card.querySelectorAll(
            '.label, .card-title, .description, .card-link, .card-unflip',
          ),
        ].map((el) => {
          const style = getComputedStyle(el);
          return `${el.className || el.tagName} ${style.color} ${style.opacity} ${style.filter}`;
        }),
      ),
    );
  await page.mouse.move(2, 2);
  const before = await words();
  expect(before.length, 'elements of words read').toBeGreaterThan(30);
  const lit = row.locator('.card').nth(1);
  const point = await centre(lit);
  await page.mouse.move(point.x, point.y);
  await expectLights(page, row, lit, await dimmed(page));
  expect(await words()).toEqual(before);
});

test('Tab to a card’s flip button dims the other pictures in its row and no others', async ({
  page,
}) => {
  await ready(page);
  const row = page.locator('section.row').first();
  const lit = row.locator('.card').nth(1);
  for (let press = 0; press < 40; press += 1) {
    await page.keyboard.press('Tab');
    if ((await lit.locator('.card-flip:focus-visible').count()) > 0) break;
  }
  await expect(lit.locator('.card-flip:focus-visible')).toHaveCount(1);
  // The mouse is nowhere near: this is focus alone.
  expect(await page.locator('.card:hover').count()).toBe(0);
  const checked = await expectLights(page, row, lit, await dimmed(page));
  expect(checked, 'pictures checked').toBeGreaterThan(15);
  test.info().annotations.push({
    type: 'measured',
    description: `${checked} pictures checked while focused`,
  });

  // Tab on: the next card's flip button is the lit one.
  await page.keyboard.press('Tab');
  await expectLights(
    page,
    row,
    row.locator('.card').nth(2),
    await dimmed(page),
  );

  // Flipped by Enter, focus is on its Play link, inside it: it stays lit.
  await page.keyboard.press('Enter');
  await expect(row.locator('.card').nth(2)).toHaveAttribute('data-flipped', '');
  await expect(
    row.locator('.card').nth(2).locator('.card-link:focus-visible'),
  ).toHaveCount(1);
  await expectLights(
    page,
    row,
    row.locator('.card').nth(2),
    await dimmed(page),
  );
});

test('an unlinked card flips, so it is a control: hovering it dims the others, and it dims with the rest', async ({
  page,
}) => {
  await ready(page);
  // No row of the catalogue mixes linked and unlinked cards (the last row is
  // all unlinked), so a mixed row is made in the page: the third card of the
  // first row loses its link and its mark, as an entry with no address has.
  const row = page.locator('section.row').first();
  const bare = row.locator('.card').nth(2);
  const linked = row.locator('.card').nth(1);
  await bare.evaluate((card) => {
    card.removeAttribute('data-linked');
    card.querySelector('.card-link')?.remove();
  });
  await expect(bare.locator('.card-link')).toHaveCount(0);
  await expect(bare).toHaveAttribute('data-flips', '');
  const filter = await dimmed(page);

  // Hovering the unlinked card: the others dim, as for any card.
  const barePoint = await centre(bare);
  await page.mouse.move(barePoint.x, barePoint.y);
  await expectLights(page, row, bare, filter);

  // Hovering a linked card beside it: the unlinked card's picture dims too.
  const point = await centre(linked);
  await page.mouse.move(point.x, point.y);
  await expect(bare.locator(PICTURE).first()).toHaveCSS('filter', filter);
  await expect(linked.locator(PICTURE).first()).toHaveCSS('filter', 'none');
});

test('under reduced motion the dim still applies, with no ease', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await ready(page);
  const row = page.locator('section.row').first();
  const lit = row.locator('.card').nth(1);
  const other = row.locator('.card').nth(2).locator(PICTURE).first();
  const point = await centre(lit);
  await page.mouse.move(point.x, point.y);
  await expectLights(page, row, lit, await dimmed(page));
  expect(
    await other.evaluate((el) => getComputedStyle(el).transitionDuration),
  ).toBe('0s');
});

test('with no preference the dim eases, so that the check above is not vacuous', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await ready(page);
  const picture = page
    .locator('section.row')
    .first()
    .locator('.card')
    .nth(2)
    .locator(PICTURE)
    .first();
  const properties = await picture.evaluate(
    (el) => getComputedStyle(el).transitionProperty,
  );
  expect(properties.split(',').map((each) => each.trim())).toContain('filter');
  // The zoom's ease was there first and is kept beside it.
  expect(properties.split(',').map((each) => each.trim())).toContain(
    'transform',
  );
});

test.describe('on a touch screen', () => {
  test.use({
    hasTouch: true,
    isMobile: true,
    viewport: { width: 390, height: 844 },
  });

  test('a tap on a card dims nothing', async ({ page }) => {
    await ready(page);
    // What was emulated: Chromium's mobile emulation (isMobile with touch),
    // which reports a device that cannot hover. Playwright has no option for
    // the hover media feature on its own, so this is asserted and not set.
    expect(
      await page.evaluate(() => matchMedia('(hover: none)').matches),
      'the context cannot hover',
    ).toBe(true);
    expect(
      await page.evaluate(() => matchMedia('(hover: hover)').matches),
    ).toBe(false);
    const row = page.locator('section.row').first();
    const card = row.locator('.card').first();
    await card.scrollIntoViewIfNeeded();
    const box = await card.boundingBox();
    expect(box).not.toBeNull();
    // Taps the picture, which flips the card and opens nothing; the click is
    // stopped from going further all the same, since only the hover state
    // (and the focus the flip moves, which a tap does not make visible) is
    // looked at.
    await page.evaluate(() =>
      document.addEventListener(
        'click',
        (event) => event.preventDefault(),
        true,
      ),
    );
    await page.touchscreen.tap(
      (box?.x ?? 0) + (box?.width ?? 0) / 2,
      (box?.y ?? 0) + 20,
    );
    // The tap must have left a hover, or there is nothing here to refuse.
    const stuck = await card.evaluate((el) => el.matches(':hover'));
    test.info().annotations.push({
      type: 'measured',
      description: `a tap left :hover on the card: ${stuck}`,
    });
    await quiet(page);
    const filters = await page.evaluate(() =>
      [...document.querySelectorAll('img')].map(
        (img) => getComputedStyle(img).filter,
      ),
    );
    expect(filters.length, 'pictures read').toBeGreaterThan(15);
    expect(filters.filter((each) => each !== 'none')).toEqual([]);
  });
});
