// Holds part 3 of plans/effects.md, "drag to scroll": with a real mouse,
// pressing on a strip and moving more than a few pixels drags it, the strip's
// scrollLeft following the pointer, and on release it settles on a card
// through the scroll snap it already has. A drag follows no link and its click
// is swallowed once; a press that does not move, or moves under the threshold,
// is an ordinary click. Touch and pen are left to the browser. A row that fits
// cannot be dragged. Reduced motion changes nothing, since nothing here is
// motion: the strip moves under the reader's hand. Without this a drag that
// followed the link under it, that ate the next plain click, that fought the
// scroll snap, took a finger's swipe for a mouse or left a row marked as being
// dragged would pass every other test, since none of them uses the mouse
// sideways. Every address outside the site is routed, recorded and aborted, so
// a test that follows a link never leaves the site. Each test counts what it
// reached and waits on a state, never on a time.
import { expect, type Locator, type Page } from '@playwright/test';
import { test } from '../clock';
import { readRows } from './catalogue';
import { atRest, untilScrolled } from './scrolling';

test.use({ viewport: { width: 1440, height: 1000 } });

const catalogue = readRows();
const FIRST = catalogue.rows[0]?.id ?? '';
const LAST = catalogue.rows[catalogue.rows.length - 1]?.id ?? '';

function strip(page: Page, id: string): Locator {
  return page.locator(`section[id="${id}"] ul.strip`);
}

const left = (list: Locator) => list.evaluate((el) => el.scrollLeft);

/** Two frames drawn: a state to wait on where nothing is meant to happen. */
async function settled(page: Page): Promise<void> {
  await page.evaluate(
    () =>
      new Promise<void>((done) =>
        requestAnimationFrame(() => requestAnimationFrame(() => done())),
      ),
  );
}

/**
 * Opens the page with script run, and routes every address outside the site:
 * each is recorded and aborted, so that following a link is seen and goes
 * nowhere. The route is on the whole context, since a link that leaves the
 * site opens a new window, which a route on this page alone would not see.
 * The list it returns is filled as requests are made.
 */
async function open(page: Page): Promise<string[]> {
  const outside: string[] = [];
  const own = new URL('http://localhost:4390').origin;
  await page.context().route(
    (url) => url.origin !== own,
    (route) => {
      outside.push(route.request().url());
      return route.abort();
    },
  );
  await page.goto('/');
  await expect(page.locator('section.row[data-arrows]').first()).toBeAttached();
  // The hero fills most of the first screen, so the first row is brought into
  // the window, where a mouse can reach it.
  await page
    .locator('section.row')
    .first()
    .getByRole('list')
    .scrollIntoViewIfNeeded();
  return outside;
}

/** A linked card of a strip, by its place, with its box and its address. */
async function linkedCard(list: Locator, place: number) {
  const card = list.locator('li.card[data-linked]').nth(place);
  await expect(card).toBeVisible();
  const box = await card.boundingBox();
  const written = await card.locator('a.card-link').getAttribute('href');
  if (box === null || written === null) throw new Error('no linked card');
  // The browser asks for the address with its path written out.
  return { card, box, href: new URL(written).href };
}

/** The first linked card of a strip that is wholly inside the window. */
async function visibleCard(list: Locator) {
  const cards = list.locator('li.card[data-linked]');
  const count = await cards.count();
  for (let at = 0; at < count; at += 1) {
    const box = await cards.nth(at).boundingBox();
    if (box !== null && box.x >= 0 && box.x + box.width <= 1440) return { box };
  }
  throw new Error('no linked card is wholly in the window');
}

/** Presses at a point of a card, moves `by` pixels sideways, and stays down. */
async function dragBy(page: Page, x: number, y: number, by: number) {
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + by, y, { steps: 12 });
}

const marked = (list: Locator) =>
  list.evaluate((el) => el.hasAttribute('data-dragging'));

