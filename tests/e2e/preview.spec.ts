// Holds part 7 of plans/effects.md, "a preview on a card": a card that has
// previews shows them in turn after a pause when a mouse hovers it or keyboard
// focus arrives on its link, one pass, then rests on its own picture; leaving
// stops it at once and it can be played again without fetching again. It does
// nothing, and fetches nothing, with reduced motion, with Save-Data on, by
// touch, or while the card's own picture has not arrived, and a preview that
// is slow is skipped, never shown blank. The layer is decoration, so a card has
// one picture in the accessibility tree before, during and after a pass, and
// with script off nothing is fetched or seen. Nothing is fetched at load.
//
// Time is stepped and never waited on: Playwright's clock is installed before
// the page and paused once it is up, so requestAnimationFrame, performance.now
// and Date move only when a test runs the clock (as moving.spec.ts does the
// pad). What a test does wait for is a state: a picture to have arrived (the
// network is real) or a fade to be over (asked of the document's animations).
// Save-Data is stood in for, since headless Chromium has no such setting: the
// page's navigator.connection is made to say saveData. Touch is stood in for by
// a context with touch and by a dispatched pointerenter of type touch, since
// no real phone is here. That proves the rule and the reading, not a device.
// Each test counts what it reached.
import { expect, type Locator, type Page } from '@playwright/test';
import { DAY_ZERO, test } from '../clock';

test.use({ viewport: { width: 1440, height: 1000 } });

/** One frame of the stepped clock, in ms: where Playwright's rAF falls. */
const FRAME = 16;

/** The first row's second card: Aquaclysm, with three previews. */
const AQUA = 'aquaclysm';
/** A linked card with no previews, in the same row. */
const PLAIN = 'chess';
/** An unlinked card with previews, in the last row, which is a late one. */
const SNAPPY = 'snappy';

const card = (page: Page, id: string): Locator =>
  page.locator(`li.card[data-entry="${id}"]`).first();
const link = (page: Page, id: string): Locator =>
  card(page, id).locator('a.card-link');

/** Every address a card's previews hold, from the markup, as absolute urls. */
async function addressesOf(page: Page, id: string): Promise<string[]> {
  return page.evaluate((entry) => {
    const found: string[] = [];
    const images = document.querySelectorAll<HTMLImageElement>(
      `li.card[data-entry="${entry}"] .previews img`,
    );
    for (const image of images) {
      for (const name of ['data-preview-srcset', 'data-preview-src']) {
        const value = image.getAttribute(name) ?? '';
        for (const part of value.split(',')) {
          const first = part.trim().split(/\s+/)[0] ?? '';
          if (first !== '') found.push(new URL(first, location.href).href);
        }
      }
    }
    return found;
  }, id);
}

/** Starts listening for requests, and says which were for these addresses. */
function watch(page: Page): { urls: string[] } {
  const seen = { urls: [] as string[] };
  page.on('request', (request) => seen.urls.push(request.url()));
  return seen;
}

function asked(seen: { urls: string[] }, addresses: string[]): string[] {
  return seen.urls.filter((url) => addresses.includes(url));
}

/**
 * The page with the clock installed from the start and then held, script run,
 * and a count of the frames the page asks for set up (the page's own
 * requestAnimationFrame is wrapped, so that "no frame is being asked for" is
 * a number that can be read).
 */
async function opened(page: Page): Promise<void> {
  await page.clock.install({ time: DAY_ZERO });
  await page.goto('/');
  await expect(page.locator('[aria-disabled]').first()).toBeAttached();
  await page.clock.pauseAt(DAY_ZERO + 1000);
  await page.evaluate(() => {
    const real = window.requestAnimationFrame.bind(window);
    Reflect.set(window, '__frames', 0);
    window.requestAnimationFrame = (callback) => {
      Reflect.set(
        window,
        '__frames',
        Number(Reflect.get(window, '__frames')) + 1,
      );
      return real(callback);
    };
  });
}

function frames(page: Page): Promise<number> {
  return page.evaluate(() => Number(Reflect.get(window, '__frames')));
}

/** Runs the held clock on by `ms`, a frame at a time, so every frame is seen. */
async function step(page: Page, ms: number): Promise<void> {
  for (let done = 0; done < ms; done += FRAME) await page.clock.runFor(FRAME);
}

interface Still {
  marked: boolean;
  opacity: number;
  hasSrc: boolean;
}

