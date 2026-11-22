// Holds the "Surprise me" button, worked as a user works it, with real clicks,
// real Enter presses and real Tab: with script it is shown, named, last among
// the header's row links in Tab order and at least 44 by 44; a press puts
// focus on the link of a card that has one, ringed and in the window, follows
// no link and asks nothing of another origin; the same seed gives the same
// picks and another gives others; it never picks the card that had focus, the
// last pick, or a card with no link; a pick in a late row brings that row's
// pictures in; a seed that is not an integer is ignored and the button still
// works; and with fewer than two playable cards it stays hidden. The seed is
// handed in through the test API, window.ooerflixSeed, by an init script that
// runs before the page's own. Runs are compared with each other and never with
// ids copied out of the code under test, and each test counts what it reached
// so that picking nothing is a failure. Script off is in nojs.spec.ts.
import { expect, test, type Browser, type Page } from '@playwright/test';

const SIZES = [
  { width: 1440, height: 1000 },
  { width: 390, height: 844 },
];

/** What a press left behind: where focus is, and whether it is seen. */
interface Landed {
  entry: string;
  linked: boolean;
  onLink: boolean;
  row: number;
  ringed: boolean;
  inside: boolean;
}

/**
 * A window.ooerflixSeed, set before any of the page's scripts run. It is
 * written as source and not passed as an argument, since an argument goes
 * through JSON, which turns NaN and an infinity into null and would make the
 * tests of a seed that is not a number test null three times.
 */
async function handSeed(page: Page, seed: unknown): Promise<void> {
  const source =
    typeof seed === 'number'
      ? String(seed)
      : (JSON.stringify(seed) ?? 'undefined');
  await page.addInitScript(`window.ooerflixSeed = ${source};`);
}

function button(page: Page) {
  return page.getByRole('button', { name: 'Surprise me' });
}

/** Opens the home page with a seed and waits for script to have shown it. */
async function open(page: Page, seed: unknown): Promise<void> {
  await handSeed(page, seed);
  await page.goto('/');
  await expect(button(page)).toBeVisible();
}

/** A press, as a mouse or as a keyboard makes it. */
async function press(page: Page, how: 'click' | 'enter' = 'click') {
  if (how === 'click') await button(page).click();
  else {
    await button(page).focus();
    await page.keyboard.press('Enter');
  }
}

/** Where focus is after a press, once any scroll to it has finished. */
async function landed(page: Page): Promise<Landed> {
  const read = () =>
    page.evaluate((): Landed => {
      const el = document.activeElement;
      const card = el?.closest<HTMLElement>('li.card') ?? null;
      const rows = [...document.querySelectorAll('section.row')];
      const none = {
        entry: '',
        linked: false,
        onLink: false,
        row: -1,
        ringed: false,
        inside: false,
      };
      if (el === null || card === null) return none;
      const box = card.getBoundingClientRect();
      const ring = getComputedStyle(card);
      return {
        entry: card.dataset['entry'] ?? '',
        linked: card.hasAttribute('data-linked'),
        onLink: el.matches('a.card-link'),
        row: rows.indexOf(card.closest('section.row') as Element),
        ringed:
          el.matches(':focus-visible') &&
          ring.outlineStyle !== 'none' &&
          parseFloat(ring.outlineWidth) >= 2 &&
          ring.outlineColor !== 'rgba(0, 0, 0, 0)',
        inside:
          box.left >= -1 &&
          box.top >= -1 &&
          box.right <= window.innerWidth + 1 &&
          box.bottom <= window.innerHeight + 1,
      };
    });
  // A strip glides to a card, so wait for it to be wholly in.
  await expect.poll(async () => (await read()).inside).toBe(true);
  return read();
}

/** The cards picked by `count` presses in a row, each with a click. */
async function picks(page: Page, count: number): Promise<string[]> {
  const found: string[] = [];
  for (let at = 0; at < count; at += 1) {
    await press(page);
    const now = await landed(page);
    expect(now.linked, 'the pick has a link').toBe(true);
    found.push(now.entry);
  }
  return found;
}

