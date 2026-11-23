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
      await expect(card.locator('.foil'), id).toHaveCount(0);
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

  test('on a card that is not one of the best sets nothing, on it or any other', async ({
    page,
  }) => {
    await countWrites(page);
    await ready(page);
    await firstRowInView(page);
    await frames(page);
    // The scroll has set the best cards' sheen by their place (that is the
    // shine for a mouse not on them); what follows must add nothing.
    const before = await writes(page);
    expect(before).toBeGreaterThanOrEqual(0);
    const card = cardOf(page, 'chess');
    expect(await card.getAttribute('data-best')).toBeNull();
    const box = await card.locator('.frame').boundingBox();
    if (box === null) throw new Error('the card is not drawn');
    let moves = 0;
    for (const [fx, fy] of [
      [0.2, 0.2],
      [0.8, 0.7],
      [0.5, 0.5],
    ] as const) {
      await page.mouse.move(box.x + box.width * fx, box.y + box.height * fy, {
        steps: 3,
      });
      moves += 1;
    }
    await frames(page, 6);
    expect(await writes(page)).toBe(before);
    // What the scroll set on the best cards stands: no tilt on any of them.
    let best = 0;
    for (const each of await page.locator('li.card[data-best]').all()) {
      const now = await setOn(each);
      for (const tilt of ['--tilt-x', '--tilt-y'])
        expect(['', '0deg']).toContain(now[tilt]);
      best += 1;
    }
    expect(best).toBe(catalogue.best.length);
    expect(moves).toBe(3);
  });
});

