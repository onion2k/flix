// Holds the feature that changes by the day. With a list of features in
// src/content/catalogue.json the day's feature is taken in turn from `feature`
// then `features`, by the number of whole days since 1970-01-01 UTC: here, on
// four fixed dates (one for each place in the list, worked out in this file
// from the day number and never from the code under test) exactly one feature
// is seen and in the accessibility tree, its picture is drawn, and no other
// candidate's picture is asked for; a page whose module never loads still shows
// the day's feature and picture, since the pick is a small inline script;
// over 60 days the page's pick is the one the pure rule gives (the one place
// the rule is imported, since the two say the same thing twice); the day
// turns at midnight UTC in any zone; with script off the first candidate is
// shown, its picture from the <noscript>; an arrow key from the first row
// lands on the feature that is shown; the social card names the first
// candidate on every date; and the console is clean under the content policy.
// The clock is held by tests/clock.ts; a test of another day sets it before it
// opens the page. Each test counts what it reached, so that finding nothing is
// a failure and not a pass.
import { expect, type Page } from '@playwright/test';
import { DAY_MS, noonOf, test } from '../clock';
import { featureIndex } from '../../src/catalogue/today';
import { candidatesOf, readRows } from './catalogue';

const catalogue = readRows();
const candidates = candidatesOf(catalogue);
const COUNT = candidates.length;

const SIZES = [
  { name: 'a desk', width: 1440, height: 1000 },
  { name: 'a phone', width: 390, height: 844 },
];

/** A day number, near 2024, that falls at the given place in the list. */
function dayAt(place: number): number {
  const base = 20_000;
  return base - (base % COUNT) + place;
}

/** Opens the home page on a day, with script run and the Surprise me shown. */
async function openOn(page: Page, reading: number): Promise<void> {
  await page.clock.setFixedTime(reading);
  await page.goto('/');
}

/** The feature sections a reader sees, which is the ones not hidden. */
function shown(page: Page) {
  return page.locator('section.feature:not([hidden])');
}

/** The feature's picture's addresses, as written for a browser to fetch. */
function addressesOf(attribute: string | null): string[] {
  return (attribute ?? '')
    .split(',')
    .map((part) => part.trim().split(/\s+/)[0] ?? '')
    .filter((part) => part !== '');
}

test('has a list to read, so that a page with none is not a pass here', () => {
  expect(COUNT).toBeGreaterThanOrEqual(2);
  expect(new Set(candidates).size).toBe(COUNT);
});

for (const size of SIZES) {
  test.describe(`at ${size.name}`, () => {
    test.use({ viewport: { width: size.width, height: size.height } });

    for (let place = 0; place < COUNT; place += 1) {
      test(`on a day that is place ${place} in the list, that candidate is the feature, and only its picture is asked for`, async ({
        page,
      }) => {
        const requested = new Set<string>();
        page.on('request', (request) =>
          requested.add(new URL(request.url()).pathname),
        );
        await openOn(page, noonOf(dayAt(place)));

        // The markup holds every candidate, in order, one section each.
        const all = page.locator('section.feature');
        await expect(all).toHaveCount(COUNT);
        expect(
          await all.evaluateAll((els) =>
            els.map((el) => (el as HTMLElement).dataset['entry']),
          ),
        ).toEqual(candidates);
        expect(
          await all.evaluateAll((els) =>
            els.map((el) => (el as HTMLElement).dataset['place']),
          ),
        ).toEqual(candidates.map((_, at) => String(at)));

        // Exactly one is seen, it is the one at the place, and exactly one
        // feature heading is in the accessibility tree.
        await expect(shown(page)).toHaveCount(1);
        await expect(shown(page)).toHaveAttribute(
          'data-entry',
          candidates[place] ?? '',
        );
        await expect(page.locator('section.feature:visible')).toHaveCount(1);
        await expect(
          page.locator('main section.feature').getByRole('heading'),
        ).toHaveCount(1);
        await expect(
          page.locator('main section.feature').getByRole('img'),
        ).toHaveCount(1);
        const ids = await all.evaluateAll((els) =>
          els.map((el) => el.getAttribute('aria-labelledby')),
        );
        expect(new Set(ids).size).toBe(COUNT);

        // Its picture is drawn, at high priority.
        const image = shown(page).locator('img');
        await expect
          .poll(() => image.evaluate((el: HTMLImageElement) => el.naturalWidth))
          .toBeGreaterThan(0);
        await expect(image).toHaveAttribute('fetchpriority', 'high');
        const drawn = await image.evaluate(
          (el: HTMLImageElement) => new URL(el.currentSrc).pathname,
        );
        expect(requested.has(drawn)).toBe(true);

        // No other candidate's picture was asked for. A candidate's smaller
        // files may be the file of its own card in a row, which is asked for
        // for the card, so the addresses a card also holds are left out, and
        // each other candidate must still have some of its own, or this
        // would pass on nothing.
        const cardAddresses = new Set<string>(
          await page
            .locator('section.row [srcset], section.row [data-srcset]')
            .evaluateAll((els) =>
              els.flatMap((el) =>
                [el.getAttribute('srcset'), el.getAttribute('data-srcset')].map(
                  (value) => value ?? '',
                ),
              ),
            )
            .then((values) =>
              values.flatMap((value) =>
                addressesOf(value).map((address) => address),
              ),
            ),
        );
        const others = page.locator('section.feature[hidden]');
        await expect(others).toHaveCount(COUNT - 1);
        for (const other of await others.all()) {
          const own = [
            ...(await other
              .locator('[data-srcset]')
              .evaluateAll((els) =>
                els.map((el) => el.getAttribute('data-srcset')),
              )
              .then((values) => values.flatMap(addressesOf))),
            ...(await other
              .locator('img[data-src]')
              .evaluateAll((els) =>
                els.map((el) => el.getAttribute('data-src')),
              )
              .then((values) => values.flatMap(addressesOf))),
          ].filter((address) => !cardAddresses.has(address));
          expect(
            own.length,
            'a hidden candidate has addresses of its own',
          ).toBeGreaterThan(0);
          for (const address of own)
            expect(requested.has(new URL(address, page.url()).pathname)).toBe(
              false,
            );
        }
      });
    }
  });
}

