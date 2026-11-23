// Holds the phone layout the owner chose on 2026-11-23 from a mock on the built
// page: rows that scroll sideways at every width and every text size, never
// stacking (the owner's decision, over WCAG 1.4.10's reflow at 320; see
// CLAUDE.md's Keeps); small cards with square pictures, about two and a half to a row at a
// phone's default text, that grow with the reader's text so that no word is
// broken; a card's back that opens as a sheet at the foot of the screen, so
// that every card stays its own small size; and no row arrows on a touch
// screen, where a swipe is the way along. The reader's text size is the
// browser's own standard font size, set through the browser as a phone's
// text-size setting sets it. Each test counts what it reached.
import { expect, type Page } from '@playwright/test';
import { test } from '../clock';
import { readRows } from './catalogue';

const catalogue = readRows();

const PHONE = { isMobile: true, hasTouch: true } as const;

/** The page at a reader's text size, with script run. */
async function ready(page: Page, text = 16): Promise<void> {
  const browser = await page.context().newCDPSession(page);
  await browser.send('Page.enable');
  await browser.send('Page.setFontSizes', {
    fontSizes: { standard: text, fixed: 13 },
  });
  await page.goto('/');
  await expect(page.locator('section.row[data-arrows]').first()).toBeAttached();
  await expect(page.locator('li.card:not([data-flips])')).toHaveCount(0);
}

test.describe('a phone’s rows never stack', () => {
  // On a touch screen at every width and text size; and with a mouse, where
  // the row's arrows are drawn and its cards are kept clear of them (rows.ts,
  // paging.ts's trim()), never narrower than their words need: at 320 a
  // desk's window zoomed to 400% is a mouse's.
  const cases = [
    ...[320, 339, 360, 390, 412].flatMap((width) =>
      [16, 20, 24].map((text) => ({ width, text, touch: true })),
    ),
    ...[320, 339, 390].flatMap((width) =>
      [16, 20].map((text) => ({ width, text, touch: false })),
    ),
  ];
  for (const { width, text, touch } of cases)
    test.describe(`at ${width} wide, text ${text}px, ${touch ? 'touch' : 'a mouse'}`, () => {
      test.use({
        ...(touch ? PHONE : {}),
        viewport: { width, height: 800 },
      });
      test('every row scrolls sideways, the page does not, and no word of a card is broken', async ({
        page,
      }) => {
        await ready(page, text);
        const found = await page.evaluate(() => {
          const rows = [...document.querySelectorAll('section.row')].map(
            (row) => {
              const strip = row.querySelector('.strip') as HTMLElement;
              const cards = [...row.querySelectorAll('li.card')];
              const tops = cards.map((card) =>
                Math.round(card.getBoundingClientRect().top),
              );
              return {
                id: row.id,
                direction: getComputedStyle(strip).flexDirection,
                scrolls: strip.scrollWidth > strip.clientWidth + 1,
                level: new Set(tops).size === 1,
                cards: cards.length,
              };
            },
          );
          // A word broken across two lines draws as two boxes.
          const broken: string[] = [];
          let words = 0;
          for (const part of document.querySelectorAll(
            'li.card .front :is(.label, .card-title)',
          )) {
            const text = part.firstChild;
            if (text === null || text.nodeType !== Node.TEXT_NODE) continue;
            const value = text.textContent ?? '';
            const range = document.createRange();
            for (const match of value.matchAll(/\S+/g)) {
              range.setStart(text, match.index);
              range.setEnd(text, match.index + match[0].length);
              words += 1;
              if (range.getClientRects().length > 1) broken.push(match[0]);
            }
          }
          return {
            rows,
            broken,
            words,
            page:
              document.documentElement.scrollWidth <=
              document.documentElement.clientWidth + 1,
          };
        });
        expect(found.rows.length).toBe(catalogue.rows.length);
        for (const row of found.rows) {
          expect(row.direction, row.id).toBe('row');
          expect(row.level, `${row.id}: its cards side by side`).toBe(true);
          if (row.cards > 2) expect(row.scrolls, row.id).toBe(true);
        }
        expect(found.page, 'the page scrolls sideways').toBe(true);
        expect(found.words).toBeGreaterThan(20);
        expect(found.broken, 'words broken across lines').toEqual([]);
      });
    });
});

