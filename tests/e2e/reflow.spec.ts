// Holds that the page reflows: at every width in WIDTHS, from 320 up to a
// desk's, the document does not scroll sideways and no text is clipped, the
// same again with the WCAG 1.4.12 text spacing laid on, and at 320 a row's
// cards stack and its strip does not scroll (1.4.10). 640 stands in for 200%
// zoom of a 1280 window. The widths between the layout's own steps are here
// because the first fault of this kind was at one of them: the feature's two
// columns could not hold its title between 641 and about 780 wide, and a test of
// 320 and 640 alone passed it. Without this a long title or a strip wider
// than the window would show only to someone zoomed in, or on a tablet.
import { expect, type Page } from '@playwright/test';
import { test } from '../clock';
import { readRows } from './catalogue';

const catalogue = readRows();

// The text spacing is laid on as a style the test adds, which the page's own
// content policy would refuse, so the policy is stood aside for this file. The
// policy is held by origin.spec.ts, which does not inject anything.
test.use({ bypassCSP: true });

const SPACING = `
  * { line-height: 1.5 !important; letter-spacing: 0.12em !important;
      word-spacing: 0.16em !important; }
  p { margin-bottom: 2em !important; }
`;

/** What does not fit: the page's own width, and any box that cuts its text. */
async function problems(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const found: string[] = [];
    const root = document.scrollingElement;
    if (root !== null && root.scrollWidth > window.innerWidth) {
      found.push(`the page scrolls sideways: ${root.scrollWidth}`);
    }
    for (const el of document.querySelectorAll<HTMLElement>('body *')) {
      // A strip that scrolls on purpose is read as its own window below.
      const inStrip = el.closest('ul[tabindex]');
      const box = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      const ownText = [...el.childNodes].some(
        (node) =>
          node.nodeType === Node.TEXT_NODE &&
          (node.textContent ?? '').trim() !== '',
      );
      if (box.width === 0 && box.height === 0) continue;
      // The words a link says to a screen reader are one pixel square and
      // clipped on purpose, and are not drawn: they are not a box that cuts
      // its text.
      if (el.closest('.visually-hidden') !== null) continue;
      const tag = `${el.tagName.toLowerCase()} "${(el.textContent ?? '').trim().slice(0, 30)}"`;
      if (el !== inStrip) {
        if (
          style.overflowX !== 'visible' &&
          el.scrollWidth > el.clientWidth + 1
        )
          found.push(`${tag} clips sideways`);
        if (
          style.overflowY !== 'visible' &&
          el.scrollHeight > el.clientHeight + 1
        )
          found.push(`${tag} clips down`);
      }
      if (ownText) {
        const window_ = inStrip === null ? null : el.closest('li');
        const limit =
          window_ === null
            ? { left: 0, right: window.innerWidth }
            : window_.getBoundingClientRect();
        if (box.left < limit.left - 1 || box.right > limit.right + 1)
          found.push(`${tag} sticks out of its box`);
      }
    }
    return found;
  });
}

// Each side of every step in site.css (21.25rem, 40rem and 64rem: a media
// query's rem is the browser's 16px, whatever the page's own root size), and
// plain widths between and beyond them.
const WIDTHS = [
  320, 339, 341, 390, 480, 640, 641, 700, 768, 900, 1023, 1025, 1280, 1440,
];

for (const width of WIDTHS) {
  for (const spaced of [false, true]) {
    test(`at ${width} wide${spaced ? ' with text spacing' : ''}: no sideways scroll, nothing clipped`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.goto('/');
      // The rows' arrows and page marks are drawn by script, so it is waited
      // for and they are among what is measured.
      await expect(
        page.locator('section.row[data-arrows]').first(),
      ).toBeAttached();
      if (spaced) await page.addStyleTag({ content: SPACING });
      await expect(page.locator('[data-entry]').first()).toBeVisible();
      expect(await page.locator('[data-entry]').count()).toBeGreaterThan(0);
      expect(await problems(page)).toEqual([]);
    });
  }
}

// The privacy page is prose alone, and the same widths and the same spacing
// hold it: a long line of words or an outside link must not push it sideways.
for (const width of WIDTHS) {
  for (const spaced of [false, true]) {
    test(`the privacy page at ${width} wide${spaced ? ' with text spacing' : ''}: no sideways scroll, nothing clipped`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.goto('/privacy/');
      if (spaced) await page.addStyleTag({ content: SPACING });
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(
        'Privacy',
      );
      expect(await page.locator('main p').count()).toBeGreaterThan(5);
      expect(await problems(page)).toEqual([]);
    });
  }
}

// Both ends of the stack's step (below 21.25rem, 340px), so that a phone's
// smaller cards are seen not to have moved where the stack begins.
for (const width of [320, 339]) {
  test(`at ${width} wide a row stacks its cards and does not scroll sideways`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.goto('/');
    let reached = 0;
    for (const each of catalogue.rows) {
      const section = page.locator(`section[id="${each.id}"]`);
      const list = section.getByRole('list');
      expect(
        await list.evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
      ).toBe(true);
      const tops = await section
        .locator('[data-entry]')
        .evaluateAll((all) => all.map((el) => el.getBoundingClientRect().top));
      expect(tops.length).toBe(each.entries.length);
      tops.forEach((top, at) => {
        if (at > 0) expect(top).toBeGreaterThan(tops[at - 1] ?? 0);
      });
      await expect(section.getByRole('button')).toHaveCount(0);
      reached += 1;
    }
    expect(reached).toBe(catalogue.rows.length);
  });
}

// Preflight stands in for 200% zoom by zooming the root with CSS at 1280
// wide, which halves the room and leaves the desk's layout in place: no
// window width a reader can reach does that, but it is what a title of one
// very long word would do to the feature's words column at any width. So it
// is held here as the test of the title's last resort, breaking inside a
// word, and so that preflight and this spec agree.
test('with the root zoomed to 2 at 1280 wide, the page does not scroll sideways', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  await expect(page.locator('[data-entry]').first()).toBeVisible();
  const widths = await page.evaluate(() => {
    document.documentElement.style.zoom = '2';
    return {
      page: document.documentElement.scrollWidth,
      window: window.innerWidth,
    };
  });
  expect(widths.window).toBe(1280);
  expect(widths.page).toBeLessThanOrEqual(widths.window + 1);
});