/**
 * Presses the button `count` times from inside the page (a script's click on
 * it, where a mouse's is too slow to be run hundreds of times), and returns
 * the card each press landed on. With `between`, a link of the header gets
 * focus before each press, so that the last pick is the only thing that could
 * keep a card from coming up twice running. The mouse's and the keyboard's
 * own presses are held by the tests that use real ones.
 */
function pressedInPage(
  page: Page,
  count: number,
  between: boolean,
): Promise<{ entry: string; linked: boolean }[]> {
  return page.evaluate(
    ({ count, between }) => {
      const button = document.querySelector<HTMLButtonElement>(
        'button[data-surprise]',
      );
      const nav = document.querySelector<HTMLElement>('.site-header nav a');
      if (button === null || nav === null) throw new Error('no button');
      const found: { entry: string; linked: boolean }[] = [];
      for (let at = 0; at < count; at += 1) {
        if (between) nav.focus();
        button.click();
        const card = document.activeElement?.closest<HTMLElement>('li.card');
        found.push({
          entry: card?.dataset['entry'] ?? '',
          linked: card?.hasAttribute('data-linked') ?? false,
        });
      }
      return found;
    },
    { count, between },
  );
}

for (const size of SIZES) {
  test.describe(`at ${size.width} wide`, () => {
    // Reduced motion, so that a press is not slowed by a glide to the card:
    // what it picks and where focus goes are the same either way.
    test.use({ viewport: size, reducedMotion: 'reduce' });

    test('the button is shown, named, after the row links in Tab order, and 44 by 44', async ({
      page,
    }) => {
      await open(page, 1);
      const names = await page.evaluate(() => {
        const nav = document.querySelector('.site-header nav');
        return [...(nav?.children ?? [])].map((el) => ({
          tag: el.tagName.toLowerCase(),
          text: (el.textContent ?? '').trim(),
        }));
      });
      const rowCount = await page.locator('section.row').count();
      expect(rowCount).toBeGreaterThan(0);
      expect(names.length).toBe(rowCount + 1);
      expect(names.at(-1)).toEqual({ tag: 'button', text: 'Surprise me' });
      expect(names.slice(0, -1).every((each) => each.tag === 'a')).toBe(true);
      // Real Tab: the skip link, each row link, then the button.
      const seen: string[] = [];
      for (let stop = 0; stop < rowCount + 2; stop += 1) {
        await page.keyboard.press('Tab');
        seen.push(
          await page.evaluate(() =>
            (document.activeElement?.textContent ?? '').trim(),
          ),
        );
      }
      expect(seen.at(-1)).toBe('Surprise me');
      expect(seen.slice(1, -1)).toEqual(names.slice(0, -1).map((n) => n.text));
      const box = await button(page).boundingBox();
      expect(box?.width).toBeGreaterThanOrEqual(44);
      expect(box?.height).toBeGreaterThanOrEqual(44);
    });

    for (const how of ['click', 'enter'] as const) {
      test(`a real ${how === 'click' ? 'click' : 'Enter on the focused button'} puts a ringed, seen focus on a playable card's link and follows nothing`, async ({
        page,
        baseURL,
      }) => {
        const own = new URL(baseURL ?? '').origin;
        const asked: string[] = [];
        page.on('request', (request) => asked.push(request.url()));
        await open(page, 7);
        const before = page.url();
        let reached = 0;
        for (let at = 0; at < 4; at += 1) {
          await press(page, how);
          const now = await landed(page);
          expect(now.onLink).toBe(true);
          expect(now.linked).toBe(true);
          expect(now.inside).toBe(true);
          expect(now.ringed).toBe(true);
          reached += 1;
        }
        expect(reached).toBe(4);
        expect(page.url()).toBe(before);
        expect(asked.length).toBeGreaterThan(3);
        expect(asked.filter((url) => new URL(url).origin !== own)).toEqual([]);
      });
    }

    test('the same seed gives the same five cards on a fresh load, and another seed others', async ({
      page,
    }) => {
      await open(page, 11);
      const first = await picks(page, 5);
      await open(page, 11);
      const again = await picks(page, 5);
      await open(page, 12);
      const other = await picks(page, 5);
      expect(first).toHaveLength(5);
      expect(new Set(first).size).toBeGreaterThan(1);
      expect(again).toEqual(first);
      expect(other).not.toEqual(first);
    });

    test('over twenty presses it never lands on the same card twice running, nor on one with no link', async ({
      page,
    }) => {
      const unlinked = await (async () => {
        await open(page, 3);
        return page.locator('li.card:not([data-linked])').count();
      })();
      // The test can only see an unlinked card picked if there is one.
      expect(unlinked).toBeGreaterThan(0);
      let counted = 0;
      for (const seed of [3, 4, 5]) {
        await open(page, seed);
        const found = await picks(page, 20);
        for (let at = 1; at < found.length; at += 1)
          expect(found[at]).not.toBe(found[at - 1]);
        counted += found.length;
      }
      expect(counted).toBe(60);
    });
  });
}