test.describe('before the page module runs', () => {
  test.use({ viewport: { width: 1440, height: 1000 } });

  test("the day's feature and its picture are shown though the module never loads", async ({
    page,
  }) => {
    let aborted = 0;
    await page.route(/\/_astro\/[^/]*\.js$/, async (route) => {
      aborted += 1;
      await route.abort();
    });
    const place = COUNT - 1;
    await openOn(page, noonOf(dayAt(place)));
    expect(aborted, 'the module was asked for and refused').toBeGreaterThan(0);
    // The module is what shows Surprise me, so that it stayed hidden is the
    // proof that no script of the page's own ran.
    await expect(page.locator('button[data-surprise]')).toBeHidden();
    await expect(shown(page)).toHaveCount(1);
    await expect(shown(page)).toHaveAttribute(
      'data-entry',
      candidates[place] ?? '',
    );
    await expect
      .poll(() =>
        shown(page)
          .locator('img')
          .evaluate((el: HTMLImageElement) => el.naturalWidth),
      )
      .toBeGreaterThan(0);
  });
});

test.describe('the two sayings of the rule', () => {
  test.use({ viewport: { width: 1440, height: 1000 } });

  test('agree over 60 consecutive days, at the start and at the end of each', async ({
    page,
  }) => {
    test.setTimeout(60_000);
    const seen = new Set<string>();
    for (let day = 20_000; day < 20_060; day += 1) {
      // The first millisecond of a day on the even days, the last on the odd:
      // so each edge of a day is met 30 times, and not only noon.
      const reading = day * DAY_MS + (day % 2 === 0 ? 0 : DAY_MS - 1);
      await openOn(page, reading);
      const entry = await shown(page).getAttribute('data-entry');
      expect(entry, `day ${day}`).toBe(
        candidates[featureIndex(COUNT, reading)],
      );
      seen.add(entry ?? '');
    }
    // Every candidate came up, so that agreeing on one place is not a pass.
    expect([...seen].sort()).toEqual([...candidates].sort());
  });
});

for (const { zone, reading } of [
  // 23:30 UTC on a day: already tomorrow in Auckland, still today in UTC.
  { zone: 'Pacific/Auckland', reading: 23.5 * 3_600_000 },
  // 00:30 UTC: still yesterday in Los Angeles, already today in UTC.
  { zone: 'America/Los_Angeles', reading: 0.5 * 3_600_000 },
]) {
  test.describe(`in ${zone}`, () => {
    test.use({
      timezoneId: zone,
      viewport: { width: 1440, height: 1000 },
    });

    test('the day is the UTC day, whatever the zone says', async ({ page }) => {
      for (let place = 0; place < COUNT; place += 1) {
        await openOn(page, dayAt(place) * DAY_MS + reading);
        await expect(shown(page)).toHaveAttribute(
          'data-entry',
          candidates[place] ?? '',
        );
      }
    });
  });
}

test.describe('with script off', () => {
  test.use({
    javaScriptEnabled: false,
    viewport: { width: 1440, height: 1000 },
  });

  test('the first candidate is shown with its picture drawn, the rest hidden, one in the accessibility tree', async ({
    page,
  }) => {
    await page.goto('/');
    const all = page.locator('section.feature');
    await expect(all).toHaveCount(COUNT);
    await expect(all.first()).not.toHaveAttribute('hidden', /.*/);
    await expect(all.first()).toHaveAttribute(
      'data-entry',
      candidates[0] ?? '',
    );
    await expect(page.locator('section.feature[hidden]')).toHaveCount(
      COUNT - 1,
    );
    await expect(page.locator('section.feature:visible')).toHaveCount(1);
    await expect(
      page.locator('main section.feature').getByRole('heading'),
    ).toHaveCount(1);
    await expect(
      page.locator('main section.feature').getByRole('img'),
    ).toHaveCount(1);
    const image = all.first().getByRole('img');
    await expect
      .poll(() => image.evaluate((el: HTMLImageElement) => el.naturalWidth))
      .toBeGreaterThan(0);
    // Only the first has a plain picture to fall back on: the others are
    // hidden and never will be.
    expect(
      await all.evaluateAll((els) =>
        els.map((el) => el.querySelectorAll('noscript').length),
      ),
    ).toEqual(candidates.map((_, at) => (at === 0 ? 1 : 0)));
  });
});