test.describe('a phone’s cards', () => {
  test.use({ ...PHONE, viewport: { width: 390, height: 844 } });

  test('are small cards with square pictures, more than two to a row at the default text, and grow with the text', async ({
    page,
  }) => {
    for (const text of [16, 20]) {
      await ready(page, text);
      const found = await page.evaluate(() => {
        const row = document.querySelector('section.row') as HTMLElement;
        const strip = row.querySelector('.strip') as HTMLElement;
        const window = strip.getBoundingClientRect();
        const cards = [...row.querySelectorAll('li.card')];
        const frame = cards[0]?.querySelector('.front .frame');
        const box = frame?.getBoundingClientRect();
        return {
          root: parseFloat(getComputedStyle(document.documentElement).fontSize),
          width: cards[0]?.getBoundingClientRect().width ?? 0,
          frame: { width: box?.width ?? 0, height: box?.height ?? 0 },
          whole: cards.filter((card) => {
            const each = card.getBoundingClientRect();
            return (
              each.left >= window.left - 1 && each.right <= window.right + 1
            );
          }).length,
          showing: cards.filter((card) => {
            const each = card.getBoundingClientRect();
            return each.left < window.right && each.right > window.left;
          }).length,
        };
      });
      // max(36vw, 7.75rem): the larger of a share of the window and a size
      // that grows with the reader's text.
      const wanted = Math.max(0.36 * 390, 7.75 * found.root);
      expect(found.width, `text ${text}`).toBeCloseTo(wanted, 0);
      // Square (the owner, 2026-11-23): a 3 by 4 frame made a card too tall
      // for its width; it grows past square only where a row's longer label
      // or title leaves it the room.
      expect(found.frame.height, `text ${text}: square`).toBeGreaterThanOrEqual(
        found.frame.width - 1,
      );
      expect(found.frame.height, `text ${text}: not portrait`).toBeLessThan(
        (found.frame.width * 4) / 3 - 1,
      );
      expect(found.whole, `text ${text}: whole cards`).toBeGreaterThanOrEqual(
        2,
      );
      if (text === 16)
        expect(found.showing, 'cards in sight at the default text').toBe(3);
    }
  });

  test('have no row arrows on a touch screen, and keep their page marks', async ({
    page,
  }) => {
    await ready(page);
    for (const each of catalogue.rows) {
      const section = page.locator(`section[id="${each.id}"]`);
      await expect(section.locator('button.row-arrow:visible')).toHaveCount(0);
    }
    await expect(
      page.locator('section.row').first().locator('.row-pages .page-mark'),
    ).not.toHaveCount(0);
  });
});

test.describe('a phone’s width with a mouse', () => {
  test.use({ viewport: { width: 390, height: 844 } });
  test('keeps the row arrows, the one way along for a mouse with no sideways wheel', async ({
    page,
  }) => {
    await ready(page);
    await expect(
      page.locator('section.row').first().locator('button.row-arrow:visible'),
    ).toHaveCount(1);
  });
});