test.describe('what it leaves out', () => {
  test.use({ viewport: SIZES[0] });

  test('with focus on a card first, a press never picks that card, over 8 seeds', async ({
    page,
  }) => {
    let tried = 0;
    for (let seed = 1; seed <= 8; seed += 1) {
      // The first pick for this seed, seen from outside.
      await open(page, seed);
      await press(page);
      const first = (await landed(page)).entry;
      expect(first).not.toBe('');
      // The same seed again, with focus put on that very card first: its
      // first draw is the same, so only the rule can keep it from the card.
      await open(page, seed);
      await page.locator(`li.card[data-entry="${first}"] a.card-link`).focus();
      await press(page);
      const second = await landed(page);
      expect(second.linked).toBe(true);
      expect(second.entry).not.toBe(first);
      tried += 1;
    }
    expect(tried).toBe(8);
  });

  test('a pick is never the last pick, even when focus has gone elsewhere in between', async ({
    page,
  }) => {
    await open(page, 21);
    // Each cycle presses, puts focus on a row link, and presses again, 120
    // times: 240 presses. With 19 playable cards a draw that remembered
    // nothing would meet the last pick one time in 19, so the chance that
    // every cycle misses it is (18/19)^120, about 0.2%.
    const found = await pressedInPage(page, 240, true);
    expect(found).toHaveLength(240);
    expect(found.every((each) => each.linked)).toBe(true);
    for (let at = 1; at < found.length; at += 1)
      expect(found[at]?.entry).not.toBe(found[at - 1]?.entry);
  });

  test('a press in a late row loads that row’s pictures', async ({ page }) => {
    let tried = 0;
    let proved = 0;
    for (let seed = 1; seed <= 40 && proved === 0; seed += 1) {
      await open(page, seed);
      const waiting = await page.locator('section.row[data-late]').count();
      expect(waiting).toBeGreaterThan(0);
      await press(page);
      const now = await landed(page);
      tried += 1;
      if (now.row < 2) continue;
      const row = page.locator('section.row').nth(now.row);
      await expect(row.locator('img[data-src]')).toHaveCount(0);
      await expect
        .poll(() =>
          row
            .locator('img')
            .evaluateAll((all) =>
              all.every(
                (img) =>
                  (img as HTMLImageElement).complete &&
                  (img as HTMLImageElement).naturalWidth > 0,
              ),
            ),
        )
        .toBe(true);
      proved += 1;
    }
    expect(tried).toBeGreaterThan(0);
    expect(proved, 'a seed that lands in a late row was found').toBe(1);
  });

  test('over many presses it reaches many different cards', async ({
    page,
  }) => {
    await open(page, 31);
    const found = new Set(
      (await pressedInPage(page, 120, false)).map((each) => each.entry),
    );
    const playable = await page.locator('li.card[data-linked]').count();
    expect(playable).toBeGreaterThan(10);
    // 120 draws among 18 or so leave a given card out one time in a thousand
    // or so, and a button stuck on a few cards reaches far fewer than this.
    expect(found.size).toBeGreaterThan(playable * 0.6);
  });
});

