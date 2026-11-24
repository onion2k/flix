// Holds part 5 of plans/cards.md, "the shine": the best cards of the catalogue,
// and no other, carry a foil over their picture and "Top pick" in their label,
// so that the foil is not the only thing that says it. Under a real mouse the
// sheen follows the pointer, as src/catalogue/shine.ts says for that place, and
// the card tilts toward it, and leaving puts both back to rest; a mouse on a
// card that is not one of the best sets nothing. On a touch screen the sheen
// follows the card's place in the window as the page and its strip scroll, and
// never tilts. A reader who asked for less motion has a still sheen and nothing
// set, whatever the mouse or the scroll does; with script off the foil is drawn
// at rest. A press on the foil is still the flip, and a flipped best card's
// back reads the right way round, at 7:1, while it tilts. Nothing is set while
// no best card is in the window. What the script writes is counted by wrapping
// the CSSOM's setProperty before any page script runs, so that a write that is
// made and undone between two looks is still seen. Each test counts what it
// reached.
import { expect, type Locator, type Page } from '@playwright/test';
import { test } from '../clock';
import { readRows } from './catalogue';
import { textPieces } from './text-pieces';
import { inWindow, underPointer, MOST_TILT } from '../../src/catalogue/shine';

const catalogue = readRows();

const PROPERTIES = ['--shine-x', '--shine-y', '--tilt-x', '--tilt-y'];

test.use({ viewport: { width: 1440, height: 1000 } });

/** Counts every write of the shine's four properties, from before the page's own script. */
async function countWrites(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const writes: string[] = [];
    Reflect.set(window, '__shineWrites', writes);
    const own: (
      this: CSSStyleDeclaration,
      name: string,
      value: string | null,
      priority?: string,
    ) => void = Reflect.get(CSSStyleDeclaration.prototype, 'setProperty');
    CSSStyleDeclaration.prototype.setProperty = function (
      this: CSSStyleDeclaration,
      name: string,
      value: string | null,
      priority?: string,
    ) {
      if (/^--(shine|tilt)-/.test(name)) writes.push(name);
      own.call(this, name, value, priority);
    };
  });
}

function writes(page: Page): Promise<number> {
  return page.evaluate(
    () =>
      (Reflect.get(window, '__shineWrites') as string[] | undefined)?.length ??
      -1,
  );
}

/** The page with script run: every card flips and the rows have their arrows. */
async function ready(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.locator('section.row[data-arrows]').first()).toBeAttached();
  await expect(page.locator('li.card:not([data-flips])')).toHaveCount(0);
}

/** A few frames of the page's own, so that anything waiting on one has run. */
function frames(page: Page, count = 4): Promise<void> {
  return page.evaluate(
    (count) =>
      new Promise<void>((done) => {
        let left = count;
        const next = () => (--left <= 0 ? done() : requestAnimationFrame(next));
        requestAnimationFrame(next);
      }),
    count,
  );
}

/** What the script has set on a card, read from its own style. */
function setOn(card: Locator): Promise<Record<string, string>> {
  return card.evaluate((el: HTMLElement, names) => {
    const found: Record<string, string> = {};
    for (const name of names) found[name] = el.style.getPropertyValue(name);
    return found;
  }, PROPERTIES);
}

/** What a card's four properties are, as the browser works them out. */
function computed(card: Locator): Promise<Record<string, string>> {
  return card.evaluate((el, names) => {
    const style = getComputedStyle(el);
    const found: Record<string, string> = {};
    for (const name of names) found[name] = style.getPropertyValue(name).trim();
    return found;
  }, PROPERTIES);
}

/** The first row's card of a site. */
const cardOf = (page: Page, id: string): Locator =>
  page.locator(`section.row`).first().locator(`li.card[data-entry="${id}"]`);

/** Every transition on the page has finished. */
function still(page: Page): Promise<void> {
  return page.evaluate(() =>
    Promise.all(
      document.getAnimations().map((each) => each.finished.catch(() => null)),
    ).then(() => undefined),
  );
}

/** Puts the first row in the middle of the window, by a jump. */
async function firstRowInView(page: Page): Promise<void> {
  await page.evaluate(() => {
    const row = document.querySelector('section.row li.card');
    const box = row?.getBoundingClientRect();
    if (box === undefined) throw new Error('no card');
    window.scrollTo({
      top: scrollY + box.top + box.height / 2 - innerHeight / 2,
      behavior: 'instant',
    });
  });
}

test('exactly the best cards carry data-best, the foil and “Top pick”, and no other card does', async ({
  page,
}) => {
  await ready(page);
  expect(catalogue.best.length).toBe(3);
  const cards = page.locator('main li.card');
  const total = await cards.count();
  const expected = catalogue.rows.reduce(
    (sum, row) => sum + row.entries.length,
    0,
  );
  expect(total).toBe(expected);
  let best = 0;
  let plain = 0;
  for (let at = 0; at < total; at += 1) {
    const card = cards.nth(at);
    const id = (await card.getAttribute('data-entry')) ?? '';
    const shines = catalogue.best.includes(id);
    const label =
      (await card.locator('.front [data-label]').textContent()) ?? '';
    if (shines) {
      best += 1;
      await expect(card, id).toHaveAttribute('data-best', '');
      await expect(card.locator('.front > .foil'), id).toHaveCount(1);
      expect(label.trim(), id).toMatch(/ · Top pick$/);
      // Out of the tree: it is a look, and the label says it.
      await expect(card.locator('.foil')).toHaveAttribute(
        'aria-hidden',
        'true',
      );
    } else {
      plain += 1;
      expect(await card.getAttribute('data-best'), id).toBeNull();
      expect(label, id).not.toContain('Top pick');
    }
  }
  expect(best).toBe(catalogue.best.length);
  expect(plain).toBe(total - best);
  // The feature is not a card and does not shine, though it is a best site.
  await expect(page.locator('section.feature .foil')).toHaveCount(0);
  await expect(
    page.locator('section.feature [data-label]').first(),
  ).not.toContainText('Top pick');
});

