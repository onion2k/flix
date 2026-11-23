// Holds part 3 of plans/cards.md, "the flip": a click, a tap or Enter anywhere
// on a card turns it over. Its front (the picture, the label, the title) leaves
// the accessibility tree and its back (the label, the title, the description,
// the Play link and a Close button) comes into it, focus goes to Play (or to
// Close on a card with no link), and nothing opens. Play opens the game in one
// new window, cut from this one. A press on the back outside Play, the Close
// button and Escape each turn it back, with focus on its flip button, and
// flipping a second card turns the first back, so one card is flipped at a
// time. A reader who asked for less motion sees the faces swap at once. A card
// in a late row flips before and after its picture has come, a flipped card
// holds its words with the text spacing of WCAG 1.4.12 at a phone's width, and
// nothing grows on a hover or a focus held past the old pause (a hover or a
// focus held short of the settle time makes no card video either; what makes
// one is playing.spec.ts's). Every control
// is worked as a reader works it: a real click, a real tap in a context with
// touch, a real Tab and Enter, a real Escape. Every address outside the site is
// routed, recorded and aborted, so that no test leaves it. What is in the
// accessibility tree is asked of the browser itself (tree.ts). Each test
// counts what it reached. A card flipped where an arrow press left it has its
// words, Play and Close clear of both arrows (arrows.ts measures them).
import { expect, type Locator, type Page } from '@playwright/test';
import { DAY_ZERO, test } from '../clock';
import { readRows } from './catalogue';
import { partsUnderArrows } from './arrows';
import { atRest, untilScrolled } from './scrolling';
import { inTree } from './tree';

const catalogue = readRows();

test.use({ viewport: { width: 1440, height: 1000 } });

/** One frame of the stepped clock, in ms: where Playwright's rAF falls. */
const FRAME = 16;

/** WCAG 1.4.12's spacing, as reflow.spec.ts lays it on. */
const SPACING = `
  * { line-height: 1.5 !important; letter-spacing: 0.12em !important;
      word-spacing: 0.16em !important; }
  p { margin-bottom: 2em !important; }
`;

/**
 * Routes every address outside the site on the whole context (a new window
 * is a page of the context, which a route on this page would not see), and
 * returns the list the addresses asked for are written to.
 */
