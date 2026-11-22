// Holds the page to being worked by keyboard alone, with real Tab presses:
// the skip link is the first stop, visible, and takes focus into main; then
// every link, button and strip in reading order, each one inside the window,
// ringed by an outline of at least 2px, and not covered by anything else.
// A row's edge arrows are stops where they are shown and not stops where they
// are hidden, ringed and uncovered, and 44 by 44 (see the last describe). Every
// visible link and button is also at least 44 by 44 (a card's link by
// the card, its hit area; a link inside a paragraph of running text in main
// is exempt, see below). The home page and the privacy page are both walked,
// the footer included. Without it a ring
// lost in a stylesheet, a control under another, or a target too small would
// pass every other check, since none of them presses Tab.
import { expect, type Page } from '@playwright/test';
import { test } from '../clock';
import { atRest } from './scrolling';
import { readRows } from './catalogue';

const catalogue = readRows();

const WIDTHS = [1440, 390];
const PAGES = [
  { name: 'the home page', path: '/', skip: 'Skip to the games' },
  { name: 'the privacy page', path: '/privacy/', skip: 'Skip to the content' },
];

interface Stop {
  tag: string;
  name: string;
  /** Whether focus is on it now. */
  focused: boolean;
}

/**
 * What a press of Tab can land on, in reading order, from the DOM as it is
 * now. A row's edge arrows are in it where they are shown, and a walk of a
 * row's cards moves the strip, which shows and hides them as it goes, so the
 * list is read again before every press and not once for the walk.
 */
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
        focused: el === document.activeElement,
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
        // Script has run once the rows have been given their arrows; the
        // privacy page has no script and no rows.
        if (path === '/') {
          await expect(
            page.locator('section.row[data-arrows]').first(),
          ).toBeAttached();
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
        // The stops that are there before the first press and cannot go: all
        // but a row's arrows, which a row's own scrolling shows and hides.
        const fixed = expected.filter(
          (s) => !/^(Previous|Next) in /.test(s.name),
        );
        let reached = 0;
        let arrows = 0;
        for (let step = 0; step < 500; step += 1) {
          const list = await tabbable(page);
          const stop = list[list.findIndex((s) => s.focused) + 1];
          if (stop === undefined) break;
          await page.keyboard.press('Tab');
          // A strip scrolls a card in smoothly, so wait for it to be in.
          await expect
            .poll(async () => (await active(page))?.inside, {
              message: `${stop.name} is in the window`,
            })
            .toBe(true);
          // And for the strip to have stopped, so that its arrows have taken
          // the state the scroll left them in before the next press.
          const strip = page.locator('ul.strip:is(:focus, :has(:focus))');
          if ((await strip.count()) > 0) await atRest(strip.first());
          const now = await active(page);
          expect(now?.tag).toBe(stop.tag);
          expect(now?.name).toBe(stop.name);
          expect(now?.outlineStyle).not.toBe('none');
          expect(now?.outlineWidth).toBeGreaterThanOrEqual(2);
          expect(now?.ringSeen, `${stop.name} has a ring that shows`).toBe(
            true,
          );
          expect(now?.covered).toBe(false);
          if (/^(Previous|Next) in /.test(stop.name)) arrows += 1;
          reached += 1;
        }
        // Every stop that cannot go was walked, the footer's last included,
        // and the walk ended there and not at the loop's cap.
        expect(reached).toBeGreaterThanOrEqual(fixed.length);
        expect(reached).toBeLessThan(500);
        test.info().annotations.push({
          type: 'measured',
          description: `${reached} stops, ${arrows} of them row arrows`,
        });
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

// The edge arrows, by a real Tab press. An arrow is before its strip in the
// reading order (Previous) or after it (Next), so Previous is reached by
// Shift+Tab from the strip, and Next by Shift+Tab from the next row's strip
// when the first row has not moved, which are the two places no walk of the
// cards would stand. A hidden arrow is not a stop at all.
test.describe('the edge arrows at a desk', () => {
  test.use({ viewport: { width: 1440, height: 1000 } });

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(
      page.locator('section.row[data-arrows]').first(),
    ).toBeAttached();
  });

  const first = () => {
    const row = catalogue.rows[0];
    if (row === undefined) throw new Error('no rows were read');
    return row;
  };
  const second = () => {
    const row = catalogue.rows[1];
    if (row === undefined) throw new Error('no second row was read');
    return row;
  };

  test('Next is a stop, ringed, uncovered and 44 by 44, and Previous is not one at the start', async ({
    page,
  }) => {
    const row = page.locator(`section[id="${first().id}"]`);
    await expect(row.locator('button[data-page="previous"]')).toBeHidden();
    await page.locator(`section[id="${second().id}"] ul.strip`).focus();
    await page.keyboard.press('Shift+Tab');
    await expect(
      page.getByRole('button', { name: `Next in ${first().title}` }),
    ).toBeFocused();
    const now = await active(page);
    expect(now?.tag).toBe('button');
    expect(now?.ringSeen, 'Next has a ring that shows').toBe(true);
    expect(now?.outlineWidth).toBeGreaterThanOrEqual(2);
    await expect.poll(async () => (await active(page))?.inside).toBe(true);
    expect((await active(page))?.covered).toBe(false);
    const box = await page.evaluate(() => {
      const el = document.activeElement?.getBoundingClientRect();
      return { width: el?.width ?? 0, height: el?.height ?? 0 };
    });
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
  });

  test('Previous is a stop once the strip has moved, just before the strip, ringed and uncovered', async ({
    page,
  }) => {
    const list = page.locator(`section[id="${first().id}"] ul.strip`);
    await page
      .getByRole('button', { name: `Next in ${first().title}` })
      .click();
    await atRest(list);
    await list.focus();
    await page.keyboard.press('Shift+Tab');
    await expect(
      page.getByRole('button', { name: `Previous in ${first().title}` }),
    ).toBeFocused();
    await expect.poll(async () => (await active(page))?.inside).toBe(true);
    const now = await active(page);
    expect(now?.ringSeen, 'Previous has a ring that shows').toBe(true);
    expect(now?.covered).toBe(false);
    const box = await page.evaluate(() => {
      const el = document.activeElement?.getBoundingClientRect();
      return { width: el?.width ?? 0, height: el?.height ?? 0 };
    });
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
    // And Tab goes on into the strip.
    await page.keyboard.press('Tab');
    await expect(list).toBeFocused();
  });

  test('a hidden arrow is not a stop: Shift+Tab from the first strip does not land on Previous', async ({
    page,
  }) => {
    await page.locator(`section[id="${first().id}"] ul.strip`).focus();
    await page.keyboard.press('Shift+Tab');
    const landed = await page.evaluate(
      () => document.activeElement?.matches('button[data-page]') ?? false,
    );
    expect(landed).toBe(false);
    // Nor does the walk back through the page ever stop on a hidden arrow.
    const stops = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>('button[data-page]')]
        .filter((el) => !el.checkVisibility())
        .map((el) => el.tabIndex >= 0 && el.offsetParent !== null),
    );
    expect(stops.length).toBeGreaterThan(0);
    expect(stops.every((stop) => !stop)).toBe(true);
  });
});