function drag(reduced: 'no-preference' | 'reduce') {
  test.describe(`with a mouse, motion ${reduced}`, () => {
    test.use({ reducedMotion: reduced });

    test('a drag moves the strip, follows no link and leaves it settled', async ({
      page,
    }) => {
      const outside = await open(page);
      const list = strip(page, FIRST);
      const { box } = await linkedCard(list, 1);
      const x = box.x + box.width / 2;
      const y = box.y + box.height / 3;

      await dragBy(page, x, y, -300);
      // While the pointer is down and has moved, the strip is marked, does not
      // glide and has no snap to fight the pointer; it has followed the hand.
      expect(await marked(list)).toBe(true);
      expect(
        await list.evaluate((el) => getComputedStyle(el).scrollBehavior),
      ).toBe('auto');
      expect(
        await list.evaluate((el) => getComputedStyle(el).scrollSnapType),
      ).toBe('none');
      expect(await list.evaluate((el) => getComputedStyle(el).userSelect)).toBe(
        'none',
      );
      expect(await left(list)).toBeCloseTo(300, 0);
      expect(await list.evaluate((el) => getComputedStyle(el).cursor)).toBe(
        'grabbing',
      );

      await page.mouse.up();
      await expect.poll(() => marked(list)).toBe(false);
      await atRest(list);
      const width = box.width;
      const at = await left(list);
      expect(at).toBeGreaterThan(0);
      expect(Math.abs(at - 300)).toBeLessThan(width);
      await settled(page);
      expect(outside, 'addresses outside the site asked for').toEqual([]);
      test.info().annotations.push({
        type: 'measured',
        description: `released at 300, settled at ${at}`,
      });
    });

    test('the click after a drag is swallowed once and the next plain click follows its link', async ({
      page,
    }) => {
      const outside = await open(page);
      const list = strip(page, FIRST);
      const { box, href } = await linkedCard(list, 1);
      // Counts the clicks that reach the document, which a swallowed one does
      // not, whatever element the browser aimed it at.
      await page.evaluate(() => {
        const seen: number[] = [];
        Object.assign(window, { clicksSeen: seen });
        document.addEventListener('click', () => seen.push(1));
      });
      const x = box.x + box.width / 2;
      const y = box.y + box.height / 3;
      await dragBy(page, x, y, -300);
      await page.mouse.up();
      await expect.poll(() => marked(list)).toBe(false);
      await atRest(list);
      await settled(page);
      expect(
        await page.evaluate(
          () =>
            (window as unknown as { clicksSeen: number[] }).clicksSeen.length,
        ),
        'clicks that reached the document after a drag',
      ).toBe(0);
      expect(outside).toEqual([]);
      expect(page.context().pages().length, 'windows after a drag').toBe(1);

      // The next press and release, with no movement, is an ordinary click.
      const now = await linkedCard(list, 1);
      await page.mouse.click(
        now.box.x + now.box.width / 2,
        now.box.y + now.box.height / 3,
      );
      // The link opens a new window, so the request is what is read, and this
      // page stays where it was.
      await expect.poll(() => outside).toContain(href);
      expect(page.context().pages().length).toBe(2);
    });

    test('dragging right from a scrolled strip goes back and stops at 0', async ({
      page,
    }) => {
      await open(page);
      const list = strip(page, FIRST);
      // The strip is read only once the browser says the scroll the button
      // began has ended: read while it glides, the drag below began from a
      // place the strip was only passing through.
      await untilScrolled(list, () =>
        page
          .locator(`section[id="${FIRST}"]`)
          .getByRole('button', { name: /^Next/ })
          .click(),
      );
      await atRest(list);
      const from = await left(list);
      expect(from).toBeGreaterThan(0);
      const { box } = await visibleCard(list);
      const x = box.x + box.width / 2;
      const y = box.y + box.height / 3;

      await dragBy(page, x, y, 100);
      const part = await left(list);
      expect(part).toBeCloseTo(from - 100, 0);
      expect(part).toBeGreaterThan(0);
      // Further right than the strip goes: it holds at 0 and does not go
      // negative or bounce.
      await page.mouse.move(x + from + 800, y, { steps: 8 });
      expect(await left(list)).toBe(0);
      await page.mouse.up();
      await expect.poll(() => marked(list)).toBe(false);
      await atRest(list);
      expect(await left(list)).toBe(0);
    });

    test('dragging left past the end holds at the end', async ({ page }) => {
      await open(page);
      const list = strip(page, FIRST);
      const { box } = await linkedCard(list, 1);
      const x = box.x + box.width / 2;
      const y = box.y + box.height / 3;
      const furthest = await list.evaluate(
        (el) => el.scrollWidth - el.clientWidth,
      );
      expect(furthest).toBeGreaterThan(1000);
      await page.mouse.move(x, y);
      await page.mouse.down();
      await page.mouse.move(x - furthest - 500, y, { steps: 12 });
      expect(await left(list)).toBeCloseTo(furthest, 0);
      await page.mouse.up();
      await expect.poll(() => marked(list)).toBe(false);
    });

    test('nothing is selected after a drag', async ({ page }) => {
      await open(page);
      const list = strip(page, FIRST);
      const { box } = await linkedCard(list, 1);
      // Pressed in the gap beside a card, level with its words: a card's own
      // words are under its link, which a press cannot select from, and the
      // gap is where a text selection can start and run left across them.
      const x = box.x + box.width + 4;
      const y = box.y + box.height - 20;
      await dragBy(page, x, y, -300);
      await page.mouse.up();
      expect(await left(list)).toBeGreaterThan(0);
      expect(await page.evaluate(() => getSelection()?.toString())).toBe('');
    });
  });
}