async function stopOutside(page: Page): Promise<string[]> {
  const own = new URL('http://localhost:4390').origin;
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

/** The page with script run: every card has been given its flip. */
async function ready(page: Page): Promise<string[]> {
  const asked = await stopOutside(page);
  await page.goto('/');
  await expect(page.locator('section.row[data-arrows]').first()).toBeAttached();
  await expect(page.locator('li.card:not([data-flips])')).toHaveCount(0);
  return asked;
}

const firstRow = (page: Page): Locator => page.locator('section.row').first();
const cardAt = (page: Page, at: number): Locator =>
  firstRow(page).locator('li.card').nth(at);

/** Where a reader would press on a card's front: the middle of its picture. */
async function pictureMiddle(
  card: Locator,
  clockHeld = false,
): Promise<{ x: number; y: number }> {
  // Wholly into the window, and not only part of it as Playwright's own
  // scroll leaves a card cut off at a strip's edge, where a row's arrow is
  // over it and a press would be the arrow's. To its start, which is one of
  // the strip's snap points: a scroll to anywhere else is snapped back.
  await card.evaluate((el) =>
    el.scrollIntoView({ block: 'nearest', inline: 'start' }),
  );
  // A strip glides where motion is allowed, so it is let come to rest before
  // the picture's place is read, or the press would land where it was. With
  // the clock held no frame comes, and nothing glides.
  if (!clockHeld)
    await atRest(card.locator('xpath=ancestor::ul[contains(@class,"strip")]'));
  const box = await card.locator('.frame').boundingBox();
  expect(box, 'the picture is drawn').not.toBeNull();
  return {
    x: (box?.x ?? 0) + (box?.width ?? 0) / 2,
    y: (box?.y ?? 0) + (box?.height ?? 0) / 2,
  };
}

/** Where a reader would press on a card's back outside Play: its description. */
async function descriptionMiddle(
  card: Locator,
): Promise<{ x: number; y: number }> {
  await settled(card);
  const box = await card.locator('.back .description').boundingBox();
  expect(box, 'the description is drawn').not.toBeNull();
  return {
    x: (box?.x ?? 0) + (box?.width ?? 0) / 2,
    y: (box?.y ?? 0) + (box?.height ?? 0) / 2,
  };
}

/** A real click on a card's picture, which is a press on its front. */
async function clickFront(page: Page, card: Locator): Promise<void> {
  const at = await pictureMiddle(card);
  await page.mouse.click(at.x, at.y);
}

/** What focus is on now, by the card it is in and the control it is. */
function focusIs(page: Page): Promise<string> {
  return page.evaluate(() => {
    const el = document.activeElement;
    const card = el?.closest<HTMLElement>('li.card');
    if (el === null || card === null || card === undefined) return 'elsewhere';
    const at = [...document.querySelectorAll('li.card')].indexOf(card);
    const what = el.matches('a.card-link')
      ? 'play'
      : el.matches('button.card-unflip')
        ? 'close'
        : el.matches('button.card-flip')
          ? 'flip'
          : el.tagName.toLowerCase();
    return `${at} ${what}`;
  });
}

/** The place among all the page's cards of one card, as focusIs() counts. */
function placeOf(card: Locator): Promise<number> {
  return card.evaluate((el) =>
    [...document.querySelectorAll('li.card')].indexOf(el),
  );
}

/** The cards that are flipped now, by place. */
function flipped(page: Page): Promise<number[]> {
  return page.evaluate(() =>
    [...document.querySelectorAll('li.card')]
      .map((card, at) => (card.hasAttribute('data-flipped') ? at : -1))
      .filter((at) => at >= 0),
  );
}

/**
 * What a card's two faces say, read from the markup, to look for in the tree.
 * The title is in capitals there, as it is drawn: Chromium names a node by the
 * text as the stylesheet transforms it.
 */
async function wordsOf(card: Locator) {
  return card.evaluate((el) => ({
    title: el.querySelector('h3')?.textContent?.trim().toUpperCase() ?? '',
    description:
      el.querySelector('.back .description')?.textContent?.trim() ?? '',
    play: el.querySelector('a.card-link')?.getAttribute('aria-label') ?? '',
    about: el.querySelector('button.card-flip')?.textContent?.trim() ?? '',
    close: el.querySelector('button.card-unflip')?.textContent?.trim() ?? '',
  }));
}

/**
 * The card shows its back to the tree and not its front: its description, its
 * Play link (where it has one) and its Close button are there, and its
 * heading, its picture and its flip button are not. Returns the count of
 * what it checked.
 */
async function showsBack(card: Locator, linked: boolean): Promise<number> {
  const words = await wordsOf(card);
  const tree = await inTree(card);
  expect(tree.length, 'nodes in the tree').toBeGreaterThan(2);
  expect(tree).toContain(`StaticText: ${words.description}`);
  expect(tree).toContain(`button: ${words.close}`);
  if (linked) expect(tree).toContain(`link: ${words.play}`);
  else expect(tree.filter((each) => each.startsWith('link:'))).toEqual([]);
  expect(tree).not.toContain(`heading: ${words.title}`);
  expect(tree).not.toContain(`button: ${words.about}`);
  expect(tree.filter((each) => each.startsWith('image:'))).toEqual([]);
  return tree.length;
}

/** The card shows its front: its heading, its one picture and its flip button, and nothing of its back. */
async function showsFront(card: Locator): Promise<number> {
  const words = await wordsOf(card);
  const tree = await inTree(card);
  expect(tree.length, 'nodes in the tree').toBeGreaterThan(2);
  expect(tree).toContain(`heading: ${words.title}`);
  expect(tree).toContain(`button: ${words.about}`);
  expect(tree.filter((each) => each.startsWith('image:')).length).toBe(1);
  expect(tree).not.toContain(`StaticText: ${words.description}`);
  expect(tree).not.toContain(`button: ${words.close}`);
  expect(tree.filter((each) => each.startsWith('link:'))).toEqual([]);
  // The title is said once, by the front: the back's repeat of it is out of
  // the tree with the rest of the back.
  expect(tree.filter((each) => each === `StaticText: ${words.title}`)).toEqual([
    `StaticText: ${words.title}`,
  ]);
  return tree.length;
}

/** Every turn the card's faces are making has finished, so that their boxes are where a reader sees them. */
async function settled(card: Locator): Promise<void> {
  await card.evaluate((el) =>
    Promise.all(
      el
        .getAnimations({ subtree: true })
        .map((each) => each.finished.catch(() => null)),
    ),
  );
}

test.describe('the markup, once script has run', () => {
  test('every card flips: it is marked, its two buttons are shown and named, and its back is inert', async ({
    page,
  }) => {
    await ready(page);
    const cards = page.locator('main li.card');
    const total = await cards.count();
    const expected = catalogue.rows.reduce(
      (sum, row) => sum + row.entries.length,
      0,
    );
    expect(total).toBe(expected);
    let linked = 0;
    for (let at = 0; at < total; at += 1) {
      const card = cards.nth(at);
      const title = (await card.locator('h3').textContent())?.trim() ?? '';
      expect(title.length).toBeGreaterThan(0);
      await expect(card).toHaveAttribute('data-flips', '');
      await expect(card).not.toHaveAttribute('data-flipped', '');
      const flip = card.locator('button.card-flip');
      const close = card.locator('button.card-unflip');
      await expect(flip).not.toHaveAttribute('hidden', '');
      await expect(close).not.toHaveAttribute('hidden', '');
      await expect(flip).toHaveAccessibleName(`About ${title}`);
      await expect(close).toHaveAccessibleName(`Close ${title}`);
      expect(
        await card
          .locator('.face.back')
          .evaluate((el: HTMLElement) => el.inert),
      ).toBe(true);
      expect(
        await card
          .locator('.face.front')
          .evaluate((el: HTMLElement) => el.inert),
      ).toBe(false);
      // The label line has no icon now: the Play link carries it.
      await expect(card.locator('.front [data-label] svg')).toHaveCount(0);
      if ((await card.getAttribute('data-linked')) !== null) {
        linked += 1;
        await expect(card.locator('a.card-link svg')).toHaveCount(1);
      }
    }
    expect(linked).toBeGreaterThan(0);
    expect(linked).toBeLessThan(total);
  });
});

test.describe('a click', () => {
  test('on a card flips it: its back in the tree and its front out, focus on Play, and no game opens', async ({
    page,
    context,
  }) => {
    const asked = await ready(page);
    const card = cardAt(page, 1);
    await expect(card).toHaveAttribute('data-linked', '');
    const place = await placeOf(card);
    const before = await showsFront(card);
    await clickFront(page, card);
    await expect(card).toHaveAttribute('data-flipped', '');
    await expect.poll(() => focusIs(page)).toBe(`${place} play`);
    const after = await showsBack(card, true);
    expect(
      await card.locator('.face.front').evaluate((el: HTMLElement) => el.inert),
    ).toBe(true);
    expect(
      await card.locator('.face.back').evaluate((el: HTMLElement) => el.inert),
    ).toBe(false);
    // A mouse put it there, so it is not ringed as a keyboard's would be.
    expect(
      await card.locator('a.card-link').evaluate((el) => el.matches(':focus')),
    ).toBe(true);
    expect(context.pages().length, 'windows').toBe(1);
    expect(asked, 'addresses outside the site asked for').toEqual([]);
    test.info().annotations.push({
      type: 'measured',
      description: `${before} nodes of the front, ${after} of the back`,
    });
  });

  test('on the back outside Play turns it back, with focus on its flip button, and opens nothing', async ({
    page,
    context,
  }) => {
    const asked = await ready(page);
    const card = cardAt(page, 1);
    const place = await placeOf(card);
    await clickFront(page, card);
    await expect(card).toHaveAttribute('data-flipped', '');
    const at = await descriptionMiddle(card);
    await page.mouse.click(at.x, at.y);
    await expect(card).not.toHaveAttribute('data-flipped', '');
    await expect.poll(() => focusIs(page)).toBe(`${place} flip`);
    expect(await showsFront(card)).toBeGreaterThan(2);
    expect(context.pages().length).toBe(1);
    expect(asked).toEqual([]);
  });

  test('on Close turns it back, with focus on its flip button', async ({
    page,
  }) => {
    await ready(page);
    const card = cardAt(page, 2);
    const place = await placeOf(card);
    await clickFront(page, card);
    await expect(card).toHaveAttribute('data-flipped', '');
    await card.locator('button.card-unflip').click();
    await expect(card).not.toHaveAttribute('data-flipped', '');
    await expect.poll(() => focusIs(page)).toBe(`${place} flip`);
    expect(await showsFront(card)).toBeGreaterThan(2);
  });

  test('on Play opens the game in one new window at its address, named and cut from this page as the link says', async ({
    page,
    context,
  }) => {
    const asked = await ready(page);
    const card = cardAt(page, 1);
    const title = (await card.locator('h3').textContent())?.trim() ?? '';
    const play = card.locator('a.card-link');
    const href = new URL((await play.getAttribute('href')) ?? '').href;
    expect(href).toMatch(/^https:\/\//);
    await expect(play).toHaveAttribute('target', '_blank');
    expect(((await play.getAttribute('rel')) ?? '').split(/\s+/)).toContain(
      'noopener',
    );
    await expect(play).toHaveAccessibleName(
      `Play ${title} (opens in a new window)`,
    );
    const before = page.url();
    await clickFront(page, card);
    await expect(card).toHaveAttribute('data-flipped', '');
    const opened = context.waitForEvent('page');
    await play.click();
    const popup = await opened;
    await expect.poll(() => asked).toEqual([href]);
    expect(context.pages().length).toBe(2);
    expect(page.url()).toBe(before);
    expect(await popup.evaluate(() => window.opener === null)).toBe(true);
    await popup.close();
  });

  test('on a second card turns the first back, so that one is flipped at a time, and focus goes to the second’s Play', async ({
    page,
  }) => {
    await ready(page);
    const first = cardAt(page, 1);
    const second = cardAt(page, 2);
    const place = await placeOf(second);
    await clickFront(page, first);
    await expect(first).toHaveAttribute('data-flipped', '');
    expect(await flipped(page)).toEqual([await placeOf(first)]);
    await clickFront(page, second);
    await expect(second).toHaveAttribute('data-flipped', '');
    await expect(first).not.toHaveAttribute('data-flipped', '');
    expect(await flipped(page)).toEqual([place]);
    await expect.poll(() => focusIs(page)).toBe(`${place} play`);
    expect(await showsFront(first)).toBeGreaterThan(2);
    expect(await showsBack(second, true)).toBeGreaterThan(2);
    // And a third, in another row: still one.
    const other = page.locator('section.row').nth(1).locator('li.card').first();
    await clickFront(page, other);
    await expect(other).toHaveAttribute('data-flipped', '');
    expect(await flipped(page)).toEqual([await placeOf(other)]);
  });
});

// A card cut off at the strip's edge is pressed where it is, on the part of
// its picture that shows and clear of the arrow over the rest. Pressing a
// mouse focuses the card's flip button, and the strip brings a focused card
// in (rows.ts); where that was an instant jump, as it is for a reader who
// asked for less motion, the card left the pointer before the button came
// up, the release fell on another card, and no click came: the card was
// brought in and never flipped. It is pressed as a person does, with a pause
// between down and up, at a desk's width, a phone's and 800 (inside a band
// the card after the whole ones starts under the arrow, and none of it shows
// to be pressed).
test.describe('a click on a card cut off at the strip’s edge', () => {
  for (const motion of ['reduce', 'no-preference'] as const)
    for (const width of [1440, 800, 390])
      test(`at ${width} wide, motion ${motion}: flips it, brings it in, and sends focus to its Play`, async ({
        page,
      }) => {
        await page.setViewportSize({ width, height: 1000 });
        await page.emulateMedia({ reducedMotion: motion });
        await ready(page);
        const row = firstRow(page);
        await row.evaluate((el) => el.scrollIntoView({ block: 'center' }));
        const list = row.locator('ul.strip');
        await atRest(list);
        // The first card that runs past the strip's right edge, and the part
        // of its picture left of the Next arrow.
        const found = await row.evaluate((section) => {
          const strip = section
            .querySelector('ul.strip')
            ?.getBoundingClientRect();
          const next = section
            .querySelector<HTMLElement>('.row-arrow[data-page="next"]')
            ?.getBoundingClientRect();
          const cards = [...section.querySelectorAll<HTMLElement>('li.card')];
          const at = cards.findIndex(
            (card) =>
              strip !== undefined &&
              card.getBoundingClientRect().right > strip.right + 1 &&
              card.getBoundingClientRect().left < strip.right,
          );
          const frame = cards[at]
            ?.querySelector('.frame')
            ?.getBoundingClientRect();
          if (frame === undefined || next === undefined) return null;
          return {
            at,
            x: (frame.left + next.left) / 2,
            y: frame.top + frame.height / 2,
            showing: next.left - frame.left,
          };
        });
        expect(
          found,
          'a card cut off at the strip’s right edge',
        ).not.toBeNull();
        expect(
          found?.showing ?? 0,
          'px of it showing left of Next',
        ).toBeGreaterThan(20);
        const card = row.locator('li.card').nth(found?.at ?? 0);
        const place = await placeOf(card);
        await page.mouse.click(found?.x ?? 0, found?.y ?? 0, { delay: 120 });
        await expect(card).toHaveAttribute('data-flipped', '');
        await expect.poll(() => focusIs(page)).toBe(`${place} play`);
        await expect(page.locator('li.card[data-flipped]')).toHaveCount(1);
        await atRest(list);
        const strip = await list.boundingBox();
        const box = await card.boundingBox();
        expect(box?.x ?? 0, 'brought in at its left').toBeGreaterThanOrEqual(
          (strip?.x ?? 0) - 1,
        );
        expect(
          (box?.x ?? 0) + (box?.width ?? 0),
          'brought in at its right',
        ).toBeLessThanOrEqual((strip?.x ?? 0) + (strip?.width ?? 0) + 1);
      });
});

test.describe('the keyboard', () => {
  /** Real Tab presses until focus is on this card's flip button. */
  async function tabToFlip(page: Page, card: Locator): Promise<void> {
    const place = await placeOf(card);
    for (let pressed = 0; pressed < 60; pressed += 1) {
      await page.keyboard.press('Tab');
      if ((await focusIs(page)) === `${place} flip`) return;
    }
    throw new Error(`Tab never reached the flip button of card ${place}`);
  }

  /** The ring round the whole card is drawn: its outline is 2px or more and not clear. */
  function ringed(card: Locator): Promise<boolean> {
    return card.evaluate((el) => {
      const style = getComputedStyle(el);
      return (
        style.outlineStyle !== 'none' &&
        parseFloat(style.outlineWidth) >= 2 &&
        style.outlineColor !== 'rgba(0, 0, 0, 0)'
      );
    });
  }

  test('Tab reaches the flip button, ringed round the card; Enter flips it with focus on Play, ringed, and opens nothing', async ({
    page,
    context,
  }) => {
    const asked = await ready(page);
    const card = cardAt(page, 1);
    const place = await placeOf(card);
    await tabToFlip(page, card);
    expect(await ringed(card)).toBe(true);
    await page.keyboard.press('Enter');
    await expect(card).toHaveAttribute('data-flipped', '');
    await expect.poll(() => focusIs(page)).toBe(`${place} play`);
    expect(
      await card
        .locator('a.card-link')
        .evaluate((el) => el.matches(':focus-visible')),
    ).toBe(true);
    expect(await ringed(card)).toBe(true);
    expect(await showsBack(card, true)).toBeGreaterThan(2);
    expect(context.pages().length).toBe(1);
    expect(asked).toEqual([]);
  });

  test('Tab on from Play is Close, then the next card’s flip button: the turned-away front is not a stop', async ({
    page,
  }) => {
    await ready(page);
    const card = cardAt(page, 1);
    const place = await placeOf(card);
    await tabToFlip(page, card);
    await page.keyboard.press('Enter');
    await expect.poll(() => focusIs(page)).toBe(`${place} play`);
    await page.keyboard.press('Tab');
    expect(await focusIs(page)).toBe(`${place} close`);
    await page.keyboard.press('Tab');
    expect(await focusIs(page)).toBe(`${place + 1} flip`);
    // And back: Close, then Play, and never the front's flip button.
    await page.keyboard.press('Shift+Tab');
    expect(await focusIs(page)).toBe(`${place} close`);
    await page.keyboard.press('Shift+Tab');
    expect(await focusIs(page)).toBe(`${place} play`);
    await page.keyboard.press('Shift+Tab');
    expect(await focusIs(page)).not.toBe(`${place} flip`);
  });

  test('Escape turns it back, with focus on its flip button, ringed', async ({
    page,
  }) => {
    await ready(page);
    const card = cardAt(page, 1);
    const place = await placeOf(card);
    await tabToFlip(page, card);
    await page.keyboard.press('Enter');
    await expect(card).toHaveAttribute('data-flipped', '');
    await page.keyboard.press('Escape');
    await expect(card).not.toHaveAttribute('data-flipped', '');
    await expect.poll(() => focusIs(page)).toBe(`${place} flip`);
    expect(await ringed(card)).toBe(true);
    expect(await showsFront(card)).toBeGreaterThan(2);
  });

  test('Enter on Close turns it back, with focus on its flip button', async ({
    page,
  }) => {
    await ready(page);
    const card = cardAt(page, 1);
    const place = await placeOf(card);
    await tabToFlip(page, card);
    await page.keyboard.press('Enter');
    await page.keyboard.press('Tab');
    expect(await focusIs(page)).toBe(`${place} close`);
    await page.keyboard.press('Enter');
    await expect(card).not.toHaveAttribute('data-flipped', '');
    expect(await focusIs(page)).toBe(`${place} flip`);
  });

  test('Enter on the next card’s flip button turns the first back and sends focus to the second’s Play', async ({
    page,
  }) => {
    await ready(page);
    const card = cardAt(page, 1);
    const place = await placeOf(card);
    await tabToFlip(page, card);
    await page.keyboard.press('Enter');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    expect(await focusIs(page)).toBe(`${place + 1} flip`);
    await page.keyboard.press('Enter');
    await expect.poll(() => focusIs(page)).toBe(`${place + 1} play`);
    expect(await flipped(page)).toEqual([place + 1]);
  });

  test('Enter on Play opens the game in one new window and leaves the card flipped', async ({
    page,
    context,
  }) => {
    const asked = await ready(page);
    const card = cardAt(page, 1);
    const href = new URL(
      (await card.locator('a.card-link').getAttribute('href')) ?? '',
    ).href;
    await tabToFlip(page, card);
    await page.keyboard.press('Enter');
    await expect.poll(() => focusIs(page)).toMatch(/ play$/);
    const opened = context.waitForEvent('page');
    await page.keyboard.press('Enter');
    const popup = await opened;
    await expect.poll(() => asked).toEqual([href]);
    expect(context.pages().length).toBe(2);
    await expect(card).toHaveAttribute('data-flipped', '');
    await popup.close();
  });

  test('Escape with focus gone from the flipped card turns it back and leaves focus where it is', async ({
    page,
  }) => {
    await ready(page);
    const card = cardAt(page, 1);
    const place = await placeOf(card);
    await tabToFlip(page, card);
    await page.keyboard.press('Enter');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    expect(await focusIs(page)).toBe(`${place + 1} flip`);
    await page.keyboard.press('Escape');
    await expect(card).not.toHaveAttribute('data-flipped', '');
    expect(await focusIs(page)).toBe(`${place + 1} flip`);
  });
});

test.describe('a card with no address', () => {
  // No row of the catalogue mixes linked and unlinked cards, so one is made in
  // the page, as lights.spec.ts makes one: the second card of the first row
  // loses its link and its mark, as an entry with no address has. The page's
  // script reads the link at the press, so the card it set up is the card.
  async function bare(page: Page): Promise<Locator> {
    const card = cardAt(page, 1);
    await card.evaluate((el) => {
      el.removeAttribute('data-linked');
      el.querySelector('a.card-link')?.remove();
    });
    await expect(card.locator('a.card-link')).toHaveCount(0);
    return card;
  }

  test('flips with no Play: focus goes to Close, and Escape turns it back', async ({
    page,
  }) => {
    await ready(page);
    const card = await bare(page);
    const place = await placeOf(card);
    await clickFront(page, card);
    await expect(card).toHaveAttribute('data-flipped', '');
    await expect.poll(() => focusIs(page)).toBe(`${place} close`);
    expect(await showsBack(card, false)).toBeGreaterThan(2);
    await page.keyboard.press('Escape');
    await expect(card).not.toHaveAttribute('data-flipped', '');
    expect(await focusIs(page)).toBe(`${place} flip`);
  });

  test('a card of the catalogue with no address flips the same way', async ({
    page,
  }) => {
    await ready(page);
    const card = page.locator('main li.card:not([data-linked])').first();
    await expect(card).toHaveCount(1);
    const place = await placeOf(card);
    await clickFront(page, card);
    await expect(card).toHaveAttribute('data-flipped', '');
    await expect.poll(() => focusIs(page)).toBe(`${place} close`);
    expect(await showsBack(card, false)).toBeGreaterThan(2);
    const at = await descriptionMiddle(card);
    await page.mouse.click(at.x, at.y);
    await expect(card).not.toHaveAttribute('data-flipped', '');
  });
});

test.describe('on a touch screen', () => {
  test.use({
    hasTouch: true,
    isMobile: true,
    viewport: { width: 390, height: 844 },
  });

  test('a tap flips a card and opens nothing; a tap on its back outside Play turns it back', async ({
    page,
    context,
  }) => {
    const asked = await ready(page);
    const card = cardAt(page, 0);
    const place = await placeOf(card);
    const front = await pictureMiddle(card);
    await page.touchscreen.tap(front.x, front.y);
    await expect(card).toHaveAttribute('data-flipped', '');
    await expect.poll(() => focusIs(page)).toBe(`${place} play`);
    expect(await showsBack(card, true)).toBeGreaterThan(2);
    expect(context.pages().length).toBe(1);
    expect(asked).toEqual([]);
    const back = await descriptionMiddle(card);
    await page.touchscreen.tap(back.x, back.y);
    await expect(card).not.toHaveAttribute('data-flipped', '');
    expect(await showsFront(card)).toBeGreaterThan(2);
    expect(context.pages().length).toBe(1);
    expect(asked).toEqual([]);
  });

  test('a tap on Play opens the game in one new window', async ({
    page,
    context,
  }) => {
    const asked = await ready(page);
    const card = cardAt(page, 0);
    const href = new URL(
      (await card.locator('a.card-link').getAttribute('href')) ?? '',
    ).href;
    const front = await pictureMiddle(card);
    await page.touchscreen.tap(front.x, front.y);
    await expect(card).toHaveAttribute('data-flipped', '');
    await settled(card);
    const box = await card.locator('a.card-link').boundingBox();
    expect(box).not.toBeNull();
    const opened = context.waitForEvent('page');
    await page.touchscreen.tap(
      (box?.x ?? 0) + (box?.width ?? 0) / 2,
      (box?.y ?? 0) + (box?.height ?? 0) / 2,
    );
    const popup = await opened;
    await expect.poll(() => asked).toEqual([href]);
    expect(context.pages().length).toBe(2);
    await popup.close();
  });
});

test.describe('motion', () => {
  /** The transitions running on a card's faces now. */
  function turning(card: Locator): Promise<number> {
    return card.evaluate(
      (el) =>
        [...el.querySelectorAll('.face')].flatMap((face) =>
          face.getAnimations(),
        ).length,
    );
  }

  test('with reduced motion the faces swap at once: no transition, nothing running', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await ready(page);
    const card = cardAt(page, 1);
    const faces = card.locator('.face');
    expect(await faces.count()).toBe(2);
    await clickFront(page, card);
    await expect(card).toHaveAttribute('data-flipped', '');
    expect(await turning(card)).toBe(0);
    for (const face of await faces.all())
      expect(
        await face.evaluate((el) => getComputedStyle(el).transitionDuration),
      ).toBe('0s');
    // The back faces the reader, and the front is turned away, at once.
    expect(
      await card
        .locator('.face.back')
        .evaluate((el) => getComputedStyle(el).transform),
    ).toMatch(/^(none|matrix\(1, 0, 0, 1, 0, 0\))$/);
  });

  test('with no preference the faces turn over the token’s time once pressed, and not when script sets the cards up', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await ready(page);
    // Set up, no face of any card turned: a turn then would show every back
    // for a moment over its front.
    expect(
      await page.evaluate(
        () =>
          [...document.querySelectorAll('li.card .face')].flatMap((face) =>
            face.getAnimations(),
          ).length,
      ),
    ).toBe(0);
    const card = cardAt(page, 1);
    const token = await page.evaluate(() =>
      getComputedStyle(document.documentElement)
        .getPropertyValue('--duration-flip')
        .trim(),
    );
    // The built stylesheet is minified, so the token may read ".45s".
    expect(token).toMatch(/^\d*\.?\d+m?s$/);
    await clickFront(page, card);
    await expect(card).toHaveAttribute('data-flipped', '');
    expect(await turning(card)).toBeGreaterThan(0);
    const face = card.locator('.face.front');
    const style = await face.evaluate((el) => ({
      property: getComputedStyle(el).transitionProperty,
      duration: getComputedStyle(el).transitionDuration,
    }));
    expect(style.property.split(',').map((each) => each.trim())).toContain(
      'transform',
    );
    expect(parseFloat(style.duration) * 1000).toBe(
      token.endsWith('ms') ? parseFloat(token) : parseFloat(token) * 1000,
    );
  });
});

