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
// nothing grows on a hover or a focus held past the old pause. Every control
// is worked as a reader works it: a real click, a real tap in a context with
// touch, a real Tab and Enter, a real Escape. Every address outside the site is
// routed, recorded and aborted, so that no test leaves it. What is in the
// accessibility tree is asked of the browser itself (tree.ts). Each test
// counts what it reached.
import { expect, type Locator, type Page } from '@playwright/test';
import { DAY_ZERO, test } from '../clock';
import { readRows } from './catalogue';
import { atRest } from './scrolling';
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
      // Measured once the turn is over: part way, the perspective draws the
      // nearer edge larger than the card, which is the turn and not a fault.
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
  test('no grown card is ever in the page, after a mouse held on a card and a focus held on one past 600ms', async ({
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
              (node.matches('.grown, video:not(.hero-loop)') ||
                node.querySelector('.grown') !== null)
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
    await step(800);
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
    await step(800);
    await expect(page.locator('.grown, [data-grown]')).toHaveCount(0);
    expect(
      await page.evaluate(() => Reflect.get(window, '__grown') as string[]),
    ).toEqual([]);
    // Neither the hover nor the focus flipped anything: a flip is a press.
    expect(await flipped(page)).toEqual([]);
  });
});