drag('no-preference');
drag('reduce');

test.describe('a click that is not a drag', () => {
  test('a press with no movement follows the card link', async ({ page }) => {
    const outside = await open(page);
    const list = strip(page, FIRST);
    const { box, href } = await linkedCard(list, 0);
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 3);
    await expect.poll(() => outside).toContain(href);
  });

  test('a movement under the threshold is still a click', async ({ page }) => {
    const outside = await open(page);
    const list = strip(page, FIRST);
    const { box, href } = await linkedCard(list, 0);
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 3;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x - 3, y);
    expect(await marked(list)).toBe(false);
    await page.mouse.up();
    await expect.poll(() => outside).toContain(href);
  });
});

test('a row that fits cannot be dragged and shows no sign of it', async ({
  page,
}) => {
  await open(page);
  const list = strip(page, LAST);
  await list.scrollIntoViewIfNeeded();
  expect(
    await list.evaluate((el) => el.scrollWidth - el.clientWidth <= 1),
    'the last row fits',
  ).toBe(true);
  await page.evaluate(() => {
    const seen: string[] = [];
    Object.assign(window, { marks: seen });
    for (const el of document.querySelectorAll('ul.strip'))
      new MutationObserver(() => {
        if (el.hasAttribute('data-dragging')) seen.push('marked');
      }).observe(el, { attributes: true });
  });
  const card = list.locator('li.card').first();
  const box = await card.boundingBox();
  if (box === null) throw new Error('no card');
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 3;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x - 300, y, { steps: 12 });
  expect(await marked(list)).toBe(false);
  expect(await list.evaluate((el) => getComputedStyle(el).cursor)).not.toBe(
    'grabbing',
  );
  await page.mouse.up();
  await settled(page);
  expect(await left(list)).toBe(0);
  expect(
    await page.evaluate(() => (window as unknown as { marks: string[] }).marks),
  ).toEqual([]);
});

test.describe('touch and pen', () => {
  test.use({ hasTouch: true });

  // The events are dispatched by script on the strip, as a finger's or a pen's
  // would arrive: pointerdown, a long pointermove and pointerup, with a
  // pointerType of touch or pen. Playwright's mouse cannot send those. A
  // MutationObserver on the strip records whether it was ever marked, even for
  // a moment. Synthetic events scroll nothing, so a strip that moved was moved
  // by the page's script, which is the fault.
  for (const kind of ['touch', 'pen']) {
    test(`${kind} is left to the browser: no mark, no movement`, async ({
      page,
    }) => {
      await open(page);
      const list = strip(page, FIRST);
      const before = await left(list);
      const result = await list.evaluate((el, pointerType) => {
        const seen: string[] = [];
        new MutationObserver(() => {
          if (el.hasAttribute('data-dragging')) seen.push('marked');
        }).observe(el, { attributes: true });
        const box = el.getBoundingClientRect();
        const at = (dx: number) => ({
          pointerType,
          pointerId: 41,
          isPrimary: true,
          button: 0,
          buttons: 1,
          clientX: box.x + box.width / 2 + dx,
          clientY: box.y + 100,
          bubbles: true,
        });
        el.dispatchEvent(new PointerEvent('pointerdown', at(0)));
        for (let step = 1; step <= 10; step += 1)
          el.dispatchEvent(new PointerEvent('pointermove', at(-step * 30)));
        const duringMark = el.hasAttribute('data-dragging');
        el.dispatchEvent(new PointerEvent('pointerup', at(-300)));
        return { duringMark, seen };
      }, kind);
      expect(result.duringMark).toBe(false);
      await settled(page);
      expect(result.seen).toEqual([]);
      expect(await left(list)).toBe(before);
    });
  }
});