test.describe('a card in a late row', () => {
  test('flips before its picture has come and after, and its front keeps one picture', async ({
    page,
  }) => {
    // The late rows' pictures are held at a route until let go, so that the
    // card is flipped while its frame is still waiting.
    let release: () => void = () => undefined;
    const gate = new Promise<void>((done) => {
      release = done;
    });
    const late = catalogue.rows.slice(2).flatMap((row) => row.entries);
    expect(late.length).toBeGreaterThan(0);
    await page.route(/\/_astro\/.*\.(avif|webp|jpe?g|png)$/, async (route) => {
      const path = new URL(route.request().url()).pathname;
      if (late.some((id) => path.startsWith(`/_astro/${id}.`))) await gate;
      await route.continue().catch(() => undefined);
    });
    const row = catalogue.rows[2];
    if (row === undefined) throw new Error('no late row');
    // Opened at the top and then scrolled to the row, so that the pictures
    // held are asked for after the page's load and do not hold it up.
    await ready(page);
    await page.locator(`section[id="${row.id}"]`).scrollIntoViewIfNeeded();
    const card = page.locator(`section[id="${row.id}"] li.card`).first();
    const image = card.locator('.frame img').first();
    // Asked for, and not come.
    await expect(card.locator('img[data-src]')).toHaveCount(0);
    expect(await image.getAttribute('data-arrived')).toBeNull();
    const linked = (await card.getAttribute('data-linked')) !== null;
    await clickFront(page, card);
    await expect(card).toHaveAttribute('data-flipped', '');
    expect(await showsBack(card, linked)).toBeGreaterThan(2);
    await page.keyboard.press('Escape');
    await expect(card).not.toHaveAttribute('data-flipped', '');

    release();
    await expect(image).toHaveAttribute('data-arrived', '');
    expect(
      await image.evaluate((el: HTMLImageElement) => el.naturalWidth),
    ).toBeGreaterThan(0);
    await clickFront(page, card);
    await expect(card).toHaveAttribute('data-flipped', '');
    expect(await showsBack(card, linked)).toBeGreaterThan(2);
    await page.keyboard.press('Escape');
    await expect(card).not.toHaveAttribute('data-flipped', '');
    expect(await showsFront(card)).toBeGreaterThan(2);
  });
});

