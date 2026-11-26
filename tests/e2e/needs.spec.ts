// Holds what a card says of what its site needs and how a touch screen is
// served: the words on every card's back (and so on a phone's sheet) and in the
// feature's panel; the same words on a card's front, under its title, only
// where nothing points finely (a touch screen) and only for a site a phone
// cannot play; and each row's cards that play by touch first on such a screen,
// before the page's module has run (held with the module blocked), while a
// desk, a phone with a mouse and a page with script off keep the order of
// src/content/catalogue.json. What each site needs is read from its entry's
// YAML here, as the build reads it, and the words and the order are asked of
// src/catalogue/fitting.ts, so that the page is held to the rule and not to a
// copy of its output. Each test counts what it reached, so that reading nothing
// is a failure. Without it a card could send a visitor somewhere their device
// cannot play, or the touch order could depend on script that is slow.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, type Page } from '@playwright/test';
import { test } from '../clock';
import {
  fitsTouch,
  needsWords,
  touchFirst,
  type Need,
} from '../../src/catalogue/fitting';
import { readRows } from './catalogue';

const catalogue = readRows();

const PHONE = { isMobile: true, hasTouch: true } as const;

/**
 * What an entry's YAML says it needs: undefined where it says nothing (a site
 * in the workshop), else the list. Reads `needs: []`, `needs: [a, b]` and a
 * block list under `needs:`.
 */
function needsOf(id: string): Need[] | undefined {
  const lines = readFileSync(
    resolve(import.meta.dirname, `../../src/content/entries/${id}.yaml`),
    'utf8',
  ).split('\n');
  const at = lines.findIndex((line) => /^needs:/.test(line));
  if (at < 0) return undefined;
  const inline = (lines[at] ?? '').replace(/^needs:\s*/, '').trim();
  if (inline.startsWith('['))
    return inline
      .slice(1, -1)
      .split(',')
      .map((each) => each.trim())
      .filter((each) => each !== '') as Need[];
  const listed: Need[] = [];
  for (const line of lines.slice(at + 1)) {
    const item = /^\s+-\s+(\S+)/.exec(line);
    if (item === null) break;
    listed.push(item[1] as Need);
  }
  return listed;
}

/** Whether an entry's card carries data-touch: it says needs and needs nothing. */
const touchy = (id: string): boolean => {
  const needs = needsOf(id);
  return needs !== undefined && fitsTouch(needs);
};

/** The ids of a row's cards as the page draws them now. */
const drawn = (page: Page, row: string): Promise<string[]> =>
  page
    .locator(`section[id="${row}"] li.card`)
    .evaluateAll((cards) =>
      cards.map((card) => (card as HTMLElement).dataset.entry ?? ''),
    );

/** The order of a row under the touch-first rule, from the catalogue. */
const touchOrder = (entries: string[]): string[] =>
  touchFirst(entries.map(touchy)).map((at) => entries[at] ?? '');

/** The page, with its script run. */
async function ready(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.locator('section.row[data-arrows]').first()).toBeAttached();
}

/** Every row's drawn order is `expected(entries)`; returns how many rows were read. */
async function rowsAre(
  page: Page,
  expected: (entries: string[]) => string[],
): Promise<number> {
  let reached = 0;
  for (const row of catalogue.rows) {
    expect(await drawn(page, row.id), row.id).toEqual(expected(row.entries));
    reached += 1;
  }
  return reached;
}

const inCatalogueOrder = (entries: string[]): string[] => entries;

