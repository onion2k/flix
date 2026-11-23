// Holds where a row's strip comes to rest against its edge arrows: an arrow
// stands over the card cut off at the strip's edge, and never over a card the
// strip has come to rest with wholly in the window, since that is a card a
// reader presses and reads, and once it is flipped its back's words lie where
// its picture was. On a phone the strip's gutter was narrower than an arrow,
// and a press of Next left each card it came to with its left 38px under
// Previous (at a desk, 4px); under reduced motion a press was an instant jump
// that the strip's snap did not pull to a card, so it rested between two, one
// under each arrow. Each row is pressed along to its end and back with real
// clicks, and sent by a swipe's worth of scroll to places between its cards on
// a touch screen, with motion allowed and under reduced motion, and at every
// rest each card wholly in the window is held clear of each arrow showing,
// and the lit mark and the words name the stop the strip is at (worked out in
// arrows.ts from the strip's widths, not from the rule under test).
//
// The widths are a desk's, 1920, each side of 64rem, each side of the bands
// named in CLAUDE.md (where a strip's very start or end leaves a card wholly in
// with an edge under an arrow, which no resting place can mend), each side of
// the phone's step at 40rem, a phone's and 341. No scrollbar takes room here,
// as on a phone or a Mac: rows.spec.ts is the file that draws one. Waits are on
// a state reached (a scroll end, a strip at rest), never on a time.
import { expect, type Locator, type Page } from '@playwright/test';
import { test } from '../clock';
import { cardsUnderArrows, pageOf, pagesOf } from './arrows';
import { readRows } from './catalogue';
import { atRest, untilScrolled } from './scrolling';

const catalogue = readRows();

// Each test presses every row along and back, and with motion allowed waits
// out each glide, so the file's tests are many and slow. They share nothing,
// and run side by side: one after another in a single worker they took two
// minutes, side by side 22 seconds.
test.describe.configure({ mode: 'parallel' });

const section = (page: Page, id: string): Locator =>
  page.locator(`section[id="${id}"]`);
const strip = (page: Page, id: string): Locator =>
  section(page, id).getByRole('list');
const previous = (page: Page, id: string): Locator =>
  section(page, id).getByRole('button', { name: /^Previous/ });
const next = (page: Page, id: string): Locator =>
  section(page, id).getByRole('button', { name: /^Next/ });

const overflows = (list: Locator): Promise<boolean> =>
  list.evaluate((el) => el.scrollWidth - el.clientWidth > 1);

/** Script has run: every row has been given its arrows. */
async function ready(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.locator('section.row[data-arrows]').first()).toBeAttached();
}

/** The lit mark and the words say the stop the strip is at. */
async function saysWhere(
  page: Page,
  row: { id: string; title: string },
  pages: number,
): Promise<number> {
  const at = await pageOf(strip(page, row.id));
  const lit = section(page, row.id).locator('.row-pages [data-current]');
  await expect(lit).toHaveCount(1);
  await expect(
    section(page, row.id).locator('.row-pages .page-mark').nth(at),
  ).toHaveAttribute('data-current', '');
  await expect(section(page, row.id).locator('[data-page-words]')).toHaveText(
    `Page ${at + 1} of ${pages}, ${row.title}`,
  );
  return at;
}

const WIDTHS = [1920, 1440, 1025, 1023, 955, 715, 645, 641, 640, 390, 341];

test.describe('where an arrow press leaves a strip', () => {
  for (const motion of ['no-preference', 'reduce'] as const)
    for (const width of WIDTHS) {
      test(`at ${width} wide, motion ${motion}: no card wholly in the window is under an arrow, and the mark says where`, async ({
        page,
      }) => {
        await page.setViewportSize({ width, height: 844 });
        await page.emulateMedia({ reducedMotion: motion });
        await ready(page);
        let presses = 0;
        let cards = 0;
        let ends = 0;
        for (const each of catalogue.rows) {
          const list = strip(page, each.id);
          if (!(await overflows(list))) continue;
          await list.scrollIntoViewIfNeeded();
          const pages = await pagesOf(list);
          for (const [arrow, end] of [
            [next, pages - 1],
            [previous, 0],
          ] as const) {
            const button = arrow(page, each.id);
            let last = await pageOf(list);
            for (let press = 0; (await button.count()) > 0; press += 1) {
              expect(
                press,
                `${each.id} reaches its end in fewer presses than it has stops`,
              ).toBeLessThan(pages);
              await untilScrolled(list, () => button.click());
              await atRest(list);
              presses += 1;
              const found = await cardsUnderArrows(section(page, each.id));
              const scrolled = await list.evaluate((el) => el.scrollLeft);
              expect(
                found.under,
                `${each.id}, press ${press + 1}, at ${scrolled}`,
              ).toEqual([]);
              cards += found.seen;
              const at = await saysWhere(page, each, pages);
              expect(at, `${each.id} moved a stop with a press`).not.toBe(last);
              last = at;
            }
            expect(last, `${each.id} reached its end`).toBe(end);
            ends += 1;
          }
        }
        expect(ends, 'ends reached').toBeGreaterThan(1);
        expect(presses, 'presses').toBeGreaterThan(1);
        expect(cards, 'cards wholly in the window').toBeGreaterThan(0);
      });
    }
});

// A finger moves a strip by itself and leaves it wherever the swipe ran out;
// the strip's snap is what brings it to rest. Each row is sent, as a swipe
// leaves it, to places between its cards' starts, and once it is at rest no
// card wholly in the window is under an arrow.
test.describe('where a swipe leaves a strip, on a touch screen', () => {
  test.use({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });

  for (const motion of ['no-preference', 'reduce'] as const)
    test(`motion ${motion}: at rest, no card wholly in the window is under an arrow`, async ({
      page,
    }) => {
      await page.emulateMedia({ reducedMotion: motion });
      await ready(page);
      let rests = 0;
      let cards = 0;
      for (const each of catalogue.rows) {
        const list = strip(page, each.id);
        if (!(await overflows(list))) continue;
        await list.scrollIntoViewIfNeeded();
        const pages = await pagesOf(list);
        const room = await list.evaluate(
          (el) => el.scrollWidth - el.clientWidth,
        );
        for (const share of [0.13, 0.31, 0.47, 0.62, 0.88]) {
          const to = Math.round(room * share);
          await list.evaluate(
            (el, left) => el.scrollTo({ left, behavior: 'instant' }),
            to,
          );
          await atRest(list);
          rests += 1;
          const found = await cardsUnderArrows(section(page, each.id));
          expect(found.under, `${each.id}, sent to ${to}`).toEqual([]);
          cards += found.seen;
          await saysWhere(page, each, pages);
        }
      }
      expect(rests, 'rests').toBeGreaterThan(4);
      expect(cards, 'cards wholly in the window').toBeGreaterThan(0);
    });
});