test.describe('at a phone’s width with the text spacing of WCAG 1.4.12', () => {
  // The spacing is a style the test adds, which the page's content policy
  // would refuse, so the policy is stood aside here, as reflow.spec.ts does.
  test.use({ viewport: { width: 390, height: 844 }, bypassCSP: true });

  test('a flipped card holds all its words: nothing sticks out of it or is cut off, and its row is level', async ({
    page,
  }) => {
    await ready(page);
    await page.addStyleTag({ content: SPACING });
    let reached = 0;
    for (const at of [0, 1, 2]) {
      const card = cardAt(page, at);
      await clickFront(page, card);
      await expect(card).toHaveAttribute('data-flipped', '');
      // Measured with the mouse gone and once the turn is over: part way, the
      // perspective draws the nearer edge larger than the card, and a best card
      // under the mouse tilts toward it (shine.spec.ts holds that), which are a
      // turn and a tilt and not a fault of the spacing.
      await page.mouse.move(0, 0);
      await expect
        .poll(() =>
          card.evaluate((el: HTMLElement) =>
            el.style.getPropertyValue('--tilt-y'),
          ),
        )
        .toBe('');
      await settled(card);
      const found = await card.evaluate((el) => {
        const problems: string[] = [];
        const card = el.getBoundingClientRect();
        const back = el.querySelector('.face.back');
        if (back === null) return { problems: ['no back'], checked: 0 };
        let checked = 0;
        for (const part of [back, ...back.querySelectorAll('*')]) {
          if (part.closest('.visually-hidden') !== null) continue;
          const box = part.getBoundingClientRect();
          if (box.width === 0 && box.height === 0) continue;
          checked += 1;
          const name = `${part.tagName.toLowerCase()}.${part.className}`;
          if (
            box.left < card.left - 1 ||
            box.right > card.right + 1 ||
            box.top < card.top - 1 ||
            box.bottom > card.bottom + 1
          )
            problems.push(`${name} sticks out of the card`);
          const style = getComputedStyle(part);
          if (
            style.overflowY !== 'visible' &&
            part.scrollHeight > part.clientHeight + 1
          )
            problems.push(`${name} cuts its words off`);
        }
        return { problems, checked };
      });
      expect(found.problems, `card ${at}`).toEqual([]);
      expect(found.checked).toBeGreaterThan(4);
      reached += found.checked;
    }
    // The cards of the row stand level: each as tall as the tallest.
    const heights = await firstRow(page)
      .locator('li.card')
      .evaluateAll((all) =>
        all.map((el) => Math.round(el.getBoundingClientRect().height)),
      );
    expect(new Set(heights).size).toBe(1);
    expect(reached).toBeGreaterThan(12);
  });
});

