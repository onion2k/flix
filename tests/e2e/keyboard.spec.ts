// Holds the page to being worked by keyboard alone, with real Tab presses:
// the skip link is the first stop, visible, and takes focus into main; then
// every link, button and strip in reading order, each one inside the window,
// ringed by an outline of at least 2px, and not covered by anything else.
// Every visible link and button is also at least 44 by 44 (a card's link by
// the card, its hit area; a link inside a paragraph of running text in main
// is exempt, see below). The home page and the privacy page are both walked,
// the footer included. Without it a ring
// lost in a stylesheet, a control under another, or a target too small would
// pass every other check, since none of them presses Tab.
import { expect, type Page } from '@playwright/test';
import { test } from '../clock';

const WIDTHS = [1440, 390];
const PAGES = [
  { name: 'the home page', path: '/', skip: 'Skip to the games' },
  { name: 'the privacy page', path: '/privacy/', skip: 'Skip to the content' },
];

interface Stop {
  tag: string;
  name: string;
}

/** What each press of Tab should land on, in reading order, from the DOM. */
async function tabbable(page: Page): Promise<Stop[]> {
  return page.evaluate(() => {
    const visible = (el: Element) => {
      const box = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      return box.width > 0 && box.height > 0 && style.visibility !== 'hidden';
    };
    return [
      ...document.querySelectorAll<HTMLElement>(
        'a[href], button, [tabindex="0"]',
      ),
    ]
      .filter(visible)
      .map((el) => ({
        tag: el.tagName.toLowerCase(),
        name: (el.getAttribute('aria-label') ?? el.textContent ?? '')
          .trim()
          .slice(0, 60),
      }));
  });
}

function active(page: Page) {
  return page.evaluate(() => {
    const el = document.activeElement;
    if (el === null) return null;
    const box = el.getBoundingClientRect();
    const style = getComputedStyle(el);
    const hit = document.elementFromPoint(
      box.left + box.width / 2,
      box.top + box.height / 2,
    );
    // A card's link keeps a transparent outline of its own and the ring is
    // drawn round the whole card, so the ring that is seen is the first
    // outline, on the element or on its card, whose colour is not clear.
    const seen = [el, el.closest('li')]
      .filter((each): each is Element => each !== null)
      .map((each) => getComputedStyle(each))
      .find(
        (each) =>
          each.outlineStyle !== 'none' &&
          parseFloat(each.outlineWidth) >= 2 &&
          each.outlineColor !== 'rgba(0, 0, 0, 0)',
      );
    return {
      ringSeen: seen !== undefined,
      tag: el.tagName.toLowerCase(),
      name: (el.getAttribute('aria-label') ?? el.textContent ?? '')
        .trim()
        .slice(0, 60),
      inside:
        box.left >= -1 &&
        box.top >= -1 &&
        box.right <= window.innerWidth + 1 &&
        box.bottom <= window.innerHeight + 1,
      outlineStyle: style.outlineStyle,
      outlineWidth: parseFloat(style.outlineWidth),
      covered: hit === null || !(el.contains(hit) || hit.contains(el)),
    };
  });
}