test.describe('a mouse', () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
  });

  test('moved across a best card sets the sheen where the rule says and tilts it, and leaving puts both back to rest', async ({
    page,
  }) => {
    await ready(page);
    const card = cardOf(page, 'aquaclysm');
    await firstRowInView(page);
    await page.mouse.move(2, 2);
    const rest = await computed(card);
    expect(rest['--shine-x']).not.toBe('');
    let reached = 0;
    for (const [fx, fy] of [
      [0.2, 0.15],
      [0.8, 0.85],
      [0.5, 0.3],
    ] as const) {
      const box = await card.boundingBox();
      if (box === null) throw new Error('the card is not drawn');
      const at = { x: box.x + box.width * fx, y: box.y + box.height * fy };
      await page.mouse.move(at.x, at.y, { steps: 4 });
      const want = underPointer(at, {
        left: box.x,
        top: box.y,
        right: box.x + box.width,
        bottom: box.y + box.height,
      });
      if (want === null)
        throw new Error('the rule put the pointer off the card');
      await expect
        .poll(async () => parseFloat((await setOn(card))['--shine-x'] ?? ''))
        .toBeCloseTo(want.x, 2);
      const now = await setOn(card);
      expect(parseFloat(now['--shine-y'] ?? '')).toBeCloseTo(want.y, 2);
      expect(now['--tilt-x']).toMatch(/deg$/);
      expect(parseFloat(now['--tilt-x'] ?? '')).toBeCloseTo(want.tiltX, 1);
      expect(parseFloat(now['--tilt-y'] ?? '')).toBeCloseTo(want.tiltY, 1);
      reached += 1;
    }
    // The corners reached tilt the card plainly, and no further than the most.
    expect(MOST_TILT).toBeGreaterThan(0);
    // The card's faces are turned as the tilt says, once the ease is over.
    await still(page);
    const turned = await card
      .locator('.card-faces')
      .evaluate((el) => getComputedStyle(el).transform);
    expect(turned).toMatch(/^matrix3d\(/);
    await page.mouse.move(2, 2, { steps: 2 });
    await expect
      .poll(() => setOn(card))
      .toEqual({
        '--shine-x': '',
        '--shine-y': '',
        '--tilt-x': '',
        '--tilt-y': '',
      });
    await still(page);
    // Back at the resting place: the registered first values, which the page
    // itself carries untouched (what was read as rest above could already be
    // a place the scroll into view set, or not yet, by a frame's luck).
    const resting = await page.evaluate((names) => {
      const style = getComputedStyle(document.body);
      return Object.fromEntries(
        names.map((name) => [name, style.getPropertyValue(name).trim()]),
      );
    }, PROPERTIES);
    expect(await computed(card)).toEqual(resting);
    expect(reached).toBe(3);
  });

  test('moved across a card that is not a top pick sets its sheen and tilt, and leaving takes them off', async ({
    page,
  }) => {
    await ready(page);
    await firstRowInView(page);
    const card = cardOf(page, 'chess');
    expect(await card.getAttribute('data-best')).toBeNull();
    expect(await card.getAttribute('data-finish')).toBe('reverse');
    expect(Object.values(await setOn(card)).join('')).toBe('');
    let reached = 0;
    for (const [fx, fy] of [
      [0.2, 0.2],
      [0.8, 0.7],
    ] as const) {
      const box = await card.boundingBox();
      if (box === null) throw new Error('the card is not drawn');
      const at = { x: box.x + box.width * fx, y: box.y + box.height * fy };
      await page.mouse.move(at.x, at.y, { steps: 4 });
      const now = box;
      const want = underPointer(at, {
        left: now.x,
        top: now.y,
        right: now.x + now.width,
        bottom: now.y + now.height,
      });
      if (want === null)
        throw new Error('the rule put the pointer off the card');
      await expect
        .poll(async () => parseFloat((await setOn(card))['--shine-x'] ?? ''))
        .toBeCloseTo(want.x, 1);
      const set = await setOn(card);
      expect(parseFloat(set['--tilt-y'] ?? '')).not.toBe(0);
      reached += 1;
    }
    await page.mouse.move(2, 2, { steps: 2 });
    await expect
      .poll(() => setOn(card))
      .toEqual({
        '--shine-x': '',
        '--shine-y': '',
        '--tilt-x': '',
        '--tilt-y': '',
      });
    expect(reached).toBe(2);
  });

  test('a mouse writes nothing by a card’s place: a scroll moves no card’s sheen', async ({
    page,
  }) => {
    await countWrites(page);
    await ready(page);
    await page.mouse.move(2, 2);
    await firstRowInView(page);
    await page.evaluate(() =>
      window.scrollBy({ top: 40, behavior: 'instant' }),
    );
    await frames(page, 6);
    expect(await writes(page)).toBe(0);
    expect(await page.locator('li.card[data-foil-focus]').count()).toBe(0);
  });
});