test.describe('at a desk', () => {
  test.use({ viewport: { width: 1440, height: 1000 } });

  test('every card’s back says its needs words, and no front shows them', async ({
    page,
  }) => {
    await ready(page);
    let backs = 0;
    let fronts = 0;
    for (const row of catalogue.rows) {
      for (const id of row.entries) {
        const needs = needsOf(id);
        const card = page.locator(`li.card[data-entry="${id}"]`);
        if (needs === undefined) {
          await expect(card.locator('.card-needs')).toHaveCount(0);
          continue;
        }
        await expect(card.locator('.face.back .card-needs'), id).toHaveText(
          needsWords(needs),
        );
        backs += 1;
        // Not drawn at a desk, whether the card plays by touch or not.
        for (const front of await card
          .locator('.face.front .card-needs')
          .all()) {
          await expect(front, id).toBeHidden();
          fronts += 1;
        }
        // A card plays by touch exactly where it carries data-touch.
        await expect(card.locator('.face.front .card-needs')).toHaveCount(
          touchy(id) ? 0 : 1,
        );
      }
    }
    expect(backs).toBeGreaterThan(0);
    expect(fronts).toBeGreaterThan(0);
  });

  test('a flipped card shows its words', async ({ page }) => {
    await ready(page);
    let reached = 0;
    for (const row of catalogue.rows) {
      const id = row.entries.find((each) => needsOf(each) !== undefined);
      if (id === undefined) continue;
      const card = page.locator(`li.card[data-entry="${id}"]`);
      await card.scrollIntoViewIfNeeded();
      await card.locator('button.card-flip').click();
      await expect(card).toHaveAttribute('data-flipped', '');
      await expect(card.locator('.face.back .card-needs')).toBeVisible();
      await expect(card.locator('.face.back .card-needs')).toHaveText(
        needsWords(needsOf(id) ?? []),
      );
      await card.locator('button.card-unflip').click();
      reached += 1;
    }
    expect(reached).toBeGreaterThan(0);
  });

  test('rows keep the catalogue’s order', async ({ page }) => {
    await ready(page);
    expect(await rowsAre(page, inCatalogueOrder)).toBe(catalogue.rows.length);
  });

  test('the feature’s panel says its needs words', async ({ page }) => {
    await ready(page);
    const needs = needsOf(catalogue.feature);
    // The clock is held on day 0, whose feature is the first candidate.
    const words = page.locator('section.feature:not([hidden]) .card-needs');
    if (needs === undefined) {
      await expect(words).toHaveCount(0);
      return;
    }
    await expect(words).toHaveCount(1);
    await expect(words).toHaveText(needsWords(needs));
    await expect(words).toBeVisible();
  });
});

test.describe('a phone with a mouse (a narrow window, a mouse pointing)', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('keeps the catalogue’s order and draws no front line', async ({
    page,
  }) => {
    await ready(page);
    expect(
      await page.evaluate(() => matchMedia('(any-pointer: fine)').matches),
    ).toBe(true);
    expect(await rowsAre(page, inCatalogueOrder)).toBe(catalogue.rows.length);
    const fronts = page.locator('.face.front .card-needs');
    const count = await fronts.count();
    expect(count).toBeGreaterThan(0);
    for (const front of await fronts.all()) await expect(front).toBeHidden();
  });
});