/**
 * Each preview of a card as it is drawn, once any fade has finished: whether
 * the script marked it, its computed opacity, and whether it has an address.
 */
function stills(page: Page, id: string): Promise<Still[]> {
  return page.evaluate(async (entry) => {
    const images = [
      ...document.querySelectorAll<HTMLImageElement>(
        `li.card[data-entry="${entry}"] .previews img`,
      ),
    ];
    await Promise.all(
      images.flatMap((image) =>
        image.getAnimations().map((each) => each.finished.catch(() => null)),
      ),
    );
    return images.map((image) => ({
      marked: image.hasAttribute('data-showing'),
      opacity: Number(getComputedStyle(image).opacity),
      hasSrc: image.getAttribute('src') !== null,
    }));
  }, id);
}

/** Which one shows: its place, or null for none. Fails if two are marked. */
async function showing(page: Page, id: string): Promise<number | null> {
  const found = await stills(page, id);
  const marked = found.flatMap((each, at) => (each.marked ? [at] : []));
  expect(marked.length, 'previews marked at once').toBeLessThanOrEqual(1);
  // What is marked is what is drawn: opaque, and every other clear.
  found.forEach((each, at) =>
    expect(each.opacity, `preview ${at}'s opacity`).toBe(
      marked[0] === at ? 1 : 0,
    ),
  );
  return marked[0] ?? null;
}

/** Every preview of a card has arrived (or failed), which is a state of the net. */
async function arrived(page: Page, id: string, only?: number[]): Promise<void> {
  await expect
    .poll(() =>
      page.evaluate(
        ([entry, wanted]) =>
          [
            ...document.querySelectorAll<HTMLImageElement>(
              `li.card[data-entry="${entry}"] .previews img`,
            ),
          ]
            .filter((_, at) => wanted === null || wanted.includes(at))
            .every((image) => image.complete && image.naturalWidth > 0),
        [id, only ?? null] as const,
      ),
    )
    .toBe(true);
}

/** Past the pause, the previews asked for and arrived, then into the first turn. */
async function intoFirstTurn(page: Page, id: string): Promise<void> {
  await step(page, 700);
  await arrived(page, id);
  await step(page, 100);
}

/** The mouse away from every card. */
async function away(page: Page): Promise<void> {
  await page.mouse.move(5, 5);
}

/** Tab, as a user does, until focus is on this card's link. */
async function tabTo(page: Page, id: string): Promise<void> {
  for (let pressed = 0; pressed < 60; pressed += 1) {
    await page.keyboard.press('Tab');
    const here = await page.evaluate(
      () =>
        document.activeElement?.closest<HTMLElement>('li.card')?.dataset[
          'entry'
        ] ?? '',
    );
    if (here === id) return;
  }
  throw new Error(`Tab never reached the link of ${id}`);
}