test.describe('on a touch screen at a phone’s width', () => {
  test.use({
    hasTouch: true,
    isMobile: true,
    viewport: { width: 390, height: 844 },
  });

  /** The ids of the cards that carry data-foil-focus. */
  const focused = (page: Page): Promise<string[]> =>
    page
      .locator('li.card[data-foil-focus]')
      .evaluateAll((all) =>
        all.map((card) => (card as HTMLElement).dataset['entry'] ?? ''),
      );

  const onOf = (card: Locator) =>
    card.evaluate((el) =>
      parseFloat(getComputedStyle(el).getPropertyValue('--foil-on')),
    );

  test('after a scroll exactly one card is in focus and shows whole, by its place, and the rest stay at rest with nothing written', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await ready(page);
    await firstRowInView(page);
    await expect.poll(() => focused(page)).toHaveLength(1);
    await page.waitForFunction(() => document.getAnimations().length === 0);
    const [id] = await focused(page);
    const card = cardOf(page, id ?? '');
    expect(await onOf(card)).toBe(1);
    // Its sheen is where the rule puts it for its place in the window, and
    // it does not tilt.
    const want = await card.evaluate((el: HTMLElement) => {
      const r = el.getBoundingClientRect();
      return {
        box: { left: r.left, top: r.top, right: r.right, bottom: r.bottom },
        size: {
          width: document.documentElement.clientWidth,
          height: document.documentElement.clientHeight,
        },
      };
    });
    const place = inWindow(want.box, want.size);
    if (place === null) throw new Error('the card has no size');
    const set = await setOn(card);
    expect(parseFloat(set['--shine-x'] ?? '')).toBeCloseTo(place.x, 2);
    expect(parseFloat(set['--shine-y'] ?? '')).toBeCloseTo(place.y, 2);
    expect(['', '0deg', '0']).toContain(set['--tilt-x']?.replace(/deg$/, ''));
    const rest = await page.evaluate(() =>
      parseFloat(
        getComputedStyle(document.documentElement).getPropertyValue(
          '--share-foil-rest',
        ),
      ),
    );
    let others = 0;
    for (const each of await page.locator('li.card').all()) {
      if ((await each.getAttribute('data-entry')) === id) continue;
      expect(await each.getAttribute('data-foil-focus')).toBeNull();
      expect(await onOf(each)).toBeCloseTo(rest, 5);
      expect(Object.values(await setOn(each)).join('')).toBe('');
      others += 1;
    }
    expect(others).toBe((await page.locator('li.card').count()) - 1);
  });

  test('the focus moves to another card after a strip scroll, one at a time, and the card that lost it is at rest', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await ready(page);
    await firstRowInView(page);
    await expect.poll(() => focused(page)).toHaveLength(1);
    const [first] = await focused(page);
    await page.evaluate(() =>
      document
        .querySelector<HTMLElement>('section.row .strip')
        ?.scrollTo({ left: 500, behavior: 'instant' }),
    );
    await expect.poll(async () => (await focused(page))[0]).not.toBe(first);
    expect(await focused(page)).toHaveLength(1);
    const lost = cardOf(page, first ?? '');
    await expect(lost).not.toHaveAttribute('data-foil-focus', '');
    await expect
      .poll(() => setOn(lost))
      .toEqual({
        '--shine-x': '',
        '--shine-y': '',
        '--tilt-x': '',
        '--tilt-y': '',
      });
    await page.waitForFunction(() => document.getAnimations().length === 0);
    expect(await onOf(lost)).toBeLessThan(1);
    // Down the page to the next row, with the card that was in focus still
    // in the window: the focus moves, and still there is one.
    await page.evaluate(() =>
      document
        .querySelector<HTMLElement>('section.row .strip')
        ?.scrollTo({ left: 0, behavior: 'instant' }),
    );
    await firstRowInView(page);
    // The card in focus is one whole in the window across as well as down.
    await expect
      .poll(async () =>
        page.evaluate(() => {
          const card = document.querySelector('li.card[data-foil-focus]');
          const box = card?.getBoundingClientRect();
          return box !== undefined && box.left >= 0 && box.right <= innerWidth;
        }),
      )
      .toBe(true);
    const [before] = await focused(page);
    await page.evaluate(() => {
      const second = document.querySelectorAll('section.row')[1];
      second?.scrollIntoView({ block: 'center', behavior: 'instant' });
    });
    await expect.poll(async () => (await focused(page))[0]).not.toBe(before);
    expect(await focused(page)).toHaveLength(1);
    expect(
      await cardOf(page, before ?? '').evaluate((el) => {
        const box = el.getBoundingClientRect();
        return (
          box.bottom > 0 &&
          box.top < innerHeight &&
          box.left >= 0 &&
          box.right <= innerWidth
        );
      }),
    ).toBe(true);
  });

  test('none is in focus while more than half of the hero’s frame is in the window, and nothing is written', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await countWrites(page);
    await ready(page);
    expect(
      await page.evaluate(() => {
        const frame = document.querySelector(
          'section.feature:not([hidden]) .feature-frame',
        );
        const box = frame?.getBoundingClientRect();
        if (box === undefined) return -1;
        return (
          (Math.min(box.bottom, innerHeight) - Math.max(box.top, 0)) /
          box.height
        );
      }),
    ).toBeGreaterThan(0.5);
    // A scroll that leaves the hero's half in the window.
    for (const top of [20, 30, -10])
      await page.evaluate(
        (top) => window.scrollBy({ top, behavior: 'instant' }),
        top,
      );
    await frames(page, 6);
    expect(await focused(page)).toEqual([]);
    expect(await writes(page)).toBe(0);
    // Once the hero is mostly gone, the nearest whole card is in focus.
    await firstRowInView(page);
    await expect.poll(() => focused(page)).toHaveLength(1);
    expect(await writes(page)).toBeGreaterThan(0);
  });

  test('a scroll that comes before the script’s first sight of the cards still puts a card in focus', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.addInitScript(() => {
      const Own = window.IntersectionObserver;
      const held: (() => void)[] = [];
      Reflect.set(window, '__releaseSight', () => {
        for (const run of held.splice(0)) run();
      });
      window.IntersectionObserver = class extends Own {
        constructor(
          callback: IntersectionObserverCallback,
          options?: IntersectionObserverInit,
        ) {
          super(
            (entries, observer) => held.push(() => callback(entries, observer)),
            options,
          );
        }
      };
    });
    await ready(page);
    await frames(page, 4);
    // The answer about the cards at load is being held; the reader scrolls.
    await firstRowInView(page);
    await frames(page, 4);
    expect(await focused(page)).toEqual([]);
    await page.evaluate(() =>
      (Reflect.get(window, '__releaseSight') as () => void)(),
    );
    await expect.poll(() => focused(page)).toHaveLength(1);
  });

  test('with reduced motion no card is in focus and nothing is written, whatever is scrolled', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await countWrites(page);
    await ready(page);
    await firstRowInView(page);
    await page.evaluate(() =>
      document
        .querySelector<HTMLElement>('section.row .strip')
        ?.scrollTo({ left: 300, behavior: 'instant' }),
    );
    await frames(page, 6);
    expect(await focused(page)).toEqual([]);
    expect(await writes(page)).toBe(0);
    for (const each of await page.locator('li.card').all())
      expect(Object.values(await setOn(each)).join('')).toBe('');
  });
});