test.describe('a touch phone', () => {
  test.use({ ...PHONE, viewport: { width: 390, height: 844 } });

  test('says nothing of a mouse: coarse and not fine', async ({ page }) => {
    await ready(page);
    expect(
      await page.evaluate(() => ({
        coarse: matchMedia('(any-pointer: coarse)').matches,
        fine: matchMedia('(any-pointer: fine)').matches,
      })),
    ).toEqual({ coarse: true, fine: false });
  });

  test('draws a front line exactly on the cards that do not play by touch', async ({
    page,
  }) => {
    await ready(page);
    let shown = 0;
    let none = 0;
    for (const row of catalogue.rows) {
      for (const id of row.entries) {
        const needs = needsOf(id);
        if (needs === undefined) continue;
        const card = page.locator(`li.card[data-entry="${id}"]`);
        const front = card.locator('.face.front .card-needs');
        if (touchy(id)) {
          await expect(card, id).toHaveAttribute('data-touch', '');
          await expect(front, id).toHaveCount(0);
          none += 1;
        } else {
          await expect(card, id).not.toHaveAttribute('data-touch', /.*/);
          await expect(front, id).toHaveText(needsWords(needs));
          await expect(front, id).toBeVisible();
          shown += 1;
        }
      }
    }
    expect(shown).toBeGreaterThan(0);
    expect(none).toBeGreaterThan(0);
  });

  test('a front line is the ink of the tile, as the title is', async ({
    page,
  }) => {
    await ready(page);
    const found = await page.evaluate(() => {
      const pairs = [...document.querySelectorAll('.card[data-flips]')].flatMap(
        (card) => {
          const line = card.querySelector('.front .card-needs');
          const title = card.querySelector('.front .card-title');
          return line === null || title === null
            ? []
            : [[getComputedStyle(line).color, getComputedStyle(title).color]];
        },
      );
      return pairs;
    });
    expect(found.length).toBeGreaterThan(0);
    for (const [line, title] of found) expect(line).toBe(title);
  });

  test('every row is touch-first, each group in the catalogue’s order', async ({
    page,
  }) => {
    await ready(page);
    expect(await rowsAre(page, touchOrder)).toBe(catalogue.rows.length);
    // The rule moved something somewhere, or this proves nothing.
    expect(
      catalogue.rows.some(
        (row) =>
          touchOrder(row.entries).join() !==
          inCatalogueOrder(row.entries).join(),
      ),
    ).toBe(true);
  });

  test('is touch-first with the page’s module blocked, so the script alone does it', async ({
    page,
  }) => {
    let blocked = 0;
    await page.route('**/_astro/*.js', (route) => {
      blocked += 1;
      return route.abort();
    });
    await page.goto('/');
    await expect(page.locator('li.card').first()).toBeAttached();
    await page.waitForLoadState('load');
    expect(blocked).toBeGreaterThan(0);
    await expect(page.locator('section.row[data-arrows]')).toHaveCount(0);
    expect(await rowsAre(page, touchOrder)).toBe(catalogue.rows.length);
  });

  test('a tap opens the sheet, which says the needs words', async ({
    page,
  }) => {
    await ready(page);
    let reached = 0;
    for (const row of catalogue.rows.slice(0, 2)) {
      const id = row.entries.find((each) => needsOf(each) !== undefined);
      if (id === undefined) continue;
      const card = page.locator(`li.card[data-entry="${id}"]`);
      await card.scrollIntoViewIfNeeded();
      await card.locator('button.card-flip').tap();
      await expect(card).toHaveAttribute('data-flipped', '');
      const words = card.locator('.face.back .card-needs');
      await expect(words).toBeVisible();
      await expect(words).toHaveText(needsWords(needsOf(id) ?? []));
      // The sheet is fixed to the foot of the window and the line is inside it,
      // once the sheet has risen (it slides up, so a reading straight after
      // the tap finds it below the window).
      await expect
        .poll(
          () =>
            words.evaluate((el) => {
              const box = el.getBoundingClientRect();
              return box.bottom <= innerHeight + 1 && box.top >= 0;
            }),
          { message: `${id}: the line is in the window` },
        )
        .toBe(true);
      await card.locator('button.card-unflip').tap();
      reached += 1;
    }
    expect(reached).toBeGreaterThan(0);
  });

  test('the feature’s panel says its words here too', async ({ page }) => {
    await ready(page);
    const needs = needsOf(catalogue.feature);
    const words = page.locator('section.feature:not([hidden]) .card-needs');
    if (needs === undefined) {
      await expect(words).toHaveCount(0);
      return;
    }
    await expect(words).toHaveText(needsWords(needs));
  });
});

test.describe('with script off', () => {
  test.describe('on a touch phone', () => {
    test.use({
      ...PHONE,
      viewport: { width: 390, height: 844 },
      javaScriptEnabled: false,
    });

    test('keeps the catalogue’s order and still draws the front line', async ({
      page,
    }) => {
      await page.goto('/');
      await expect(page.locator('li.card').first()).toBeAttached();
      expect(await rowsAre(page, inCatalogueOrder)).toBe(catalogue.rows.length);
      let shown = 0;
      for (const row of catalogue.rows) {
        for (const id of row.entries) {
          const needs = needsOf(id);
          if (needs === undefined || touchy(id)) continue;
          await expect(
            page.locator(`li.card[data-entry="${id}"] .face.front .card-needs`),
            id,
          ).toBeVisible();
          shown += 1;
        }
      }
      expect(shown).toBeGreaterThan(0);
    });
  });

  test.describe('at a desk', () => {
    test.use({
      viewport: { width: 1440, height: 1000 },
      javaScriptEnabled: false,
    });

    test('keeps the catalogue’s order and says the words once on the back', async ({
      page,
    }) => {
      await page.goto('/');
      await expect(page.locator('li.card').first()).toBeAttached();
      expect(await rowsAre(page, inCatalogueOrder)).toBe(catalogue.rows.length);
      let reached = 0;
      for (const row of catalogue.rows) {
        for (const id of row.entries) {
          const needs = needsOf(id);
          if (needs === undefined) continue;
          await expect(
            page.locator(`li.card[data-entry="${id}"] .face.back .card-needs`),
          ).toHaveText(needsWords(needs));
          reached += 1;
        }
      }
      expect(reached).toBeGreaterThan(0);
    });
  });
});