test.describe('the markup', () => {
  test('nothing is fetched at load, and no preview has an address to fetch', async ({
    page,
  }) => {
    const seen = watch(page);
    await page.goto('/');
    await expect(page.locator('[aria-disabled]').first()).toBeAttached();
    await page.waitForLoadState('networkidle');
    const layers = await page.locator('li.card .previews').count();
    // Seven cards have previews, and the layer is on each, so that a page
    // with none (or a typo in a name) is a failure and not a pass.
    expect(layers).toBe(7);
    let addresses = 0;
    for (const id of [
      'nuclear-fishin',
      AQUA,
      'coinpush',
      'ooergolf',
      'pushminer',
      'chopdrop',
      SNAPPY,
    ]) {
      const some = await addressesOf(page, id);
      expect(some.length, `${id}'s addresses`).toBeGreaterThan(0);
      addresses += some.length;
      expect(asked(seen, some), `${id} fetched`).toEqual([]);
    }
    expect(addresses).toBeGreaterThan(40);
    const withSrc = await page
      .locator(
        'li.card .previews img[src], li.card .previews img[srcset], li.card .previews source',
      )
      .count();
    expect(withSrc).toBe(0);
    expect(await page.locator('li.card .previews img').count()).toBe(20);
  });

  test('the layer is decoration, each one is WebP at 480 and 800, and a card with none has no layer', async ({
    page,
  }) => {
    await page.goto('/');
    const counts = await page.$$eval('li.card', (cards) =>
      cards.map((each) => ({
        id: (each as HTMLElement).dataset['entry'] ?? '',
        layers: each.querySelectorAll('.previews').length,
        hidden: [...each.querySelectorAll('.previews')].every(
          (layer) => layer.getAttribute('aria-hidden') === 'true',
        ),
        alts: [...each.querySelectorAll('.previews img')].every(
          (image) => image.getAttribute('alt') === '',
        ),
        images: each.querySelectorAll('.previews img').length,
        insideFrame: each.querySelectorAll('.frame .previews').length,
        srcsets: [...each.querySelectorAll('.previews img')].map(
          (image) => image.getAttribute('data-preview-srcset') ?? '',
        ),
        // A picture says its size, so that a browser knows its shape before
        // it has any of it; preflight asks the same of every picture.
        shapes: [...each.querySelectorAll('.previews img')].map(
          (image) =>
            Number(image.getAttribute('width')) /
            Number(image.getAttribute('height')),
        ),
      })),
    );
    const previewed = counts.filter((each) => each.layers > 0);
    expect(previewed.map((each) => each.id).sort()).toEqual(
      [
        'aquaclysm',
        'chopdrop',
        'coinpush',
        'nuclear-fishin',
        'ooergolf',
        'pushminer',
        'snappy',
      ].sort(),
    );
    for (const each of previewed) {
      expect(each.layers, `${each.id} layers`).toBe(1);
      expect(each.insideFrame, `${each.id} in its frame`).toBe(1);
      expect(each.hidden, `${each.id} aria-hidden`).toBe(true);
      expect(each.alts, `${each.id} alt`).toBe(true);
      expect(each.shapes.length, `${each.id} has previews`).toBeGreaterThan(0);
      for (const shape of each.shapes)
        expect(shape, `${each.id} says a 16 by 9 size`).toBeCloseTo(16 / 9, 2);
      for (const srcset of each.srcsets) {
        const parts = srcset.split(',').map((part) => part.trim());
        expect(parts.map((part) => part.split(/\s+/)[1])).toEqual([
          '480w',
          '800w',
        ]);
        expect(parts.every((part) => part.includes('.webp'))).toBe(true);
      }
    }
    expect(
      Object.fromEntries(previewed.map((each) => [each.id, each.images])),
    ).toEqual({
      aquaclysm: 3,
      chopdrop: 3,
      coinpush: 2,
      'nuclear-fishin': 3,
      ooergolf: 3,
      pushminer: 3,
      snappy: 3,
    });
    expect(counts.length).toBeGreaterThan(12);
  });
});