test.describe('the frame while the picture is on its way', () => {
  test.use({ viewport: { width: 1440, height: 1000 } });

  test("keeps its box and waits in the panel's colour", async ({ page }) => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((done) => {
      release = done;
    });
    await page.route(/\/_astro\/.*\.(avif|webp|jpe?g)$/, async (route) => {
      await gate;
      await route.continue().catch(() => undefined);
    });
    // The load event waits for the pictures, which are held, so the page is
    // opened as far as its markup.
    await page.clock.setFixedTime(noonOf(dayAt(2)));
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const section = shown(page);
    await expect(section).toHaveAttribute('data-entry', candidates[2] ?? '');
    const found = await section.evaluate((el) => {
      const frame = el.querySelector<HTMLElement>('.feature-frame');
      if (frame === null) return null;
      const box = frame.getBoundingClientRect();
      return {
        width: box.width,
        height: box.height,
        background: getComputedStyle(frame).backgroundColor,
        panel: getComputedStyle(el).backgroundColor,
      };
    });
    release();
    expect(found, 'the feature picture frame was found').not.toBeNull();
    // The 16 by 9 of the picture, at least: the words beside it may be taller.
    expect(found?.height ?? 0).toBeGreaterThanOrEqual(
      ((found?.width ?? 0) * 9) / 16 - 1,
    );
    expect(found?.background).toBe(found?.panel);
  });
});

test.describe('arrow keys', () => {
  test.use({ viewport: { width: 1440, height: 1000 } });

  test("Up from the first row lands on the shown feature's link", async ({
    page,
  }) => {
    const place = 2;
    await openOn(page, noonOf(dayAt(place)));
    await expect(page.locator('[aria-disabled]').first()).toBeAttached();
    await page
      .locator('section.row')
      .first()
      .locator('a.card-link')
      .first()
      .focus();
    await page.keyboard.press('ArrowUp');
    const landed = await page.evaluate(() => {
      const el = document.activeElement;
      const section = el?.closest<HTMLElement>('section.feature') ?? null;
      return {
        isButton: el?.matches('a.button') ?? false,
        entry: section?.dataset['entry'] ?? '',
        hidden: section?.hidden ?? true,
      };
    });
    expect(landed).toEqual({
      isButton: true,
      entry: candidates[place],
      hidden: false,
    });
    // And Down goes back to the row.
    await page.keyboard.press('ArrowDown');
    expect(
      await page.evaluate(() =>
        document.activeElement?.matches('section.row a.card-link'),
      ),
    ).toBe(true);
  });
});

test.describe('the social card', () => {
  test('names the first candidate on every date', async ({ page }) => {
    const seen = new Set<string>();
    for (let place = 0; place < COUNT; place += 1) {
      await openOn(page, noonOf(dayAt(place)));
      const image =
        (await page
          .locator('meta[property="og:image"]')
          .getAttribute('content')) ?? '';
      expect(
        new URL(image).pathname.startsWith(`/_astro/${candidates[0]}.`),
      ).toBe(true);
      seen.add(image);
    }
    expect(seen.size).toBe(1);
  });
});

test.describe('the content policy', () => {
  test.use({ viewport: { width: 1440, height: 1000 } });

  test("blocks nothing the page needs: the console is clean on a day that is not the first's", async ({
    page,
  }) => {
    const heard: string[] = [];
    page.on('console', (message) => {
      if (['error', 'warning'].includes(message.type()))
        heard.push(`${message.type()}: ${message.text()}`);
    });
    page.on('pageerror', (error) => heard.push(`pageerror: ${error.message}`));
    await page.addInitScript(() => {
      document.addEventListener('securitypolicyviolation', (event) => {
        console.error(`csp: ${event.violatedDirective}`);
      });
    });
    await openOn(page, noonOf(dayAt(1)));
    // The script ran, or this would be a clean console of a page that did not.
    await expect(shown(page)).toHaveAttribute(
      'data-entry',
      candidates[1] ?? '',
    );
    await expect(
      shown(page)
        .locator('img')
        .evaluate((el: HTMLImageElement) => el.complete),
    ).resolves.toBe(true);
    await expect(page.locator('button[data-surprise]')).toBeVisible();
    expect(heard).toEqual([]);

    // The policy allows the inline script by its hash and no more.
    const policy =
      (await page
        .locator('meta[http-equiv="content-security-policy"]')
        .getAttribute('content')) ?? '';
    const scripts =
      policy
        .split(';')
        .map((directive) => directive.trim())
        .find((directive) => directive.startsWith('script-src ')) ?? '';
    expect(scripts).not.toContain("'unsafe-inline'");
    expect(scripts).not.toContain("'unsafe-eval'");
    expect(scripts).toMatch(/'sha256-[A-Za-z0-9+/=]+'/);
  });
});
