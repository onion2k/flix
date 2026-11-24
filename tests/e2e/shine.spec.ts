// Holds the shine (part 5 of plans/cards.md, then plans/foils.md, whose round
// two puts every finish on the card's own light tile and nothing over a picture
// or a loop): the best cards of the catalogue, and no other, say "Top pick" in
// their label, so that the finish is not the only thing that says it; every
// card is a tile in its finish. Under a real mouse the
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
import { differBy, newReader } from './tile';
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

test('exactly the best cards carry data-best and “Top pick”, and no card has a layer of its own over its picture', async ({
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
      expect(label.trim(), id).toMatch(/ · Top pick$/);
    } else {
      plain += 1;
      expect(await card.getAttribute('data-best'), id).toBeNull();
      expect(label, id).not.toContain('Top pick');
    }
  }
  expect(best).toBe(catalogue.best.length);
  expect(plain).toBe(total - best);
  // Nothing is laid over a picture: the foil's two spans are gone, on every
  // card and on the feature, which does not shine though it is a best site.
  await expect(page.locator('.foil, .foil-wash')).toHaveCount(0);
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
    // And the tile is there, still: reduced motion is a still sheen, not none.
    expect(
      await card
        .locator('.front')
        .evaluate((el) => getComputedStyle(el).backgroundImage),
    ).toContain('gradient');
  });
});

test.describe('with script off', () => {
  test.use({ javaScriptEnabled: false });

  test('a card is as it was: no tile, no finish drawn, no layer over a picture, nothing tilts', async ({
    page,
  }) => {
    await page.goto('/');
    let reached = 0;
    for (const card of await page.locator('li.card').all()) {
      const id = (await card.getAttribute('data-entry')) ?? '?';
      const front = await card.locator('.front').evaluate((el) => {
        const style = getComputedStyle(el);
        return {
          image: style.backgroundImage,
          ground: style.backgroundColor,
          padding: style.paddingTop,
          before: getComputedStyle(el, '::before').content,
          after: getComputedStyle(el, '::after').content,
          label: getComputedStyle(el.querySelector('.label') as Element).color,
        };
      });
      expect(front.image, id).toBe('none');
      // No tile: the front is not a panel without script, as it was.
      expect(front.ground, id).toBe('rgba(0, 0, 0, 0)');
      expect(front.padding, id).toBe('0px');
      expect(front.before, id).toBe('none');
      expect(front.after, id).toBe('none');
      // The label is the accent, as it was, and not the tile's ink.
      expect(front.label, id).toBe('rgb(255, 184, 28)');
      const values = await computed(card);
      expect(values['--tilt-x'], id).toBe('0deg');
      expect(values['--tilt-y'], id).toBe('0deg');
      reached += 1;
    }
    expect(reached).toBeGreaterThan(15);
  });
});