test.describe('a mouse', () => {
  test('hovering runs the pass: nothing in the pause, each preview at its second, then the card rests', async ({
    page,
  }) => {
    const seen = watch(page);
    // The content policy refuses what it must, and a refusal is a console
    // error: a whole pass is made to leave none.
    const noise: string[] = [];
    page.on('console', (message) => {
      if (['error', 'warning'].includes(message.type()))
        noise.push(message.text());
    });
    page.on('pageerror', (error) => noise.push(error.message));
    await opened(page);
    const addresses = await addressesOf(page, AQUA);
    await card(page, AQUA).hover();
    // Just under the pause: nothing shows, nothing is fetched.
    await step(page, 560);
    expect(await showing(page, AQUA)).toBeNull();
    expect(asked(seen, addresses)).toEqual([]);
    expect(
      await frames(page),
      'frames asked for while playing',
    ).toBeGreaterThan(0);
    // Past it: the previews are asked for, on the first start.
    await step(page, 100);
    await expect.poll(() => asked(seen, addresses).length).toBeGreaterThan(0);
    await arrived(page, AQUA);
    expect(
      (await stills(page, AQUA)).every((each) => each.hasSrc),
      'every preview has its address now',
    ).toBe(true);
    // Each at its second, in order: turn n is 600 + 1000n to 600 + 1000(n+1).
    await step(page, 100);
    expect(await showing(page, AQUA)).toBe(0);
    await step(page, 1000);
    expect(await showing(page, AQUA)).toBe(1);
    await step(page, 1000);
    expect(await showing(page, AQUA)).toBe(2);
    // The hovered card's own previews are not dimmed, and its neighbours are.
    const filters = await page.evaluate(() =>
      [...document.querySelectorAll('section.row')][0]
        ?.querySelectorAll('li.card')
        .values()
        .map((each) => ({
          id: (each as HTMLElement).dataset['entry'] ?? '',
          filter: getComputedStyle(each.querySelector('.frame img') as Element)
            .filter,
          previews: [...each.querySelectorAll('.previews img')].map(
            (image) => getComputedStyle(image).filter,
          ),
        }))
        .toArray(),
    );
    const mine = filters?.find((each) => each.id === AQUA);
    expect(mine?.filter).toBe('none');
    expect(mine?.previews.length).toBe(3);
    expect(mine?.previews.every((each) => each === 'none')).toBe(true);
    expect(
      filters?.filter((each) => each.id !== AQUA && each.filter !== 'none')
        .length,
    ).toBeGreaterThan(0);
    // After the last the card rests on its own picture, with the mouse still
    // there, and the page asks for no more frames.
    await step(page, 1000);
    expect(await showing(page, AQUA)).toBeNull();
    const before = await frames(page);
    await step(page, 2000);
    expect(await frames(page), 'frames asked for once it rests').toBe(before);
    expect(await showing(page, AQUA)).toBeNull();
    // Nothing was asked for twice.
    const once = asked(seen, addresses);
    expect(new Set(once).size).toBe(once.length);
    expect(noise, 'console during a pass').toEqual([]);
  });

  test('leaving stops it at once, and entering again starts from the beginning without fetching again', async ({
    page,
  }) => {
    const seen = watch(page);
    await opened(page);
    const addresses = await addressesOf(page, AQUA);
    await card(page, AQUA).hover();
    await intoFirstTurn(page, AQUA);
    await step(page, 1000);
    expect(await showing(page, AQUA)).toBe(1);
    const fetched = asked(seen, addresses).length;
    expect(fetched).toBeGreaterThan(0);
    await away(page);
    // At once: before another frame, the mark is gone and the loop is not
    // asked to run on.
    expect(
      (await stills(page, AQUA)).some((each) => each.marked),
      'still marked after leaving',
    ).toBe(false);
    const stopped = await frames(page);
    await step(page, 3000);
    expect(await frames(page)).toBe(stopped);
    expect(await showing(page, AQUA)).toBeNull();
    // Again: the pause comes first, and the first preview is the first.
    await card(page, AQUA).hover();
    await step(page, 500);
    expect(await showing(page, AQUA)).toBeNull();
    await step(page, 300);
    expect(await showing(page, AQUA)).toBe(0);
    expect(asked(seen, addresses).length, 'fetched again').toBe(fetched);
  });

  test('a pass that is let go before the pause ends starts nothing and fetches nothing', async ({
    page,
  }) => {
    const seen = watch(page);
    await opened(page);
    const addresses = await addressesOf(page, AQUA);
    await card(page, AQUA).hover();
    await step(page, 400);
    await away(page);
    await step(page, 3000);
    expect(asked(seen, addresses)).toEqual([]);
    expect(await showing(page, AQUA)).toBeNull();
  });

  test('a card with no previews does nothing on hover or focus', async ({
    page,
  }) => {
    const seen = watch(page);
    await opened(page);
    expect(
      await page.locator(`li.card[data-entry="${PLAIN}"] .previews`).count(),
    ).toBe(0);
    const before = seen.urls.length;
    await card(page, PLAIN).hover();
    await step(page, 5000);
    expect(await frames(page)).toBe(0);
    await away(page);
    await link(page, PLAIN).evaluate((el) =>
      (el as HTMLElement).focus({ focusVisible: true }),
    );
    await expect(link(page, PLAIN)).toBeFocused();
    await step(page, 5000);
    expect(await frames(page)).toBe(0);
    // Nothing on the page was marked, and no new request was made.
    expect(await page.locator('.previews [data-showing]').count()).toBe(0);
    expect(seen.urls.length).toBe(before);
  });

  test('an unlinked card with previews plays on hover, once its own picture has arrived and not before', async ({
    page,
  }) => {
    const seen = watch(page);
    let release: () => void = () => undefined;
    const gate = new Promise<void>((done) => {
      release = done;
    });
    // Its own picture's files only: the previews are named snappy-1 and so on.
    await page.route('**/_astro/snappy.*', async (route) => {
      await gate;
      await route.continue().catch(() => undefined);
    });
    await opened(page);
    expect(await link(page, SNAPPY).count(), 'it has no link').toBe(0);
    const addresses = await addressesOf(page, SNAPPY);
    await card(page, SNAPPY).scrollIntoViewIfNeeded();
    // Its row is brought in, and its picture is on the way, held at the route.
    await expect(
      page.locator(`li.card[data-entry="${SNAPPY}"] img[data-src]`),
    ).toHaveCount(0);
    await card(page, SNAPPY).hover();
    await step(page, 5000);
    expect(asked(seen, addresses), 'fetched before its own picture').toEqual(
      [],
    );
    expect(await showing(page, SNAPPY)).toBeNull();
    // The picture arrives; the card is left and entered again, and plays.
    release();
    await expect(
      page.locator(`li.card[data-entry="${SNAPPY}"] .frame img[data-arrived]`),
    ).toHaveCount(1);
    await away(page);
    await card(page, SNAPPY).hover();
    await intoFirstTurn(page, SNAPPY);
    expect(await showing(page, SNAPPY)).toBe(0);
    expect(asked(seen, addresses).length).toBeGreaterThan(0);
  });

  test('a preview that is slow is not shown at its turn, the card keeps its own picture, and the others still show', async ({
    page,
  }) => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((done) => {
      release = done;
    });
    await page.route('**/_astro/aquaclysm-2.*', async (route) => {
      await gate;
      await route.continue().catch(() => undefined);
    });
    await opened(page);
    await card(page, AQUA).hover();
    await step(page, 700);
    await arrived(page, AQUA, [0, 2]);
    await step(page, 100);
    expect(await showing(page, AQUA)).toBe(0);
    // Its turn: the held one is not there, so none is shown and not a blank.
    await step(page, 1000);
    const held = await stills(page, AQUA);
    expect(held[1]?.marked).toBe(false);
    expect(held.every((each) => each.opacity === 0)).toBe(true);
    await step(page, 1000);
    expect(await showing(page, AQUA)).toBe(2);
    release();
  });

  test('a card focused by arrow key plays, since that is keyboard focus', async ({
    page,
  }) => {
    await opened(page);
    await tabTo(page, 'nuclear-fishin');
    await page.keyboard.press('ArrowRight');
    await expect(link(page, AQUA)).toBeFocused();
    await intoFirstTurn(page, AQUA);
    expect(await showing(page, AQUA)).toBe(0);
  });
});

