// Holds that every link that leaves the site opens in a new window and says so
// before it does (WCAG 3.2.5, technique G201), and that no link inside the site
// does. On the home page, the privacy page and the 404, every a[href] whose
// address is on another origin has target="_blank", a rel holding noopener, an
// accessible name that ends "(opens in a new window)", and the icon that says it
// by sight: inside the link, or for a card in its label line, hidden from the
// accessibility tree and no shorter than the text's x-height. No link to the
// site's own origin or to a # has a target. Then it follows links as a user does,
// with a real click and a real Enter: each opens one new page at the card's
// address and leaves this page where it was, and the request is stopped at a
// route on the whole context so that no test leaves the site. Each test counts
// what it reached, so that finding no links fails. Without it a link that lost
// its target, its rel or its words would pass every other spec, since none of
// them reads either, and a reader would be sent away from the page they were on
// with no word of it.
import { expect, type Page } from '@playwright/test';
import { test } from '../clock';

const WORDS = '(opens in a new window)';

/** Every page that has links, with how many of each kind of outside link. */
const PAGES = [
  { name: 'the home page', path: '/', prose: 0 },
  { name: 'the privacy page', path: '/privacy/', prose: 4 },
  { name: 'the 404', path: '/nowhere-here/', prose: 0 },
] as const;
/** The footer's three: two licences and the source. */
const FOOTER = 3;

/** The page's links, each with where it points, read from the page. */
async function readLinks(page: Page) {
  const own = new URL(page.url()).origin;
  return page.locator('a[href]').evaluateAll((all, ownOrigin) => {
    return all.map((link, at) => {
      const anchor = link as HTMLAnchorElement;
      const address = new URL(anchor.href);
      const card = anchor.closest('li.card');
      const place = anchor.closest('footer')
        ? 'footer'
        : anchor.closest('.prose')
          ? 'prose'
          : anchor.closest('section.feature')
            ? 'feature'
            : card
              ? 'card'
              : 'inside';
      return {
        at,
        outside: address.origin !== ownOrigin,
        place,
        target: anchor.getAttribute('target'),
        rel: anchor.getAttribute('rel'),
        href: anchor.href,
        written: anchor.getAttribute('href') ?? '',
      };
    });
  }, own);
}