test.describe('nothing grows', () => {
  test('no grown card is ever in the page, after a mouse held on a card and a focus held on one past 600ms, and neither makes a video short of it', async ({
    page,
  }) => {
    // Every element added to the page is looked at as it comes, so that one
    // made and taken down between two looks is still seen.
    await page.addInitScript(() => {
      const seen: string[] = [];
      Reflect.set(window, '__grown', seen);
      new MutationObserver((records) => {
        for (const record of records) {
          if (
            record.type === 'attributes' &&
            record.attributeName === 'data-grown'
          )
            seen.push('data-grown');
          for (const node of record.addedNodes)
            if (
              node instanceof Element &&
              (node.matches('.grown') || node.querySelector('.grown') !== null)
            )
              seen.push(node.className || node.tagName);
        }
      }).observe(document, {
        subtree: true,
        childList: true,
        attributes: true,
        attributeFilter: ['data-grown'],
      });
    });
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.clock.install({ time: DAY_ZERO });
    await ready(page);
    await page.clock.pauseAt(DAY_ZERO + 1000);
    const step = async (ms: number) => {
      for (let done = 0; done < ms; done += FRAME)
        await page.clock.runFor(FRAME);
    };
    const card = cardAt(page, 1);
    const at = await pictureMiddle(card, true);
    await page.mouse.move(at.x, at.y);
    expect(await card.evaluate((el) => el.matches(':hover'))).toBe(true);
    // A card's loop may play once the reader has settled on it (part 4), and
    // never sooner: a hover alone, short of the settle time, makes no video.
    await step(560);
    await expect(page.locator('section.row video')).toHaveCount(0);
    await step(240);
    await expect(page.locator('.grown')).toHaveCount(0);
    await page.mouse.move(5, 5);
    const next = cardAt(page, 2);
    const place = await placeOf(next);
    for (let pressed = 0; pressed < 60; pressed += 1) {
      await page.keyboard.press('Tab');
      if ((await focusIs(page)) === `${place} flip`) break;
    }
    expect(
      await next
        .locator('button.card-flip')
        .evaluate((el) => el.matches(':focus-visible')),
    ).toBe(true);
    await step(560);
    await expect(page.locator('section.row video')).toHaveCount(0);
    await step(240);
    await expect(page.locator('.grown, [data-grown]')).toHaveCount(0);
    expect(
      await page.evaluate(() => Reflect.get(window, '__grown') as string[]),
    ).toEqual([]);
    // Neither the hover nor the focus flipped anything: a flip is a press.
    expect(await flipped(page)).toEqual([]);
  });
});