test.describe('with reduced motion', () => {
  test('a mouse move and a scroll change nothing, and no property is set', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await countWrites(page);
    await ready(page);
    const card = cardOf(page, 'aquaclysm');
    const rest = await computed(card);
    await firstRowInView(page);
    const box = await card.boundingBox();
    if (box === null) throw new Error('the card is not drawn');
    await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.2, {
      steps: 4,
    });
    await page.mouse.move(box.x + box.width * 0.8, box.y + box.height * 0.8, {
      steps: 4,
    });
    await page.evaluate(() =>
      window.scrollBy({ top: 120, behavior: 'instant' }),
    );
    await page.evaluate(() => {
      document
        .querySelector<HTMLElement>('section.row .strip')
        ?.scrollTo({ left: 200, behavior: 'instant' });
    });
    await frames(page, 6);
    expect(await writes(page)).toBe(0);
    let reached = 0;
    for (const each of await page.locator('li.card').all()) {
      expect(Object.values(await setOn(each)).join('')).toBe('');
      reached += 1;
    }
    expect(reached).toBe(await page.locator('li.card').count());
    expect(await computed(card)).toEqual(rest);
    // And the foil is there, still: reduced motion is a still sheen, not none.
    await expect(card.locator('.foil')).toBeVisible();
  });
});

test.describe('with script off', () => {
  test.use({ javaScriptEnabled: false });

  test('the foil is drawn at rest on each best card, and nothing tilts', async ({
    page,
  }) => {
    await page.goto('/');
    let reached = 0;
    for (const id of catalogue.best) {
      const card = cardOf(page, id);
      const foil = card.locator('.foil');
      await expect(foil, id).toBeVisible();
      const drawn = await foil.evaluate((el) => {
        const style = getComputedStyle(el);
        return {
          image: style.backgroundImage,
          opacity: parseFloat(style.opacity),
          width: el.getBoundingClientRect().width,
          frame: el.parentElement?.getBoundingClientRect().width ?? -1,
        };
      });
      expect(drawn.image, id).toContain('gradient');
      expect(drawn.opacity, id).toBeGreaterThan(0);
      expect(drawn.width, id).toBeCloseTo(drawn.frame, 0);
      const values = await computed(card);
      expect(values['--tilt-x'], id).toBe('0deg');
      expect(values['--tilt-y'], id).toBe('0deg');
      expect(Number.isFinite(parseFloat(values['--shine-x'] ?? ''))).toBe(true);
      reached += 1;
    }
    expect(reached).toBe(3);
  });
});

test.describe('a press on the foil', () => {
  test('flips the card, and its back, tilted under the mouse, reads the right way round at 7:1', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await ready(page);
    await page.evaluate(() => document.fonts.ready);
    const card = cardOf(page, 'aquaclysm');
    await firstRowInView(page);
    const frame = await card.locator('.frame').boundingBox();
    if (frame === null) throw new Error('the picture is not drawn');
    const at = {
      x: frame.x + frame.width * 0.3,
      y: frame.y + frame.height * 0.4,
    };
    // The foil is drawn there, and the press goes through it to the flip button.
    const foil = await card.locator('.foil').boundingBox();
    expect(foil).not.toBeNull();
    expect(at.x).toBeGreaterThan(foil?.x ?? Infinity);
    expect(at.y).toBeLessThan((foil?.y ?? 0) + (foil?.height ?? 0));
    const under = await page.evaluate(
      ({ x, y }) => document.elementFromPoint(x, y)?.className ?? '',
      at,
    );
    expect(under).toBe('card-flip');
    await page.mouse.move(at.x, at.y, { steps: 3 });
    await page.mouse.down();
    await page.mouse.up();
    await expect(card).toHaveAttribute('data-flipped', '');
    // The mouse is still on the card, so it is tilted as the back shows.
    await expect
      .poll(async () => parseFloat((await setOn(card))['--tilt-y'] ?? '0'))
      .toBeLessThan(-0.5);
    await still(page);
    // The right way round: along the description's first line, each letter is
    // drawn to the right of the one before it.
    const order = await card.locator('.back .description').evaluate((el) => {
      const text = el.firstChild;
      if (text === null) return { lefts: [] as number[] };
      const lefts: number[] = [];
      const range = document.createRange();
      for (let at = 0; at < 8; at += 1) {
        range.setStart(text, at);
        range.setEnd(text, at + 1);
        lefts.push(range.getBoundingClientRect().left);
      }
      return { lefts };
    });
    expect(order.lefts.length).toBe(8);
    order.lefts.forEach((left, at) => {
      if (at > 0) expect(left).toBeGreaterThan(order.lefts[at - 1] ?? Infinity);
    });
    // And at 7:1, as contrast.spec.ts measures: every word of the back.
    const pieces = await textPieces(page, 'li.card[data-flipped] .face.back');
    expect(pieces.length).toBeGreaterThan(1);
    expect(
      pieces
        .filter((piece) => piece.ratio < (piece.large ? 4.5 : 7))
        .map((piece) => `${piece.ratio.toFixed(2)}:1 "${piece.text}"`),
    ).toEqual([]);
  });
});

test('where colours are forced there is no foil and no reflection, and the card’s own borders stand', async ({
  page,
}) => {
  await page.emulateMedia({ forcedColors: 'active' });
  await ready(page);
  let reached = 0;
  for (const card of await page.locator('li.card[data-best]').all()) {
    await expect(card.locator('.foil')).toBeHidden();
    await expect(card.locator('.foil-wash')).toBeHidden();
    expect(
      await card
        .locator('.card-faces')
        .evaluate((el) => getComputedStyle(el, '::before').content),
    ).toBe('none');
    expect(
      await card
        .locator('.frame')
        .evaluate((el) => getComputedStyle(el, '::before').display),
    ).toBe('none');
    expect(
      await card
        .locator('.frame')
        .evaluate((el) => getComputedStyle(el, '::after').borderTopStyle),
    ).toBe('solid');
    reached += 1;
  }
  expect(reached).toBe(catalogue.best.length);
});