for (const each of PAGES) {
  test.describe(each.name, () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(each.path);
    });

    test('every link to another origin opens in a new window, cut from this one, and every link inside the site stays', async ({
      page,
    }) => {
      const links = await readLinks(page);
      const outside = links.filter((link) => link.outside);
      const inside = links.filter((link) => !link.outside);
      expect(outside.length).toBeGreaterThan(0);
      expect(inside.length).toBeGreaterThan(0);
      for (const link of outside) {
        expect(link.target, `${link.place} ${link.href}`).toBe('_blank');
        expect((link.rel ?? '').split(/\s+/), `${link.href}`).toContain(
          'noopener',
        );
      }
      for (const link of inside) {
        expect(link.target, `${link.place} ${link.written}`).toBeNull();
      }
      // Counted by kind, so that a kind of link left out of the count is seen.
      const count = (place: string) =>
        outside.filter((link) => link.place === place).length;
      expect(count('footer')).toBe(FOOTER);
      expect(count('prose')).toBe(each.prose);
      if (each.path === '/') {
        const cards = await page.locator('li.card[data-linked]').count();
        const features = await page
          .locator('section.feature a.button[href]')
          .count();
        expect(cards).toBeGreaterThan(0);
        expect(features).toBeGreaterThan(0);
        expect(count('card')).toBe(cards);
        expect(count('feature')).toBe(features);
        expect(
          await page.locator('section.feature:not([hidden]) a.button').count(),
          'the shown feature',
        ).toBe(1);
      } else {
        expect(count('card') + count('feature')).toBe(0);
      }
      expect(outside.length).toBe(
        FOOTER + each.prose + count('card') + count('feature'),
      );
      // Rows' jumps, the wordmark, Privacy and the way back are all inside,
      // and so is nothing that has a # or this origin and a target.
      expect(
        inside.filter(
          (link) => link.written.startsWith('#') || link.written === '/',
        ).length,
      ).toBeGreaterThan(0);
    });

    test('every shown link to another origin is named with the words, and says it by sight', async ({
      page,
    }) => {
      const own = new URL(page.url()).origin;
      const shown = page.locator('a[href]:visible');
      const total = await shown.count();
      let reached = 0;
      for (let at = 0; at < total; at += 1) {
        const link = shown.nth(at);
        const href = (await link.getAttribute('href')) ?? '';
        if (new URL(href, page.url()).origin === own) {
          // The icon is for a link that leaves, and no other has one.
          await expect(link.locator('svg')).toHaveCount(0);
          continue;
        }
        reached += 1;
        // Every space written between two of its words is drawn as a gap: one
        // was lost when the link's text was split and the link was a flex box.
        const joined = await link.evaluate((el) => {
          const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
          const range = document.createRange();
          const size = parseFloat(getComputedStyle(el).fontSize);
          const found: string[] = [];
          let seenSpace = false;
          let before: DOMRect | null = null;
          let words = 0;
          for (let node = walker.nextNode(); node; node = walker.nextNode()) {
            if (node.parentElement?.closest('.visually-hidden')) continue;
            const text = node.textContent ?? '';
            for (let at = 0; at < text.length; at += 1) {
              if (/\s/.test(text[at] ?? '')) {
                seenSpace = before !== null;
                continue;
              }
              range.setStart(node, at);
              range.setEnd(node, at + 1);
              const box = range.getBoundingClientRect();
              if (
                seenSpace &&
                before !== null &&
                Math.abs(box.top - before.top) < box.height / 2 &&
                box.left - before.right < size * 0.15
              )
                found.push(`${text.slice(Math.max(0, at - 6), at + 3)}`);
              if (seenSpace) words += 1;
              seenSpace = false;
              before = box;
            }
          }
          return { found, words };
        });
        expect(joined.found, 'words run together').toEqual([]);
        await expect(link).toHaveAccessibleName(
          new RegExp(`\\S ${WORDS.replace(/[()]/g, '\\$&')}$`),
        );
        // A card's icon is in its label line; every other link holds its own.
        const card = link.locator(
          'xpath=ancestor::li[contains(@class,"card")]',
        );
        const home =
          (await card.count()) > 0 ? card.locator('[data-label]') : link;
        await expect(home.locator('svg')).toHaveCount(1);
        const icon = home.locator('svg');
        await expect(icon).toHaveAttribute('aria-hidden', 'true');
        await expect(icon).toBeVisible();
      }
      expect(reached).toBeGreaterThan(FOOTER - 1);
    });

    test('the icon is out of the accessibility tree and at least as tall as the text’s x-height', async ({
      page,
    }) => {
      const icons = page.locator('svg[aria-hidden="true"]:visible');
      const total = await icons.count();
      expect(total).toBeGreaterThan(FOOTER - 1);
      for (let at = 0; at < total; at += 1) {
        const icon = icons.nth(at);
        const host = icon.locator(
          'xpath=ancestor::*[self::a or @data-label][1]',
        );
        // The tree holds the words and not the icon: nothing in the host is
        // an image, and its name is the same with the icon taken away.
        expect(await host.ariaSnapshot()).not.toMatch(/\bimg\b/);
        const measured = await icon.evaluate((svg) => {
          const style = getComputedStyle(svg.parentElement as Element);
          const canvas = document.createElement('canvas').getContext('2d');
          if (canvas === null) throw new Error('no canvas');
          canvas.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
          const x = canvas.measureText('x').actualBoundingBoxAscent;
          const box = svg.getBoundingClientRect();
          return { x, height: box.height, width: box.width };
        });
        expect(measured.x).toBeGreaterThan(0);
        expect(measured.height).toBeGreaterThanOrEqual(measured.x);
        expect(measured.width).toBeGreaterThanOrEqual(measured.x);
      }
    });
  });
}