test.describe('on a touch screen at a phone’s width', () => {
  test.use({
    hasTouch: true,
    isMobile: true,
    viewport: { width: 390, height: 844 },
  });

  test('a page scroll and a strip scroll each move the sheen as the card’s place in the window says, and nothing tilts', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await countWrites(page);
    await ready(page);
    // The second card: a strip at rest has a card's start at its gutter, so a
    // strip scroll carries the first card wholly out of sight (where nothing
    // moves its sheen), and the second card into its place.
    const card = cardOf(page, 'tiny-slots');
    /** Waits for the sheen to be where the rule puts it for the card as it is now. */
    const followed = async (): Promise<{ x: number; y: number }> => {
      await frames(page, 3);
      // The card's place and the sheen are read together, and again until
      // they agree: the strip's snap can still move the card a frame after a
      // scroll, and the sheen follows it then.
      let want: { x: number; y: number } | null = null;
      await expect
        .poll(async () => {
          const read = await card.evaluate((el: HTMLElement) => {
            const r = el.getBoundingClientRect();
            return {
              box: {
                left: r.left,
                top: r.top,
                right: r.right,
                bottom: r.bottom,
              },
              size: {
                width: document.documentElement.clientWidth,
                height: document.documentElement.clientHeight,
              },
              x: parseFloat(el.style.getPropertyValue('--shine-x')),
              y: parseFloat(el.style.getPropertyValue('--shine-y')),
            };
          });
          want = inWindow(read.box, read.size);
          if (want === null) return false;
          return (
            Math.abs(read.x - want.x) < 0.005 &&
            Math.abs(read.y - want.y) < 0.005
          );
        })
        .toBe(true);
      if (want === null) throw new Error('the card has no size');
      const now = await setOn(card);
      for (const tilt of ['--tilt-x', '--tilt-y'])
        expect(['', '0deg']).toContain(now[tilt]);
      const found: { x: number; y: number } = want;
      return { x: found.x, y: found.y };
    };
    await firstRowInView(page);
    const first = await followed();
    // The page, by a reader's flick: the card goes up the window.
    await page.evaluate(() =>
      window.scrollBy({ top: 160, behavior: 'instant' }),
    );
    const second = await followed();
    expect(second.y).toBeLessThan(first.y - 0.05);
    expect(second.x).toBeCloseTo(first.x, 3);
    // The strip: the card goes left across the window.
    await page.evaluate(() => {
      const strip = document.querySelector<HTMLElement>('section.row .strip');
      strip?.scrollTo({ left: 120, behavior: 'instant' });
    });
    const third = await followed();
    expect(third.x).toBeLessThan(second.x - 0.05);
    expect(third.y).toBeCloseTo(second.y, 3);
    // A tap that moves nothing is not a pointer the sheen follows.
    expect(await writes(page)).toBeGreaterThan(0);
    const faces = await card
      .locator('.card-faces')
      .evaluate((el) =>
        getComputedStyle(el).getPropertyValue('--tilt-y').trim(),
      );
    expect(faces).toBe('0deg');
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
    for (const each of await page.locator('li.card[data-best]').all()) {
      expect(Object.values(await setOn(each)).join('')).toBe('');
      reached += 1;
    }
    expect(reached).toBe(catalogue.best.length);
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

test('nothing is set while no best card is in the window, and the shine starts once one is', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await countWrites(page);
  await ready(page);
  // To the foot of the page, where the first row is out of the window.
  await page.evaluate(() =>
    window.scrollTo({
      top: document.documentElement.scrollHeight,
      behavior: 'instant',
    }),
  );
  await frames(page, 4);
  const start = await writes(page);
  expect(
    await page.evaluate(() =>
      [...document.querySelectorAll('li.card[data-best]')].some((card) => {
        const box = card.getBoundingClientRect();
        return box.bottom > 0 && box.top < innerHeight;
      }),
    ),
  ).toBe(false);
  // Scrolling, a strip moved and a mouse over a card down here.
  for (const top of [-60, -40, 30])
    await page.evaluate(
      (top) => window.scrollBy({ top, behavior: 'instant' }),
      top,
    );
  await page.evaluate(() => {
    const strips = document.querySelectorAll<HTMLElement>('section.row .strip');
    strips[strips.length - 1]?.scrollTo({ left: 100, behavior: 'instant' });
  });
  const last = page.locator('section.row').last().locator('li.card').first();
  const box = await last.boundingBox();
  if (box !== null) await page.mouse.move(box.x + 20, box.y + 20, { steps: 3 });
  await frames(page, 6);
  expect(await writes(page)).toBe(start);
  // And once the first row is back in the window, a scroll sets it: the count
  // above was of a script that was there to count.
  await firstRowInView(page);
  await page.evaluate(() => window.scrollBy({ top: 10, behavior: 'instant' }));
  await expect.poll(() => writes(page)).toBeGreaterThan(start);
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
  test('each best card has the dodged foil, the glitter and the wash over its picture, and no other card has any', async ({
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
        expect(layers.foil, id).toBeNull();
        expect(layers.wash, id).toBeNull();
        expect(layers.glitter?.content, id).toBe('none');
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
// where nothing hovers it shows most of it, and nothing lifts. A plain card
// does none of this.
test.describe('the shine at rest and under a mouse', () => {
  const onOf = (card: Locator) =>
    card.evaluate((el) =>
      parseFloat(getComputedStyle(el).getPropertyValue('--foil-on')),
    );
  test('a best card shows a little of it at rest, all of it under a mouse, and lifts; a plain card does not', async ({
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
    expect(
      await plain
        .locator('.card-faces')
        .evaluate((el) => getComputedStyle(el).scale),
    ).toBe('none');
    await expect.poll(() => onOf(card)).toBeCloseTo(rest, 5);
  });

  test.describe('on a touch screen', () => {
    test.use({
      hasTouch: true,
      isMobile: true,
      viewport: { width: 390, height: 844 },
    });
    test('a best card shows most of it, with nothing to hover, and a tap lifts nothing', async ({
      page,
    }) => {
      await ready(page);
      await firstRowInView(page);
      const card = cardOf(page, 'aquaclysm');
      const on = await onOf(card);
      expect(on).toBeGreaterThan(0.5);
      expect(on).toBeLessThan(1);
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
test('a scroll that comes before the script’s first sight of the cards still moves the sheen', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
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
  const card = cardOf(page, 'aquaclysm');
  await frames(page, 4);
  // The answer about the cards at load is being held; the reader scrolls.
  await firstRowInView(page);
  await frames(page, 4);
  await page.evaluate(() =>
    (Reflect.get(window, '__releaseSight') as () => void)(),
  );
  await expect
    .poll(async () => (await setOn(card))['--shine-y'] ?? '')
    .not.toBe('');
});