// A card is one size whether it is flipped or not (the owner, 2026-11-23: "It'd
// be better if cards didn't change height (or size)"), and since a row's cards
// are as tall as its tallest back, the front's picture takes up the room that
// is left over, so that no front stands over empty ground under its title. On a
// phone the back is kept short: it does not repeat the label and the title, and
// Play says "Play" on one line, its name unchanged. Every card on the page is
// measured; nothing here is a figure typed in, but what the page says.
test.describe('a card keeps one size', () => {
  /** The size of every card in a row, in the row's order. */
  function sizes(row: Locator): Promise<{ width: number; height: number }[]> {
    return row.locator('li.card').evaluateAll((all) =>
      all.map((el) => {
        const box = el.getBoundingClientRect();
        return { width: box.width, height: box.height };
      }),
    );
  }

  /** Each size within half a pixel of the one it is held to. */
  function same(
    now: { width: number; height: number }[],
    was: { width: number; height: number }[],
    what: string,
  ): void {
    expect(now.length, what).toBe(was.length);
    now.forEach((size, at) => {
      const before = was[at];
      expect(
        Math.abs(size.width - (before?.width ?? -1)),
        `${what}, card ${at} wide`,
      ).toBeLessThanOrEqual(0.5);
      expect(
        Math.abs(size.height - (before?.height ?? -1)),
        `${what}, card ${at} tall`,
      ).toBeLessThanOrEqual(0.5);
    });
  }

  for (const width of [1440, 390]) {
    test.describe(`at ${width} wide`, () => {
      test.use({ viewport: { width, height: width > 800 ? 1000 : 844 } });

      test('every card is the same size before it is flipped, while it is, and after, and so is every other card in its row', async ({
        page,
      }) => {
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await ready(page);
        let reached = 0;
        for (const row of await page.locator('section.row').all()) {
          const rest = await sizes(row);
          const cards = row.locator('li.card');
          for (let at = 0; at < (await cards.count()); at += 1) {
            const card = cards.nth(at);
            await card.locator('button.card-flip').focus();
            await page.keyboard.press('Enter');
            await expect(card).toHaveAttribute('data-flipped', '');
            same(await sizes(row), rest, `card ${at} flipped`);
            await page.keyboard.press('Escape');
            await expect(card).not.toHaveAttribute('data-flipped', '');
            same(await sizes(row), rest, `card ${at} turned back`);
            reached += 1;
          }
        }
        expect(reached).toBe(
          catalogue.rows.reduce((sum, row) => sum + row.entries.length, 0),
        );
      });

      test('at rest no front stands over empty ground, and every picture fills a frame no shorter than 16 by 9', async ({
        page,
      }) => {
        await ready(page);
        const found = await page.locator('main li.card').evaluateAll((all) =>
          all.map((card) => {
            const title = card.querySelector('.front .card-title');
            const frame = card.querySelector('.front .frame');
            const image = frame?.querySelector('img');
            if (!title || !frame || !image) return { problems: ['parts'] };
            const problems: string[] = [];
            const under = parseFloat(getComputedStyle(title).marginBottom);
            const ground =
              card.getBoundingClientRect().bottom -
              title.getBoundingClientRect().bottom;
            if (!(under >= 0) || ground > under + 0.5)
              problems.push(
                `${ground}px under the title, where ${under} is given`,
              );
            const box = frame.getBoundingClientRect();
            // Nor between the picture and the label: the room left over is
            // the picture's, and not a gap above the words.
            const label = card.querySelector('.front .label');
            const over = label
              ? parseFloat(getComputedStyle(label).marginTop)
              : NaN;
            const gap =
              (label?.getBoundingClientRect().top ?? NaN) - box.bottom;
            if (!(over >= 0) || !(gap <= over + 0.5))
              problems.push(`${gap}px over the label, where ${over} is given`);
            if (box.height < (box.width * 9) / 16 - 0.5)
              problems.push(`a frame ${box.width} by ${box.height}`);
            const drawn = image.getBoundingClientRect();
            for (const side of ['left', 'top', 'right', 'bottom'] as const)
              if (Math.abs(drawn[side] - box[side]) > 0.5)
                problems.push(`the picture's ${side} is not the frame's`);
            if (getComputedStyle(image).objectFit !== 'cover')
              problems.push('the picture does not cover');
            return { problems };
          }),
        );
        expect(found.length).toBe(
          catalogue.rows.reduce((sum, row) => sum + row.entries.length, 0),
        );
        found.forEach((card, at) =>
          expect(card.problems, `card ${at}`).toEqual([]),
        );
      });

      // The Play link is the back's tallest thing in its foot, and the back is
      // what sets a row's height, so a Play link taller than it need be makes
      // every card in its row taller and crops each front's picture to fill
      // it. It is the target size, or as tall as its one line of words and
      // its own padding and edge, whichever is more, and level with Close.
      // The figures are the page's own computed styles, none typed here.
      test('every flipped card’s Play link is the target size or one line of its words and padding tall, and level with Close', async ({
        page,
      }) => {
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await ready(page);
        let reached = 0;
        let looked = 0;
        for (const card of await page.locator('main li.card').all()) {
          looked += 1;
          if ((await card.locator('a.card-link').count()) === 0) continue;
          await card.locator('button.card-flip').focus();
          await page.keyboard.press('Enter');
          await expect(card).toHaveAttribute('data-flipped', '');
          await settled(card);
          const found = await card.evaluate((el) => {
            const play = el.querySelector<HTMLElement>('a.card-link');
            const close = el.querySelector<HTMLElement>('button.card-unflip');
            if (!play || !close) return null;
            const style = getComputedStyle(play);
            const words = play.firstElementChild?.getBoundingClientRect();
            const px = (value: string) => parseFloat(value) || 0;
            const line = parseFloat(style.lineHeight);
            const box = play.getBoundingClientRect();
            const shut = close.getBoundingClientRect();
            return {
              target: px(getComputedStyle(close).width),
              height: box.height,
              width: box.width,
              // One line of its words: the computed line height, or where
              // that is "normal", the height its words' box is drawn.
              need:
                (Number.isNaN(line) ? (words?.height ?? 0) : line) +
                px(style.paddingTop) +
                px(style.paddingBottom) +
                px(style.borderTopWidth) +
                px(style.borderBottomWidth),
              top: box.top - shut.top,
              bottom: box.bottom - shut.bottom,
              closeHeight: shut.height,
            };
          });
          expect(found, 'Play and Close are both there').not.toBeNull();
          if (!found) continue;
          const what = `card ${reached}`;
          expect(found.target, `${what}: the target size`).toBeGreaterThan(40);
          expect(found.height, `${what} tall`).toBeGreaterThanOrEqual(
            found.target - 0.5,
          );
          expect(found.width, `${what} wide`).toBeGreaterThanOrEqual(
            found.target - 0.5,
          );
          expect(
            found.height,
            `${what} tall, against one line and its padding`,
          ).toBeLessThanOrEqual(Math.max(found.need, found.target) + 0.5);
          const apart = Math.abs(found.height - found.closeHeight) + 0.5;
          expect(Math.abs(found.top), `${what}'s top`).toBeLessThanOrEqual(
            apart,
          );
          expect(
            Math.abs(found.bottom),
            `${what}'s bottom`,
          ).toBeLessThanOrEqual(apart);
          await page.keyboard.press('Escape');
          await expect(card).not.toHaveAttribute('data-flipped', '');
          reached += 1;
        }
        // Every card of the catalogue was looked at, and every one with a
        // link was measured: the cards with none have no Play to hold.
        expect(looked).toBe(
          catalogue.rows.reduce((sum, row) => sum + row.entries.length, 0),
        );
        expect(reached).toBeGreaterThan(0);
        expect(reached).toBe(
          await page.locator('main li.card a.card-link').count(),
        );
      });
    });
  }

  // On each side of the phone's two steps: below 21.25rem a card is the
  // window's width and its back is as it was, repeat and all; from there to
  // 40rem the back drops the repeat and Play says "Play"; above it the back is
  // whole again.
  for (const [width, short] of [
    [320, false],
    [339, false],
    [341, true],
    [390, true],
    [640, true],
    [641, false],
  ] as const) {
    test(`at ${width} wide a flipped card’s back ${short ? 'has no label or title of its own, and Play is one line with its name' : 'repeats its label and title'}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 844 });
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await ready(page);
      let reached = 0;
      for (const card of await page.locator('main li.card').all()) {
        await card.locator('button.card-flip').focus();
        await page.keyboard.press('Enter');
        await expect(card).toHaveAttribute('data-flipped', '');
        const label = (
          (await card.locator('.front .label').textContent()) ?? ''
        ).trim();
        const title = (
          (await card.locator('.front h3').textContent()) ?? ''
        ).trim();
        const repeat = card.locator('.back [data-repeat]');
        expect(await repeat.count()).toBe(2);
        const tree = (await inTree(card.locator('.face.back'))).map((each) =>
          each.toLowerCase(),
        );
        for (const words of [label, title]) {
          const said = tree.includes(`statictext: ${words.toLowerCase()}`);
          expect(said, `${words} in the back's tree`).toBe(!short);
        }
        for (const each of await repeat.all())
          if (short) await expect(each).toBeHidden();
          else await expect(each).toBeVisible();
        const play = card.locator('a.card-link');
        if ((await play.count()) === 1) {
          await expect(play).toHaveAccessibleName(
            `Play ${title} (opens in a new window)`,
          );
          const drawn = ((await play.innerText()) ?? '').trim();
          if (short) {
            expect(drawn).toBe('Play');
            const lines = await play.evaluate((el) => {
              const style = getComputedStyle(el);
              const words = el.firstElementChild?.getBoundingClientRect();
              // The box less its padding and edge: what its words take, or
              // the least height a button is given, whichever is more.
              const inner =
                el.getBoundingClientRect().height -
                parseFloat(style.paddingTop) -
                parseFloat(style.paddingBottom) -
                parseFloat(style.borderTopWidth) -
                parseFloat(style.borderBottomWidth);
              return {
                line: parseFloat(style.lineHeight),
                least: parseFloat(style.minHeight) || 0,
                inner,
                words: words?.height ?? -1,
              };
            });
            expect(lines.words).toBeGreaterThan(0);
            expect(lines.words).toBeLessThan(lines.line * 1.5);
            expect(lines.inner).toBeLessThanOrEqual(
              Math.max(lines.line, lines.least) + 0.5,
            );
          } else expect(drawn).toBe(`Play ${title}`);
        }
        await page.keyboard.press('Escape');
        await expect(card).not.toHaveAttribute('data-flipped', '');
        reached += 1;
      }
      expect(reached).toBe(
        catalogue.rows.reduce((sum, row) => sum + row.entries.length, 0),
      );
    });
  }
});