test.describe('a press on a tile', () => {
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
    // The press is on the picture, and nothing over it takes it: it goes to
    // the flip button laid over the front.
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

test('where colours are forced there is no finish, no sparkle and no glare, and the card’s own borders stand', async ({
  page,
}) => {
  await page.emulateMedia({ forcedColors: 'active' });
  await ready(page);
  let reached = 0;
  for (const card of await page.locator('li.card').all()) {
    const id = (await card.getAttribute('data-entry')) ?? '?';
    const front = await card.locator('.front').evaluate((el) => ({
      image: getComputedStyle(el).backgroundImage,
      before: getComputedStyle(el, '::before').display,
      after: getComputedStyle(el, '::after').display,
    }));
    expect(front, id).toEqual({ image: 'none', before: 'none', after: 'none' });
    expect(
      await card
        .locator('.frame')
        .evaluate((el) => getComputedStyle(el, '::after').borderTopStyle),
      id,
    ).toBe('solid');
    reached += 1;
  }
  expect(reached).toBeGreaterThan(15);
});

// Nothing is laid over a picture or a loop (the owner, 2026-11-24: the finishes
// go on the card's own tile and the picture is left alone). A card has no foil
// span, its frame has no ::before, and what a mouse does to the light, the
// picture's own pixels do not change: with the shine at nought and at whole,
// the light at three places, the frame is the same picture, pixel for pixel.
// And a card dimmed by another's being pointed at has its picture dimmed and
// its tile not, so that no word changes its contrast.
test.describe('nothing over the picture', () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
  });

  test('no card has a layer over its frame, and a frame’s picture is the same pixels at rest and at full shine, the light anywhere', async ({
    page,
  }) => {
    await ready(page);
    for (const card of await page.locator('li.card').all()) {
      const layers = await card.evaluate((el) => {
        const frame = el.querySelector('.front .frame') as Element;
        return {
          spans: el.querySelectorAll('.foil, .foil-wash').length,
          before: getComputedStyle(frame, '::before').content,
          // The picture's own edge is the frame's ::after, a border and no
          // fill, and is not a layer over it.
          fill: getComputedStyle(frame, '::after').backgroundImage,
        };
      });
      expect(layers, (await card.getAttribute('data-entry')) ?? '?').toEqual({
        spans: 0,
        before: 'none',
        fill: 'none',
      });
    }
    // The first row's pictures have arrived, and are looked at, a card of each
    // finish: the shine's whole and its nought, with the light at three places.
    await page.mouse.move(2, 2);
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    const reader = await newReader(page);
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
      const frame = card.locator('.front .frame');
      await expect(frame.locator('img').first()).toHaveJSProperty(
        'complete',
        true,
      );
      const shot = async (on: string, x: string, y: string) => {
        await card.evaluate(
          (el: HTMLElement, [on, x, y]) => {
            el.style.setProperty('--foil-on', on ?? '');
            el.style.setProperty('--shine-x', x ?? '');
            el.style.setProperty('--shine-y', y ?? '');
          },
          [on, x, y],
        );
        // The picture's own pixels, behind nothing but the tile: all but the
        // two pixels round its edge, where a picture on a fractional place
        // blends with whatever is behind it, the tile that moves.
        const box = await frame.locator('img').first().boundingBox();
        if (box === null) throw new Error('the picture is not drawn');
        return page.screenshot({
          clip: {
            x: box.x + 2,
            y: box.y + 2,
            width: box.width - 4,
            height: box.height - 4,
          },
        });
      };
      const alone = await shot('0', '0.3', '0.25');
      for (const [on, x, y] of [
        ['1', '0.05', '0.1'],
        ['1', '0.5', '0.5'],
        ['1', '0.95', '0.9'],
        ['0.35', '0.5', '0.5'],
      ] as const) {
        const by = await differBy(reader, alone, await shot(on, x, y));
        // A layer over the picture would change it by a great deal, over all
        // of it: here it is not at all, with a little for rounding.
        expect(
          by.greatest,
          `${id} shine ${on}, light at ${x},${y}`,
        ).toBeLessThanOrEqual(4);
        expect(by.share, `${id} shine ${on}, light at ${x},${y}`).toBeLessThan(
          0.01,
        );
      }
      reached += 1;
    }
    await reader.close();
    expect(reached).toBe(5);
  });

  test('with another card of its row pointed at, the pictures are dimmed and no tile is, so that no word changes', async ({
    page,
  }) => {
    await ready(page);
    await firstRowInView(page);
    const pointed = page
      .locator('section.row')
      .first()
      .locator('li.card')
      .nth(1);
    const box = await pointed.locator('.front .card-title').boundingBox();
    if (box === null) throw new Error('the title is not drawn');
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    const cards = page.locator('section.row').first().locator('li.card');
    const total = await cards.count();
    let others = 0;
    for (let at = 0; at < total; at += 1) {
      const seen = await cards.nth(at).evaluate((el) => ({
        picture: getComputedStyle(el.querySelector('.frame img') as Element)
          .filter,
        tile: ['.front', '.back', '.card-faces'].map(
          (part) => getComputedStyle(el.querySelector(part) as Element).filter,
        ),
        pseudo: ['::before', '::after'].map(
          (which) =>
            getComputedStyle(el.querySelector('.front') as Element, which)
              .filter,
        ),
      }));
      expect(seen.tile, `card ${at}`).toEqual(['none', 'none', 'none']);
      expect(seen.pseudo, `card ${at}`).toEqual(['none', 'none']);
      if (at === 1) expect(seen.picture, `card ${at}`).toBe('none');
      else {
        expect(seen.picture, `card ${at}`).toMatch(/brightness\(0\.55\)/);
        others += 1;
      }
    }
    expect(others).toBeGreaterThan(2);
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

// Every card has the same border (the owner, 2026-11-23: the best cards'
// rainbow edge was too strong), and a card's front is a tile in its finish: its
// base colour inside a dark edge, the picture set into it by the inset with a
// thin ring, and its label and title padded inside it, dark, the ground's ink.
test('every card has the same border and no edge of its own, the same inset, and its front’s words are padded inside it in the ink', async ({
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
      const frame = front.querySelector('.frame') as Element;
      return {
        id: (card as HTMLElement).dataset['entry'] ?? '?',
        border: `${style.borderTopWidth} ${style.borderTopStyle} ${style.borderTopColor} ${style.borderLeftWidth} ${style.borderBottomWidth}`,
        inset: `${style.paddingTop} ${style.paddingLeft} ${style.paddingRight} ${style.paddingBottom}`,
        ring: getComputedStyle(frame).boxShadow,
        edge: getComputedStyle(
          card.querySelector('.card-faces') as Element,
          '::before',
        ).content,
        ink: [label.color, title.color],
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
    // A dark edge, the ground's ink at a share of itself, and not the picture's
    // green of the page's other edges.
    expect(front.border, front.id).toMatch(
      /^1px solid color\(srgb 0\.0470588 0\.0745098 0\.0666667 \/ 0\.35\)/,
    );
    expect(front.inset, front.id).toBe('7px 7px 7px 0px');
    expect(front.ring, front.id).toBe(first?.ring);
    expect(front.ring, front.id).toMatch(
      /^color\(srgb 0\.0470588 0\.0745098 0\.0666667 \/ 0\.45\)/,
    );
    expect(front.edge, front.id).toBe('none');
    expect(front.ink, front.id).toEqual(['rgb(12, 19, 17)', 'rgb(12, 19, 17)']);
    expect(front.padding, front.id).toEqual(first?.padding);
    expect(parseFloat(front.padding[0] ?? '0'), front.id).toBeGreaterThan(0);
    expect(front.foot, front.id).toBeGreaterThan(0);
  }
});

// Every card has a finish (data-finish, from the catalogue) and is a tile in
// it: a base colour and the finish's own layers on the front, a glare over it,
// and nothing else of the finish's. Each finish is told from the others by what
// it draws, so that a finish that drew another's look would fail, and each is
// counted as reached.
test.describe('every finish is a tile of its own', () => {
  const BASES: Record<string, string> = {
    holo: 'rgb(207, 213, 222)',
    gold: 'rgb(216, 171, 66)',
    galaxy: 'rgb(170, 166, 226)',
    ice: 'rgb(176, 186, 198)',
    reverse: 'rgb(201, 206, 214)',
  };

  interface Drawn {
    finish: string;
    id: string;
    ground: string;
    image: string;
    size: string;
    glare: {
      content: string;
      display: string;
      image: string;
      blend: string;
      presses: string;
    };
  }

  async function drawn(page: Page): Promise<Drawn[]> {
    return page.locator('li.card').evaluateAll((cards) =>
      cards.map((card) => {
        const front = card.querySelector('.front') as Element;
        const style = getComputedStyle(front);
        const glare = getComputedStyle(front, '::after');
        return {
          finish: (card as HTMLElement).dataset['finish'] ?? '',
          id: (card as HTMLElement).dataset['entry'] ?? '',
          ground: style.backgroundColor,
          image: style.backgroundImage,
          size: style.backgroundSize,
          glare: {
            content: glare.content,
            display: glare.display,
            image: glare.backgroundImage,
            blend: glare.mixBlendMode,
            presses: glare.pointerEvents,
          },
        };
      }),
    );
  }

  test('each card is the tile of its finish and no other’s', async ({
    page,
  }) => {
    await ready(page);
    const cards = await drawn(page);
    const reached: Record<string, number> = {};
    for (const card of cards) {
      reached[card.finish] = (reached[card.finish] ?? 0) + 1;
      const name = `${card.id} (${card.finish})`;
      expect(card.ground, name).toBe(BASES[card.finish]);
      // The glare is a soft light over the tile, behind the picture and the
      // words, and takes no press.
      expect(card.glare.content, name).not.toBe('none');
      expect(card.glare.blend, name).toBe('soft-light');
      expect(card.glare.presses, name).toBe('none');
      expect(card.glare.image, name).toContain('radial-gradient');
      const count = (what: RegExp) => card.image.match(what)?.length ?? 0;
      switch (card.finish) {
        case 'holo':
          // Bars of light, and a rainbow of five pale stops over silver.
          expect(count(/repeating-linear-gradient/g), name).toBe(2);
          expect(card.image, name).toContain('rgb(255, 154, 180)');
          expect(card.image, name).toContain('rgb(180, 168, 255)');
          break;
        case 'gold':
          expect(count(/repeating-linear-gradient/g), name).toBe(2);
          expect(card.image, name).toContain('rgb(201, 154, 51)');
          expect(card.image, name).toContain('rgb(251, 231, 166)');
          break;
        case 'galaxy':
          expect(count(/radial-gradient/g), name).toBe(3);
          expect(card.image, name).toContain('rgb(231, 156, 204)');
          expect(card.image, name).toContain('rgb(143, 192, 245)');
          break;
        case 'ice':
          expect(card.image, name).toContain('/foil-ice.svg');
          expect(count(/repeating-linear-gradient/g), name).toBe(0);
          break;
        case 'reverse':
          expect(count(/repeating-linear-gradient/g), name).toBe(2);
          expect(count(/(?<!repeating-)linear-gradient/g), name).toBe(1);
          expect(card.image, name).toContain('rgb(174, 182, 193)');
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

  test('with forced colours no finish is drawn on any front', async ({
    page,
  }) => {
    await page.emulateMedia({ forcedColors: 'active' });
    await ready(page);
    const cards = await drawn(page);
    const finishes = new Set<string>();
    for (const card of cards) {
      finishes.add(card.finish);
      const name = `${card.id} (${card.finish})`;
      expect(card.image, name).toBe('none');
      expect(card.glare.content, name).toBe('""');
      expect(card.glare.display, name).toBe('none');
    }
    expect(finishes.size).toBe(5);
  });

  test('each finish shows a little at rest and all of it under a mouse, its tile drawn the more for it, with the lift', async ({
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
    const tile = (card: Locator) =>
      card.evaluate((el) => {
        const front = el.querySelector('.front') as Element;
        return `${getComputedStyle(front).backgroundImage} | ${getComputedStyle(front, '::after').backgroundImage}`;
      });
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
      const atRest = await tile(card);
      const box = await card.locator('.front .card-title').boundingBox();
      if (box === null) throw new Error('the title is not drawn');
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await expect.poll(() => onOf(card), id).toBe(1);
      // The tile is drawn with more of its light, by the glare at least.
      expect(await tile(card), id).not.toBe(atRest);
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