/** A route on the whole context: stops every request that leaves the site. */
async function stopOutside(page: Page): Promise<string[]> {
  const own = new URL(page.url() || 'http://localhost:4390').origin;
  const asked: string[] = [];
  await page.context().route(
    (url) => url.origin !== own,
    (route) => {
      asked.push(route.request().url());
      return route.abort();
    },
  );
  return asked;
}

test.describe('following a link opens one new window and leaves this page where it was', () => {
  for (const how of ['a real click', 'a real Enter on the focused link']) {
    test(`${how} on a card`, async ({ page, context }) => {
      await page.goto('/');
      await expect(page.locator('[aria-disabled]').first()).toBeAttached();
      const asked = await stopOutside(page);
      const link = page.locator('li.card[data-linked] a.card-link').first();
      const href = new URL((await link.getAttribute('href')) ?? '').href;
      const before = page.url();
      await link.scrollIntoViewIfNeeded();
      const opened = context.waitForEvent('page');
      if (how === 'a real click') await link.click();
      else {
        await link.focus();
        await page.keyboard.press('Enter');
      }
      const popup = await opened;
      await expect.poll(() => asked).toEqual([href]);
      expect(context.pages().length).toBe(2);
      expect(page.url()).toBe(before);
      // The new window is cut from this one: it has no way back to it.
      expect(await popup.evaluate(() => window.opener === null)).toBe(true);
      await popup.close();
    });
  }

  test('a real click on the feature’s button', async ({ page, context }) => {
    await page.goto('/');
    const asked = await stopOutside(page);
    const link = page.locator('section.feature:not([hidden]) a.button');
    const href = new URL((await link.getAttribute('href')) ?? '').href;
    const before = page.url();
    const opened = context.waitForEvent('page');
    await link.click();
    const popup = await opened;
    await expect.poll(() => asked).toEqual([href]);
    expect(context.pages().length).toBe(2);
    expect(page.url()).toBe(before);
    await popup.close();
  });

  test('a link inside the site is followed in this window', async ({
    page,
    context,
  }) => {
    await page.goto('/');
    await page.locator('footer a[href="/privacy/"]').click();
    await expect(page).toHaveURL(/\/privacy\/$/);
    expect(context.pages().length).toBe(1);
  });
});

test('in the privacy page’s prose the icon never wraps away from the last word of its link, at any width', async ({
  page,
}) => {
  await page.goto('/privacy/');
  await page.evaluate(() => document.fonts.ready);
  let measured = 0;
  const stranded: string[] = [];
  for (let width = 320; width <= 900; width += 5) {
    await page.setViewportSize({ width, height: 800 });
    const found = await page.locator('.prose a svg').evaluateAll((icons) =>
      icons.map((icon) => {
        const link = icon.closest('a') as HTMLAnchorElement;
        // The last drawn character of the link's own words.
        const walker = document.createTreeWalker(link, NodeFilter.SHOW_TEXT);
        let last: Text | null = null;
        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
          if (
            node.parentElement?.closest('.visually-hidden') === null &&
            (node.textContent ?? '').trim() !== ''
          )
            last = node as Text;
        }
        if (last === null) throw new Error('a link with no words');
        const range = document.createRange();
        const end = (last.textContent ?? '').trimEnd().length;
        range.setStart(last, end - 1);
        range.setEnd(last, end);
        const word = range.getBoundingClientRect();
        const mark = icon.getBoundingClientRect();
        // The same line: the icon's middle is within the last letter's height.
        const middle = mark.top + mark.height / 2;
        return {
          text: link.textContent?.trim() ?? '',
          same: middle > word.top && middle < word.bottom,
        };
      }),
    );
    for (const each of found) {
      measured += 1;
      if (!each.same) stranded.push(`${width}: ${each.text}`);
    }
  }
  expect(measured).toBeGreaterThan(400);
  expect(stranded).toEqual([]);
});