// A card flipped where an arrow press left it: its back's words lie where its
// picture was, so an arrow over the card's left would stand over the start of
// every line of them. On a phone a press of Next used to leave the card it
// came to with its left 38px under Previous. After a real click on Next, the
// first linked card wholly in the window is flipped, and each line of its
// description, its Play link and its Close button are measured clear of both
// arrows, with motion allowed (once the turn has finished) and under reduced
// motion (at once).
test.describe('a card flipped where an arrow press left it', () => {
  for (const width of [640, 390])
    for (const motion of ['no-preference', 'reduce'] as const)
      test(`at ${width} wide, motion ${motion}: its words, Play and Close are clear of both arrows`, async ({
        page,
      }) => {
        await page.setViewportSize({ width, height: 844 });
        await page.emulateMedia({ reducedMotion: motion });
        await ready(page);
        const row = firstRow(page);
        const list = row.getByRole('list');
        await list.scrollIntoViewIfNeeded();
        await untilScrolled(list, () =>
          row.getByRole('button', { name: /^Next/ }).click(),
        );
        await atRest(list);
        const place = await row.locator('li.card').evaluateAll((all) => {
          const view = all[0]?.closest('ul')?.getBoundingClientRect();
          if (view === undefined) return -1;
          return all.findIndex((card) => {
            const box = card.getBoundingClientRect();
            return (
              box.left >= view.left - 1 &&
              box.right <= view.right + 1 &&
              card.querySelector('a.card-link') !== null
            );
          });
        });
        expect(place, 'a linked card is wholly in the window').toBeGreaterThan(
          0,
        );
        const card = cardAt(page, place);
        await card.locator('button.card-flip').click();
        await expect(card).toHaveAttribute('data-flipped', '');
        await settled(card);
        await atRest(list);
        const words = await partsUnderArrows(
          card.locator('.back .description'),
          true,
        );
        expect(words.seen, 'lines of the description').toBeGreaterThan(1);
        expect(words.under).toEqual([]);
        const buttons = await partsUnderArrows(
          card.locator('.back a.card-link, .back button.card-unflip'),
        );
        expect(buttons.seen, 'Play and Close').toBe(2);
        expect(buttons.under).toEqual([]);
        // And Previous is showing, so that there is an arrow to be under.
        await expect(
          row.getByRole('button', { name: /^Previous/ }),
        ).toBeVisible();
      });
});