test.describe('the keyboard', () => {
  test('focus on the link runs the pass, and Tab away stops it', async ({
    page,
  }) => {
    const seen = watch(page);
    await opened(page);
    const addresses = await addressesOf(page, AQUA);
    await tabTo(page, AQUA);
    await step(page, 400);
    expect(await showing(page, AQUA)).toBeNull();
    expect(asked(seen, addresses)).toEqual([]);
    await intoFirstTurn(page, AQUA);
    expect(await showing(page, AQUA)).toBe(0);
    await step(page, 1000);
    expect(await showing(page, AQUA)).toBe(1);
    await page.keyboard.press('Tab');
    await expect(link(page, AQUA)).not.toBeFocused();
    expect(
      (await stills(page, AQUA)).some((each) => each.marked),
      'still marked after Tab',
    ).toBe(false);
    // The next card has previews too and plays; the one after has none, and
    // with focus there no frame is asked for.
    await page.keyboard.press('Tab');
    await expect(link(page, PLAIN)).toBeFocused();
    expect(
      (await stills(page, 'coinpush')).some((each) => each.marked),
      'the next card is not left playing',
    ).toBe(false);
    const stopped = await frames(page);
    await step(page, 3000);
    expect(await frames(page)).toBe(stopped);
  });
});

test.describe('where it does nothing, and fetches nothing', () => {
  async function nothing(page: Page, seen: { urls: string[] }): Promise<void> {
    const addresses = await addressesOf(page, AQUA);
    await card(page, AQUA).hover();
    await step(page, 5000);
    expect(await showing(page, AQUA)).toBeNull();
    expect(asked(seen, addresses), 'fetched on hover').toEqual([]);
    await away(page);
    await tabTo(page, AQUA);
    await step(page, 5000);
    expect(await showing(page, AQUA)).toBeNull();
    expect(asked(seen, addresses), 'fetched on focus').toEqual([]);
    expect(await frames(page), 'frames asked for').toBe(0);
    expect(
      (await stills(page, AQUA)).every((each) => !each.hasSrc),
      'an address was set',
    ).toBe(true);
  }

  test('with reduced motion', async ({ page }) => {
    const seen = watch(page);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await opened(page);
    await nothing(page, seen);
  });

  test('with Save-Data on', async ({ page }) => {
    const seen = watch(page);
    // Headless Chromium has no Save-Data setting to switch on, so the page is
    // told what the Network Information API says when it is on, before any
    // script of the page runs.
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'connection', {
        value: { saveData: true },
        configurable: true,
      });
    });
    await opened(page);
    expect(
      await page.evaluate(
        () =>
          (navigator as Navigator & { connection?: { saveData?: boolean } })
            .connection?.saveData,
      ),
    ).toBe(true);
    await nothing(page, seen);
  });

  test('with Save-Data present and off, it plays (so that the stand-in above is not what stops it)', async ({
    page,
  }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'connection', {
        value: { saveData: false },
        configurable: true,
      });
    });
    await opened(page);
    await card(page, AQUA).hover();
    await intoFirstTurn(page, AQUA);
    expect(await showing(page, AQUA)).toBe(0);
  });

  test('by touch: a pointerenter of type touch on a mouse-and-hover desk', async ({
    page,
  }) => {
    const seen = watch(page);
    await opened(page);
    const addresses = await addressesOf(page, AQUA);
    await card(page, AQUA).dispatchEvent('pointerenter', {
      pointerType: 'touch',
      isPrimary: true,
    });
    await step(page, 5000);
    expect(await showing(page, AQUA)).toBeNull();
    expect(asked(seen, addresses)).toEqual([]);
    expect(await frames(page)).toBe(0);
    // The same event of type mouse does start it, so that the above is the
    // type and not the way the event was made.
    await card(page, AQUA).dispatchEvent('pointerenter', {
      pointerType: 'mouse',
      isPrimary: true,
    });
    await intoFirstTurn(page, AQUA);
    expect(await showing(page, AQUA)).toBe(0);
  });
});