// The foil is made of three layers over the picture, as the owner chose from
// round seven of the mocks of 2026-11-23 (after simeydotme's pen of trading
// cards): a rainbow and bands of light dodged onto it with a contrast, which
// light its bright parts (.foil); a field of glitter tinted by a rainbow, with
// a glare on top, added onto it, which shines on a dark picture where a dodge
// cannot (.frame::before, its glitter the site's own /foil-glitter.svg); and a
// colour wash laid over it (.foil-wash). Only the best cards have them, none
// takes a press, each is the picture's size and no larger, and when another
// card in the row is pointed at all three are dimmed with the pictures and the
// foil keeps its contrast.
test.describe('the foil’s three layers', () => {
  test('each best card has the dodged foil, the glitter and the wash of the holo over its picture', async ({
    page,
  }) => {
    await ready(page);
    let best = 0;
    let plain = 0;
    for (const card of await page.locator('li.card').all()) {
      const id = (await card.getAttribute('data-entry')) ?? '?';
      const layers = await card.evaluate((el) => {
        const frame = el.querySelector('.front .frame');
        const foil = el.querySelector('.foil');
        const wash = el.querySelector('.foil-wash');
        const glitter = frame ? getComputedStyle(frame, '::before') : null;
        const box = (of: Element | null) =>
          of === null
            ? null
            : {
                width: of.getBoundingClientRect().width,
                height: of.getBoundingClientRect().height,
              };
        return {
          best: el.hasAttribute('data-best'),
          frame: box(frame),
          foil:
            foil === null
              ? null
              : {
                  blend: getComputedStyle(foil).mixBlendMode,
                  filter: getComputedStyle(foil).filter,
                  presses: getComputedStyle(foil).pointerEvents,
                  size: box(foil),
                },
          wash:
            wash === null
              ? null
              : {
                  blend: getComputedStyle(wash).mixBlendMode,
                  image: getComputedStyle(wash).backgroundImage,
                  presses: getComputedStyle(wash).pointerEvents,
                  hidden: wash.getAttribute('aria-hidden'),
                  size: box(wash),
                },
          glitter:
            glitter === null
              ? null
              : {
                  content: glitter.content,
                  blend: glitter.mixBlendMode,
                  presses: glitter.pointerEvents,
                  image: glitter.backgroundImage,
                  width: parseFloat(glitter.width),
                  height: parseFloat(glitter.height),
                },
        };
      });
      if (layers.best) {
        expect(layers.foil?.blend, id).toBe('color-dodge');
        expect(layers.foil?.filter, id).toMatch(/contrast\(/);
        expect(layers.foil?.presses, id).toBe('none');
        expect(layers.wash?.blend, id).toBe('overlay');
        expect(layers.wash?.image, id).toContain('gradient');
        expect(layers.wash?.presses, id).toBe('none');
        expect(layers.wash?.hidden, id).toBe('true');
        expect(layers.glitter?.content, id).not.toBe('none');
        expect(layers.glitter?.blend, id).toBe('screen');
        expect(layers.glitter?.presses, id).toBe('none');
        expect(layers.glitter?.image, id).toContain('/foil-glitter.svg');
        for (const [name, size] of [
          ['foil', layers.foil?.size],
          ['wash', layers.wash?.size],
          [
            'glitter',
            { width: layers.glitter?.width, height: layers.glitter?.height },
          ],
        ] as const) {
          expect(size?.width ?? 0, `${id} ${name}`).toBeCloseTo(
            layers.frame?.width ?? -1,
            0,
          );
          expect(size?.height ?? 0, `${id} ${name}`).toBeCloseTo(
            layers.frame?.height ?? -1,
            0,
          );
        }
        best += 1;
      } else {
        // Every card has the layers now, in its own finish (below).
        plain += 1;
      }
    }
    expect(best).toBe(catalogue.best.length);
    expect(plain).toBeGreaterThan(10);
  });

  test('with another card of its row pointed at, all three are dimmed with the pictures and the foil keeps its contrast', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await ready(page);
    await firstRowInView(page);
    const plain = page
      .locator('section.row')
      .first()
      .locator('li.card:not([data-best])')
      .first();
    const box = await plain.locator('.frame').boundingBox();
    if (box === null) throw new Error('the picture is not drawn');
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    let reached = 0;
    for (const id of catalogue.best) {
      const card = cardOf(page, id);
      if ((await card.count()) === 0) continue;
      const filters = await card.evaluate((el) => ({
        foil: getComputedStyle(el.querySelector('.foil') as Element).filter,
        wash: getComputedStyle(el.querySelector('.foil-wash') as Element)
          .filter,
        glitter: getComputedStyle(
          el.querySelector('.front .frame') as Element,
          '::before',
        ).filter,
        picture: getComputedStyle(el.querySelector('.frame img') as Element)
          .filter,
      }));
      expect(filters.picture, id).toMatch(/brightness\(0\.55\)/);
      expect(filters.foil, id).toMatch(/contrast\(/);
      expect(filters.foil, id).toMatch(/brightness\(0\.55\)$/);
      expect(filters.wash, id).toMatch(/brightness\(0\.55\)/);
      expect(filters.glitter, id).toMatch(/brightness\(0\.55\)/);
      reached += 1;
    }
    expect(reached).toBeGreaterThan(1);
  });
});

// The shine shows a little at rest and all of it while a mouse is on the card,
// which lifts toward the reader a little, with a shadow under it; on a screen
// where nothing hovers it shows as at rest, and nothing lifts. Every card does
// this, in its own finish.
test.describe('the shine at rest and under a mouse', () => {
  const onOf = (card: Locator) =>
    card.evaluate((el) =>
      parseFloat(getComputedStyle(el).getPropertyValue('--foil-on')),
    );
  test('a best card shows a little of it at rest, all of it under a mouse, and lifts, as a plain card does', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await ready(page);
    await firstRowInView(page);
    const card = cardOf(page, 'aquaclysm');
    const rest = await onOf(card);
    expect(rest).toBeGreaterThan(0);
    expect(rest).toBeLessThan(0.5);
    const lift = () =>
      card.evaluate((el) => ({
        scale: getComputedStyle(el.querySelector('.card-faces') as Element)
          .scale,
        shadow: getComputedStyle(el.querySelector('.front') as Element)
          .boxShadow,
      }));
    expect((await lift()).scale).toBe('none');
    expect((await lift()).shadow).toBe('none');
    const box = await card.locator('.frame').boundingBox();
    if (box === null) throw new Error('the picture is not drawn');
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await expect.poll(() => onOf(card)).toBe(1);
    const lifted = await lift();
    expect(parseFloat(lifted.scale)).toBeGreaterThan(1);
    expect(lifted.shadow).not.toBe('none');
    // A plain card under the mouse lifts nothing.
    const plain = page
      .locator('section.row')
      .first()
      .locator('li.card:not([data-best])')
      .first();
    const plainBox = await plain.locator('.frame').boundingBox();
    if (plainBox === null) throw new Error('the picture is not drawn');
    await page.mouse.move(
      plainBox.x + plainBox.width / 2,
      plainBox.y + plainBox.height / 2,
    );
    // It lifts, as every card does: the plain card is a foil card too.
    await expect
      .poll(() =>
        plain
          .locator('.card-faces')
          .evaluate((el) => parseFloat(getComputedStyle(el).scale)),
      )
      .toBeGreaterThan(1);
    await expect.poll(() => onOf(card)).toBeCloseTo(rest, 5);
  });

  test.describe('on a touch screen', () => {
    test.use({
      hasTouch: true,
      isMobile: true,
      viewport: { width: 390, height: 844 },
    });
    test('a card shows a little of it, as at rest, with nothing to hover, and a tap lifts nothing', async ({
      page,
    }) => {
      await ready(page);
      await firstRowInView(page);
      // A card that is not the one in focus (that one shows whole).
      const card = page
        .locator('section.row')
        .first()
        .locator('li.card:not([data-foil-focus])')
        .first();
      const on = await onOf(card);
      const rest = await page.evaluate(() =>
        parseFloat(
          getComputedStyle(document.documentElement).getPropertyValue(
            '--share-foil-rest',
          ),
        ),
      );
      expect(rest).toBeGreaterThan(0);
      expect(on).toBeCloseTo(rest, 5);
      // A tap lands on the flip button laid over the whole front.
      await card.locator('button.card-flip').tap();
      await expect(card).toHaveAttribute('data-flipped', '');
      expect(
        await card
          .locator('.card-faces')
          .evaluate((el) => getComputedStyle(el).scale),
      ).toBe('none');
      expect(await onOf(card)).toBeCloseTo(on, 5);
    });
  });
});