test.describe('a seed from outside', () => {
  test.use({ viewport: SIZES[0] });

  for (const [name, seed] of [
    ['a string', '12'],
    ['NaN', Number.NaN],
    ['1.5', 1.5],
    ['an infinity', Infinity],
    ['null', null],
    ['an object', { seed: 3 }],
  ] as const) {
    test(`${name} is ignored, the clock is used, and the button still works`, async ({
      page,
    }) => {
      // With the clock held, "ignored" has a meaning a test can read: the
      // same picks as a page that was handed no seed at all. A seed used
      // after being coerced (12 for '12', 1 for 1.5, 0 for NaN) would give
      // others.
      await page.clock.setFixedTime(1_800_000_000_000);
      await open(page, undefined);
      const clock = await picks(page, 6);
      await open(page, seed);
      const found = await picks(page, 6);
      expect(found).toHaveLength(6);
      expect(found).toEqual(clock);
    });
  }

  test('a number that is not a seed is not used as one, a whole number is', async ({
    page,
  }) => {
    // 12 as a string must give what the clock gives, which is not what the
    // number 12 gives. The clock is held, so the two are told apart.
    await page.clock.setFixedTime(1_800_000_000_000);
    await open(page, '12');
    const ignored = await picks(page, 8);
    await open(page, 12);
    const used = await picks(page, 8);
    await open(page, 12);
    expect(await picks(page, 8)).toEqual(used);
    expect(ignored).not.toEqual(used);
  });

  test('with no seed the clock is the seed: one clock reading, one run', async ({
    page,
  }) => {
    await page.clock.setFixedTime(1_800_000_000_000);
    await page.goto('/');
    await expect(button(page)).toBeVisible();
    const first = await picks(page, 6);
    await page.reload();
    await expect(button(page)).toBeVisible();
    expect(await picks(page, 6)).toEqual(first);
    await page.clock.setFixedTime(1_800_000_123_456);
    await page.reload();
    await expect(button(page)).toBeVisible();
    expect(await picks(page, 6)).not.toEqual(first);
  });
});

/** Serves the home page with all but `keep` cards made unplayable. */
async function onlyPlayable(
  browser: Browser,
  baseURL: string,
  keep: number,
): Promise<Page> {
  const context = await browser.newContext({
    baseURL,
    viewport: SIZES[0],
  });
  const page = await context.newPage();
  await page.route(
    (url) => url.pathname === '/',
    async (route) => {
      const response = await route.fetch();
      let kept = 0;
      // A card with no address is a card with no data-linked and no link:
      // the same markup the build writes for an entry with none.
      const html = (await response.text()).replace(
        /<li class="card"[\s\S]*?<\/li>/g,
        (card) => {
          if (!card.includes('data-linked')) return card;
          kept += 1;
          if (kept <= keep) return card;
          return card
            .replace(' data-linked', '')
            .replace(/<a class="card-link"[^>]*>([^<]*)<\/a>/, '$1');
        },
      );
      expect(kept).toBeGreaterThan(keep);
      await route.fulfill({ response, body: html });
    },
  );
  return page;
}

test.describe('too few playable cards', () => {
  test('with one playable card the button stays hidden', async ({
    browser,
    baseURL,
  }) => {
    const page = await onlyPlayable(browser, baseURL ?? '', 1);
    await page.goto('/');
    // Script has run once the row buttons have taken their state.
    await expect(page.locator('[aria-disabled]').first()).toBeAttached();
    await expect(page.locator('li.card[data-linked]')).toHaveCount(1);
    await expect(page.locator('button[data-surprise]')).toHaveCount(1);
    await expect(page.locator('button[data-surprise]')).toBeHidden();
    await expect(button(page)).toHaveCount(0);
    await page.context().close();
  });

  test('with no playable card the button stays hidden', async ({
    browser,
    baseURL,
  }) => {
    const page = await onlyPlayable(browser, baseURL ?? '', 0);
    await page.goto('/');
    await expect(page.locator('[aria-disabled]').first()).toBeAttached();
    await expect(page.locator('li.card[data-linked]')).toHaveCount(0);
    await expect(page.locator('button[data-surprise]')).toHaveCount(1);
    await expect(page.locator('button[data-surprise]')).toBeHidden();
    await page.context().close();
  });

  test('with two playable cards the button shows, and they come up in turn', async ({
    browser,
    baseURL,
  }) => {
    const page = await onlyPlayable(browser, baseURL ?? '', 2);
    await handSeed(page, 5);
    await page.goto('/');
    await expect(button(page)).toBeVisible();
    const found = await picks(page, 6);
    expect(new Set(found).size).toBe(2);
    for (let at = 1; at < found.length; at += 1)
      expect(found[at]).not.toBe(found[at - 1]);
    await page.context().close();
  });
});