test.describe('a phone card’s back is a sheet', () => {
  test.use({ ...PHONE, viewport: { width: 390, height: 844 } });

  const cardAt = (page: Page, at: number) =>
    page.locator('section.row').first().locator('li.card').nth(at);

  /** Where the back is, and what it shows, once it has finished rising. */
  const sheetOf = (page: Page, at: number) =>
    cardAt(page, at).evaluate(async (card) => {
      await Promise.all(
        card
          .getAnimations({ subtree: true })
          .map((each) => each.finished.catch(() => null)),
      );
      const back = card.querySelector('.face.back') as HTMLElement;
      const box = back.getBoundingClientRect();
      const words = (selector: string) =>
        [...back.querySelectorAll<HTMLElement>(selector)].every(
          (el) => el.getClientRects().length > 0,
        );
      const description = back
        .querySelector('.description')
        ?.getBoundingClientRect();
      const top =
        description === undefined
          ? null
          : document.elementFromPoint(
              description.left + description.width / 2,
              description.top + description.height / 2,
            );
      return {
        position: getComputedStyle(back).position,
        display: getComputedStyle(back).display,
        left: box.left,
        right: box.right,
        bottom: box.bottom,
        width: innerWidth,
        height: innerHeight,
        shown: words('[data-repeat]') && words('.description'),
        onTop: top !== null && back.contains(top),
        front: getComputedStyle(card.querySelector('.front') as Element)
          .transform,
        card: card.getBoundingClientRect().toJSON() as DOMRect,
      };
    });

  test('a tap opens it at the foot of the screen with every word, Play and Close; the card stays its size', async ({
    page,
  }) => {
    await ready(page);
    const card = cardAt(page, 1);
    const before = (await card.boundingBox()) ?? { width: 0, height: 0 };
    await card.locator('button.card-flip').tap();
    await expect(card).toHaveAttribute('data-flipped', '');
    const sheet = await sheetOf(page, 1);
    expect(sheet.position).toBe('fixed');
    expect(sheet.left).toBeCloseTo(0, 0);
    expect(sheet.right).toBeCloseTo(sheet.width, 0);
    expect(sheet.bottom).toBeCloseTo(sheet.height, 0);
    expect(sheet.shown).toBe(true);
    expect(sheet.onTop, 'nothing covers the sheet').toBe(true);
    expect(sheet.front).toBe('none');
    expect(sheet.card.width).toBeCloseTo(before.width, 0);
    expect(sheet.card.height).toBeCloseTo(before.height, 0);
    const title = (
      (await card.locator('.front .card-title').textContent()) ?? ''
    ).trim();
    const play = card.locator('a.card-link');
    await expect(play).toBeFocused();
    await expect(play).toHaveAccessibleName(
      `Play ${title} (opens in a new window)`,
    );
    expect(((await play.innerText()) ?? '').trim()).toBe(`Play ${title}`);
    await expect(card.locator('button.card-unflip')).toBeVisible();
  });

  test('Escape, Close and a tap on it outside Play each close it; another card’s tap swaps it', async ({
    page,
  }) => {
    await ready(page);
    const first = cardAt(page, 0);
    const second = cardAt(page, 1);
    let closed = 0;
    // Escape.
    await first.locator('button.card-flip').tap();
    await expect(first).toHaveAttribute('data-flipped', '');
    await page.keyboard.press('Escape');
    await expect(first).not.toHaveAttribute('data-flipped', '');
    expect((await sheetOf(page, 0)).display).toBe('none');
    closed += 1;
    // Close.
    await first.locator('button.card-flip').tap();
    await first.locator('button.card-unflip').tap();
    await expect(first).not.toHaveAttribute('data-flipped', '');
    closed += 1;
    // A tap on its description, once it has finished rising.
    await first.locator('button.card-flip').tap();
    await sheetOf(page, 0);
    const words = await first.locator('.back .description').boundingBox();
    if (words === null) throw new Error('the description is not drawn');
    await page.touchscreen.tap(
      words.x + words.width / 2,
      words.y + words.height / 2,
    );
    await expect(first).not.toHaveAttribute('data-flipped', '');
    closed += 1;
    // Another card's tap.
    await first.locator('button.card-flip').tap();
    await second.locator('button.card-flip').tap();
    await expect(second).toHaveAttribute('data-flipped', '');
    await expect(first).not.toHaveAttribute('data-flipped', '');
    expect((await sheetOf(page, 0)).display).toBe('none');
    expect((await sheetOf(page, 1)).position).toBe('fixed');
    expect(closed).toBe(3);
  });

  test('at a larger text size it still opens whole, and scrolls within itself if it must', async ({
    page,
  }) => {
    await ready(page, 24);
    const card = cardAt(page, 1);
    await card.locator('button.card-flip').tap();
    const sheet = await sheetOf(page, 1);
    expect(sheet.position).toBe('fixed');
    expect(sheet.bottom).toBeCloseTo(sheet.height, 0);
    const fits = await card.locator('.face.back').evaluate((back) => {
      const style = getComputedStyle(back);
      return (
        back.scrollHeight <= back.clientHeight + 1 ||
        style.overflowY === 'auto' ||
        style.overflowY === 'scroll'
      );
    });
    expect(fits).toBe(true);
  });
});

// A tap on a card cut off at the strip's right edge, as a reader taps it, with
// the jump of reduced motion: it opens its sheet, and the
// strip brings it into view; see flip.spec.ts for the click this once lost.
test.describe('a tap on a phone card cut off at the edge', () => {
  test.use({ ...PHONE, viewport: { width: 390, height: 844 } });
  test('opens its sheet, with reduced motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await ready(page);
    const row = page.locator('section.row').first();
    await row.evaluate((el) => el.scrollIntoView({ block: 'center' }));
    const found = await row.evaluate((section) => {
      const strip = section.querySelector('ul.strip')?.getBoundingClientRect();
      const cards = [...section.querySelectorAll<HTMLElement>('li.card')];
      const at = cards.findIndex((card) => {
        const box = card.getBoundingClientRect();
        return (
          strip !== undefined &&
          box.right > strip.right + 1 &&
          box.left < strip.right - 30
        );
      });
      const box = cards[at]?.querySelector('.frame')?.getBoundingClientRect();
      if (box === undefined || strip === undefined) return null;
      return {
        at,
        x: (box.left + strip.right) / 2,
        y: box.top + box.height / 2,
      };
    });
    expect(found, 'a card cut off at the strip’s right edge').not.toBeNull();
    const card = row.locator('li.card').nth(found?.at ?? 0);
    await page.touchscreen.tap(found?.x ?? 0, found?.y ?? 0);
    await expect(card).toHaveAttribute('data-flipped', '');
    await expect(card.locator('a.card-link')).toBeFocused();
  });
});