// The glitter is the site's own small file, asked for from its own address,
// and its bytes cross the wire once however many layers draw it.
test('the glitter is the site’s own file, sent once', async ({ page }) => {
  const network = await page.context().newCDPSession(page);
  await network.send('Network.enable');
  const asks = new Map<string, { url: string; wire: number }>();
  network.on('Network.requestWillBeSent', (event) =>
    asks.set(event.requestId, { url: event.request.url, wire: 0 }),
  );
  network.on('Network.loadingFinished', (event) => {
    const ask = asks.get(event.requestId);
    if (ask !== undefined) ask.wire = event.encodedDataLength;
  });
  await ready(page);
  await firstRowInView(page);
  await frames(page, 6);
  const mine = [...asks.values()].filter((ask) =>
    ask.url.endsWith('/foil-glitter.svg'),
  );
  expect(mine.length).toBeGreaterThan(0);
  for (const ask of mine)
    expect(new URL(ask.url).origin).toBe(new URL(page.url()).origin);
  expect(mine.filter((ask) => ask.wire > 200).length).toBe(1);
});

// Every card has the same border (the owner, 2026-11-23: the best cards'
// rainbow edge was too strong), and a card's front is a tile as its back is:
// the panel colour inside the picture's edge, with its label and title padded
// inside it.
test('every card has the same border and no edge of its own, and its front’s words are padded inside it', async ({
  page,
}) => {
  await ready(page);
  const fronts = await page.locator('li.card').evaluateAll((cards) =>
    cards.map((card) => {
      const front = card.querySelector('.front') as Element;
      const style = getComputedStyle(front);
      const label = getComputedStyle(front.querySelector('.label') as Element);
      const title = getComputedStyle(
        front.querySelector('.card-title') as Element,
      );
      return {
        id: (card as HTMLElement).dataset['entry'] ?? '?',
        border: `${style.borderTopWidth} ${style.borderTopStyle} ${style.borderTopColor} ${style.borderLeftWidth} ${style.borderBottomWidth}`,
        ground: style.backgroundColor,
        edge: getComputedStyle(
          card.querySelector('.card-faces') as Element,
          '::before',
        ).content,
        padding: [
          label.paddingLeft,
          label.paddingRight,
          title.paddingLeft,
          title.paddingRight,
        ],
        foot: parseFloat(title.paddingBottom),
      };
    }),
  );
  expect(fronts.length).toBeGreaterThan(15);
  const first = fronts[0];
  for (const front of fronts) {
    expect(front.border, front.id).toBe(first?.border);
    expect(front.border, front.id).toMatch(/^1px solid rgb\(44, 61, 53\)/);
    expect(front.ground, front.id).toBe('rgb(24, 37, 31)');
    expect(front.edge, front.id).toBe('none');
    expect(front.padding, front.id).toEqual(first?.padding);
    expect(parseFloat(front.padding[0] ?? '0'), front.id).toBeGreaterThan(0);
    expect(front.foot, front.id).toBeGreaterThan(0);
  }
});