for (const width of WIDTHS) {
  for (const { name: pageName, path, skip } of PAGES) {
    test.describe(`${pageName} at ${width} wide`, () => {
      test.use({ viewport: { width, height: width > 800 ? 1000 : 844 } });

      test.beforeEach(async ({ page }) => {
        await page.goto(path);
        // Script has run once the row buttons have taken their state; the
        // privacy page has no script and no row buttons.
        if (path === '/') {
          await expect(page.locator('[aria-disabled]').first()).toBeAttached();
          await expect(
            page.getByRole('button', { name: 'Surprise me' }),
          ).toBeVisible();
        }
      });

      test('the skip link is first, is seen, and takes focus into main', async ({
        page,
      }) => {
        await page.keyboard.press('Tab');
        const link = page.getByRole('link', { name: skip });
        await expect(link).toBeFocused();
        await expect(link).toBeInViewport({ ratio: 1 });
        await page.keyboard.press('Enter');
        await page.keyboard.press('Tab');
        const insideMain = await page.evaluate(
          () => document.activeElement?.closest('main') !== null,
        );
        expect(insideMain).toBe(true);
      });

      test('Tab reaches every link and button in order, each seen, ringed and uncovered', async ({
        page,
      }) => {
        const expected = await tabbable(page);
        expect(expected.length).toBeGreaterThan(3);
        expect(expected[0]?.name).toBe(skip);
        // The home page's header ends with the Surprise me button, after the
        // row links, so the walk below reaches it and checks its ring.
        const surprise = expected.findIndex((s) => s.name === 'Surprise me');
        if (path === '/') {
          expect(surprise).toBeGreaterThan(1);
          expect(expected[surprise]?.tag).toBe('button');
          expect(expected.slice(1, surprise).every((s) => s.tag === 'a')).toBe(
            true,
          );
        } else expect(surprise).toBe(-1);
        // The hero's Pause button is a stop of its own on the home page, the
        // very next after the feature's Play link, and so is walked below.
        if (path === '/') {
          const pause = expected.findIndex((s) =>
            /^Pause the .+ video$/.test(s.name),
          );
          expect(pause, 'the hero’s Pause button was read').toBeGreaterThan(0);
          expect(expected[pause]?.tag).toBe('button');
          expect(expected[pause - 1]?.tag).toBe('a');
          expect(expected[pause - 1]?.name).toMatch(/^Play /);
        }
        let reached = 0;
        for (const stop of expected) {
          await page.keyboard.press('Tab');
          // A strip scrolls a card in smoothly, so wait for it to be in.
          await expect
            .poll(async () => (await active(page))?.inside, {
              message: `${stop.name} is in the window`,
            })
            .toBe(true);
          const now = await active(page);
          expect(now?.tag).toBe(stop.tag);
          expect(now?.name).toBe(stop.name);
          expect(now?.outlineStyle).not.toBe('none');
          expect(now?.outlineWidth).toBeGreaterThanOrEqual(2);
          expect(now?.ringSeen, `${stop.name} has a ring that shows`).toBe(
            true,
          );
          expect(now?.covered).toBe(false);
          reached += 1;
        }
        expect(reached).toBe(expected.length);
      });

      test('every visible link and button is at least 44 by 44', async ({
        page,
      }) => {
        const targets = page.locator('a[href], button');
        const count = await targets.count();
        let measured = 0;
        let exempt = 0;
        for (let at = 0; at < count; at += 1) {
          const target = targets.nth(at);
          if (!(await target.isVisible())) continue;
          // WCAG 2.5.8 exempts a link that is inline in a sentence, since its
          // size is set by the text around it. That is a link inside a
          // paragraph of running text in main (the privacy page's outside
          // links) and nothing else: the footer's links are drawn in a
          // paragraph too, and are not exempt, so they are measured.
          if (
            (await target
              .locator('xpath=ancestor::p[ancestor::main]')
              .count()) > 0
          ) {
            exempt += 1;
            continue;
          }
          // A card's link is only its title in size, and is hit through a
          // stretched ::after over the whole card, so the card is the area it
          // can be hit in. Every other link and button is measured as drawn.
          const card = target.locator(
            'xpath=ancestor::li[contains(@class,"card")]',
          );
          const box = await (
            (await card.count()) > 0 ? card : target
          ).boundingBox();
          const name = (await target.textContent()) ?? '';
          expect(box?.width, `${name} is wide enough`).toBeGreaterThanOrEqual(
            44,
          );
          expect(box?.height, `${name} is tall enough`).toBeGreaterThanOrEqual(
            44,
          );
          measured += 1;
        }
        expect(measured).toBeGreaterThan(3);
        // The privacy page's text holds links; the exemption must be reached.
        if (path === '/privacy/') expect(exempt).toBeGreaterThan(0);
      });
    });
  }
}