test.describe('on a touch screen', () => {
  test.use({ hasTouch: true });

  test('a tap, and a touch pointerenter, start nothing and fetch nothing', async ({
    page,
  }) => {
    const seen = watch(page);
    // A tap on a card's link would leave the page for the game's own.
    await page.addInitScript(() => {
      document.addEventListener(
        'click',
        (event) => event.preventDefault(),
        true,
      );
    });
    await opened(page);
    expect(
      await page.evaluate(() => matchMedia('(hover: none)').matches),
      'this context is a touch one',
    ).toBe(true);
    const addresses = await addressesOf(page, AQUA);
    await card(page, AQUA).tap();
    await card(page, AQUA).dispatchEvent('pointerenter', {
      pointerType: 'touch',
      isPrimary: true,
    });
    await step(page, 5000);
    expect(await showing(page, AQUA)).toBeNull();
    expect(asked(seen, addresses)).toEqual([]);
    expect(await frames(page)).toBe(0);
    expect((await stills(page, AQUA)).every((each) => !each.hasSrc)).toBe(true);
    // Even an event of type mouse is not a hover where there is none.
    await card(page, AQUA).dispatchEvent('pointerenter', {
      pointerType: 'mouse',
      isPrimary: true,
    });
    await step(page, 5000);
    expect(await showing(page, AQUA)).toBeNull();
    expect(asked(seen, addresses)).toEqual([]);
  });
});

test.describe('the accessibility tree', () => {
  test('holds one picture a card before, during and after a pass', async ({
    page,
  }) => {
    await opened(page);
    const count = () => card(page, AQUA).getByRole('img').count();
    expect(await count(), 'before').toBe(1);
    await card(page, AQUA).hover();
    await intoFirstTurn(page, AQUA);
    expect(await showing(page, AQUA)).toBe(0);
    expect(await count(), 'during').toBe(1);
    await step(page, 3000);
    expect(await showing(page, AQUA)).toBeNull();
    expect(await count(), 'after').toBe(1);
    // The one is the card's own, with its own words.
    await expect(card(page, AQUA).getByRole('img')).toHaveAttribute(
      'alt',
      /Aquaclysm/,
    );
    // And the layer is a node the tree does not hold at all.
    const exposed = await card(page, AQUA)
      .locator('.previews img')
      .evaluateAll((images) =>
        images.map((image) => image.closest('[aria-hidden="true"]') !== null),
      );
    expect(exposed).toEqual([true, true, true]);
  });
});