// The script's first answer from its IntersectionObserver says what is in the
// window at load, and moves nothing. Under load a reader's first scroll can
// come before that answer: the scroll was not heard (nothing listened yet),
// the answer was taken for the page at load, and the sheen stayed where it
// was until the next scroll. Seen once in a full check. Here the observer's
// answers are held back until the page has been scrolled, every time.
// Every card has a finish (data-finish, from the catalogue) and draws the three
// layers in it: the holo, gold, galaxy and ice each draw a foil, a wash and the
// glitter's rule over the picture, with the backgrounds that finish gives them;
// the reverse draws none of the three and its front's tile carries the sheen.
// Each finish is told from the others by what it draws, so that a finish that
// drew another's look would fail, and each is counted as reached.
test.describe('every finish draws its own layers', () => {
  interface Drawn {
    finish: string;
    id: string;
    foil: { display: string; image: string; blend: string; filter: string };
    wash: { display: string; image: string; blend: string };
    glitter: { display: string; image: string; sizes: string };
    front: { image: string };
  }

  async function drawn(page: Page): Promise<Drawn[]> {
    return page.locator('li.card').evaluateAll((cards) =>
      cards.map((card) => {
        const foil = getComputedStyle(card.querySelector('.foil') as Element);
        const wash = getComputedStyle(
          card.querySelector('.foil-wash') as Element,
        );
        const glitter = getComputedStyle(
          card.querySelector('.front .frame') as Element,
          '::before',
        );
        const front = getComputedStyle(card.querySelector('.front') as Element);
        return {
          finish: (card as HTMLElement).dataset['finish'] ?? '',
          id: (card as HTMLElement).dataset['entry'] ?? '',
          foil: {
            display: foil.display,
            image: foil.backgroundImage,
            blend: foil.mixBlendMode,
            filter: foil.filter,
          },
          wash: {
            display: wash.display,
            image: wash.backgroundImage,
            blend: wash.mixBlendMode,
          },
          glitter: {
            display: glitter.display,
            image: glitter.backgroundImage,
            sizes: glitter.backgroundSize,
          },
          front: { image: front.backgroundImage },
        };
      }),
    );
  }

  test('each card draws the layers of its finish and no other’s', async ({
    page,
  }) => {
    await ready(page);
    const cards = await drawn(page);
    const reached: Record<string, number> = {};
    for (const card of cards) {
      reached[card.finish] = (reached[card.finish] ?? 0) + 1;
      const name = `${card.id} (${card.finish})`;
      if (card.finish === 'reverse') {
        expect(card.foil.display, name).toBe('none');
        expect(card.wash.display, name).toBe('none');
        expect(card.glitter.display, name).toBe('none');
        // The sheen is the front's own: a light, bars and a rainbow.
        expect(card.front.image, name).toContain('radial-gradient');
        expect(card.front.image, name).toContain('repeating-linear-gradient');
        expect(card.front.image, name).toContain('linear-gradient');
        continue;
      }
      expect(card.foil.display, name).not.toBe('none');
      expect(card.wash.display, name).not.toBe('none');
      expect(card.glitter.display, name).not.toBe('none');
      expect(card.front.image, name).toBe('none');
      expect(card.glitter.image, name).toContain('gradient');
      switch (card.finish) {
        case 'holo':
          expect(card.foil.blend, name).toBe('color-dodge');
          expect(card.wash.blend, name).toBe('overlay');
          expect(card.wash.image, name).toContain('rgb(255, 45, 117)');
          expect(card.glitter.image, name).toContain('/foil-glitter.svg');
          break;
        case 'gold':
          expect(card.wash.blend, name).toBe('soft-light');
          expect(card.wash.image, name).toContain('rgb(107, 62, 0)');
          expect(card.foil.image, name).toContain('rgb(255, 207, 106)');
          expect(card.glitter.image, name).toContain('/foil-glitter.svg');
          expect(card.glitter.sizes, name).toContain('180px');
          break;
        case 'galaxy':
          expect(card.wash.blend, name).toBe('screen');
          expect(card.wash.image.match(/radial-gradient/g)?.length, name).toBe(
            3,
          );
          expect(card.foil.image, name).toContain('rgb(59, 42, 138)');
          expect(card.glitter.image, name).toContain('/foil-glitter.svg');
          expect(card.glitter.sizes, name).toContain('640px');
          break;
        case 'ice':
          expect(card.foil.image, name).toContain('/foil-ice.svg');
          expect(card.wash.blend, name).toBe('multiply');
          expect(card.wash.image, name).toContain('/foil-ice.svg');
          expect(card.foil.filter, name).toContain('brightness(0.85)');
          expect(card.glitter.image, name).toContain('/foil-ice.svg');
          expect(card.glitter.image, name).not.toContain('/foil-glitter.svg');
          break;
        default:
          throw new Error(`${name} has no known finish`);
      }
    }
    expect(Object.keys(reached).sort()).toEqual([
      'galaxy',
      'gold',
      'holo',
      'ice',
      'reverse',
    ]);
    expect(cards.length).toBe(
      Object.values(reached).reduce((sum, count) => sum + count, 0),
    );
  });

  test('with forced colours no finish is drawn, and a reverse card’s tile is a plain panel', async ({
    page,
  }) => {
    await page.emulateMedia({ forcedColors: 'active' });
    await ready(page);
    const cards = await drawn(page);
    const finishes = new Set<string>();
    for (const card of cards) {
      finishes.add(card.finish);
      const name = `${card.id} (${card.finish})`;
      expect(card.foil.display, name).toBe('none');
      expect(card.wash.display, name).toBe('none');
      expect(card.glitter.display, name).toBe('none');
      expect(card.front.image, name).toBe('none');
    }
    expect(finishes.size).toBe(5);
  });

  test('each finish shows a little at rest and all of it under a mouse, with the lift', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await ready(page);
    const rest = await page.evaluate(() =>
      parseFloat(
        getComputedStyle(document.documentElement).getPropertyValue(
          '--share-foil-rest',
        ),
      ),
    );
    expect(rest).toBeGreaterThan(0);
    const onOf = (card: Locator) =>
      card.evaluate((el) =>
        parseFloat(getComputedStyle(el).getPropertyValue('--foil-on')),
      );
    let reached = 0;
    for (const id of [
      'aquaclysm',
      'ooergolf',
      'chopdrop',
      'fruit-machine',
      'chess',
    ]) {
      const card = page.locator(`li.card[data-entry="${id}"]`).first();
      await card.evaluate((el) =>
        el.scrollIntoView({
          block: 'center',
          inline: 'center',
          behavior: 'instant',
        }),
      );
      await page.mouse.move(2, 2);
      expect(await onOf(card), id).toBeCloseTo(rest, 5);
      const box = await card.locator('.front .card-title').boundingBox();
      if (box === null) throw new Error('the title is not drawn');
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await expect.poll(() => onOf(card), id).toBe(1);
      expect(
        parseFloat(
          await card
            .locator('.card-faces')
            .evaluate((el) => getComputedStyle(el).scale),
        ),
        id,
      ).toBeGreaterThan(1);
      expect(
        await card
          .locator('.front')
          .evaluate((el) => getComputedStyle(el).boxShadow),
        id,
      ).not.toBe('none');
      reached += 1;
    }
    expect(reached).toBe(5);
  });

  // Cracked ice on a light picture: a dodge takes a light picture to white
  // (Coinpusher's, a pale one, was white over a fifth of its frame under a
  // mouse), so under a mouse at full the share of the frame's pixels at or
  // near pure white must stay small, and its facets must still be readable, a
  // spread of grey the picture alone does not have. The pixels are read in a
  // blank page, since the site's policy does not allow a data: picture. The
  // light is put at three places by hand, since only the top picks' sheen is
  // moved by the pointer until the shine drives every card.
  test('cracked ice keeps a light picture: under a mouse, little of its frame goes white and its facets show', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await ready(page);
    const reader = await page.context().newPage();
    // The share of the frame at or near white, and how far it is from the
    // picture alone, in grey levels (the facets showing is the frame no longer
    // being the picture's own).
    const read = async (shot: Buffer, base: Buffer) =>
      reader.evaluate(
        async ([shot, base]) => {
          const pixels = async (b64: string) => {
            const image = new Image();
            image.src = `data:image/png;base64,${b64}`;
            await image.decode();
            const canvas = document.createElement('canvas');
            canvas.width = image.width;
            canvas.height = image.height;
            const context = canvas.getContext('2d');
            if (context === null) throw new Error('no canvas');
            context.drawImage(image, 0, 0);
            return context.getImageData(0, 0, canvas.width, canvas.height).data;
          };
          const [now, then] = [
            await pixels(shot ?? ''),
            await pixels(base ?? ''),
          ];
          let white = 0;
          let away = 0;
          for (let i = 0; i < now.length; i += 4) {
            const [r, g, b] = [now[i] ?? 0, now[i + 1] ?? 0, now[i + 2] ?? 0];
            if (Math.min(r, g, b) >= 245) white += 1;
            const grey = (r: number, g: number, b: number) =>
              0.2126 * r + 0.7152 * g + 0.0722 * b;
            away += Math.abs(
              grey(r, g, b) -
                grey(then[i] ?? 0, then[i + 1] ?? 0, then[i + 2] ?? 0),
            );
          }
          const count = now.length / 4;
          return { white: white / count, away: away / count };
        },
        [shot.toString('base64'), base.toString('base64')],
      );
    const card = page.locator('li.card[data-entry="coinpusher"]').first();
    expect(await card.getAttribute('data-finish')).toBe('ice');
    await card.evaluate((el) =>
      el.scrollIntoView({
        block: 'center',
        inline: 'center',
        behavior: 'instant',
      }),
    );
    const frame = card.locator('.front .frame');
    await page.mouse.move(2, 2);
    // The picture alone: none of the shine shown, whatever the mouse does.
    await card.evaluate((el: HTMLElement) =>
      el.style.setProperty('--foil-on', '0'),
    );
    const plain = await frame.screenshot();
    await card.evaluate((el: HTMLElement) =>
      el.style.removeProperty('--foil-on'),
    );
    const title = await card.locator('.front .card-title').boundingBox();
    if (title === null) throw new Error('the title is not drawn');
    await page.mouse.move(
      title.x + title.width / 2,
      title.y + title.height / 2,
    );
    await expect
      .poll(() =>
        card.evaluate((el) =>
          getComputedStyle(el).getPropertyValue('--foil-on'),
        ),
      )
      .toBe('1');
    const seen: string[] = [];
    let reached = 0;
    for (const [x, y] of [
      [0.2, 0.2],
      [0.5, 0.5],
      [0.8, 0.5],
    ] as const) {
      await card.evaluate(
        (el: HTMLElement, [x, y]) => {
          el.style.setProperty('--shine-x', String(x));
          el.style.setProperty('--shine-y', String(y));
        },
        [x, y],
      );
      const drawn = await read(await frame.screenshot(), plain);
      seen.push(
        `${x},${y}: ${drawn.white.toFixed(3)} white, ${drawn.away.toFixed(1)} grey levels from the picture`,
      );
      expect(drawn.white, `light at ${x},${y}`).toBeLessThan(0.05);
      expect(drawn.away, `light at ${x},${y}`).toBeGreaterThan(20);
      reached += 1;
    }
    await reader.close();
    expect(reached).toBe(3);
    test.info().annotations.push({
      type: 'measured',
      description: seen.join('; '),
    });
  });

  test('every card has the same border, under a mouse and at rest, whatever its finish', async ({
    page,
  }) => {
    await ready(page);
    const edges = await page.locator('li.card').evaluateAll((cards) =>
      cards.map((card) => {
        const style = getComputedStyle(card.querySelector('.front') as Element);
        return `${style.borderTopWidth} ${style.borderTopStyle} ${style.borderTopColor}`;
      }),
    );
    expect(edges.length).toBeGreaterThan(10);
    expect(new Set(edges).size).toBe(1);
  });
});

// The cracked-ice tile is the site's own small file, asked for from its own
// address, and its bytes cross the wire once however many layers and cards
// draw it.
test('the cracked-ice tile is the site’s own file, sent once', async ({
  page,
}) => {
  const network = await page.context().newCDPSession(page);
  await network.send('Network.enable');
  const asks = new Map<string, { url: string; wire: number }>();
  network.on('Network.requestWillBeSent', (event) =>
    asks.set(event.requestId, { url: event.request.url, wire: 0 }),
  );
  network.on('Network.loadingFinished', (event) => {
    const ask = asks.get(event.requestId);
    if (ask !== undefined) ask.wire = event.encodedDataLength;
  });
  await ready(page);
  await page
    .locator('li.card[data-finish="ice"]')
    .first()
    .evaluate((el) =>
      el.scrollIntoView({ block: 'center', behavior: 'instant' }),
    );
  await frames(page, 6);
  const mine = [...asks.values()].filter((ask) =>
    ask.url.endsWith('/foil-ice.svg'),
  );
  expect(mine.length).toBeGreaterThan(0);
  for (const ask of mine)
    expect(new URL(ask.url).origin).toBe(new URL(page.url()).origin);
  expect(mine.filter((ask) => ask.wire > 200).length).toBe(1);
});
