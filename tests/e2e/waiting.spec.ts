// Holds part 2 of plans/effects.md, "coloured waiting frames": a late card's
// frame waits in its picture's own colour, mixed half and half with the panel
// token, and the picture eases in when it lands. With the late rows' picture
// requests held back (a route that is not released, never a timeout) every
// frame in the Toys row carries a data-waiting colour that passes the check,
// draws a background that is not the panel's and is the one worked out here
// from that attribute and the tokens, the frames differ, and each placeholder
// picture is fully transparent. Released, each picture is marked arrived,
// has loaded and is fully opaque. A picture that fails is marked too, so that
// its alt words are not left invisible. A colour that is not a colour is
// refused by the script, and the frame stays the panel's. Under reduced
// motion the picture has no ease, and with script off the plain pictures are
// drawn and opaque. Without this a colour never set, one colour for every
// frame, a mark never made, a failed picture left invisible, an ease outside
// the no-preference block or a transparent rule that reached the <noscript>
// picture would each pass every other test. Each test counts what it reached.
import { expect, test, type Locator, type Page } from '@playwright/test';
import { readRows } from './catalogue';
import { asColour } from '../../src/catalogue/colour';

const catalogue = readRows();
/** The rows after the second, which wait: the rule in Row.astro. */
const late = catalogue.rows.slice(2);
const toys = late[0];
if (toys === undefined) throw new Error('no late row');

/** What a browser may round a mixed colour by, in each channel out of 255. */
const ROUNDING = 1;

const SIZES = [
  { name: 'a desk', width: 1440, height: 1000 },
  { name: 'a phone', width: 390, height: 844 },
];

const FRAME = '.frame[data-late]';

function isPictureOf(url: string, id: string): boolean {
  return new URL(url).pathname.startsWith(`/_astro/${id}.`);
}

/**
 * Holds the pictures of the given entries: each request waits at the route
 * until `release()` and is then let through. A request of an entry in
 * `fail` is aborted instead, when released or not. `held()` says how many
 * are waiting.
 */
async function hold(
  page: Page,
  entries: string[],
  fail: string[] = [],
): Promise<{ release: () => void; held: () => number }> {
  let release: () => void = () => undefined;
  const gate = new Promise<void>((done) => {
    release = done;
  });
  let waiting = 0;
  await page.route(/\/_astro\/.*\.(avif|webp|jpe?g|png)$/, async (route) => {
    const url = route.request().url();
    if (fail.some((id) => isPictureOf(url, id))) {
      await route.abort();
      return;
    }
    if (!entries.some((id) => isPictureOf(url, id))) {
      await route.continue();
      return;
    }
    waiting += 1;
    await gate;
    await route.continue().catch(() => undefined);
  });
  return { release, held: () => waiting };
}

/** Scrolls the Toys row near and waits until script has started its pictures. */
async function near(page: Page): Promise<Locator> {
  await page.goto('/');
  await expect(page.locator('[aria-disabled]').first()).toBeAttached();
  const row = page.locator(`section[id="${toys?.id}"]`);
  await row.evaluate((el) => {
    el.scrollIntoView();
  });
  await expect(row.locator('img[data-src]')).toHaveCount(0);
  return row;
}

/** The numbers of a computed colour, as 0 to 255 whatever form it is written in. */
function channels(computed: string): number[] {
  const numbers = computed.match(/-?\d*\.?\d+/g)?.map(Number) ?? [];
  const three = numbers.slice(0, 3);
  expect(three.length, computed).toBe(3);
  return computed.startsWith('color(')
    ? three.map((each) => each * 255)
    : three;
}

function hex(colour: string): number[] {
  return [1, 3, 5].map((at) => parseInt(colour.slice(at, at + 2), 16));
}

/** The tokens the look is made of, as the page holds them. */
async function tokens(
  page: Page,
): Promise<{ panel: number[]; share: number; duration: string }> {
  const read = await page.evaluate(() => {
    const style = getComputedStyle(document.documentElement);
    return {
      panel: style.getPropertyValue('--color-panel').trim(),
      share: style.getPropertyValue('--share-waiting').trim(),
      duration: style.getPropertyValue('--duration-arrive').trim(),
    };
  });
  expect(asColour(read.panel), 'the panel token').not.toBeNull();
  expect(read.share, 'the share token').toMatch(/^\d+(\.\d+)?%$/);
  expect(read.duration, 'the duration token').toMatch(/^\d*\.?\d+m?s$/);
  const share = parseFloat(read.share) / 100;
  expect(share).toBeGreaterThan(0);
  expect(share).toBeLessThan(1);
  return { panel: hex(read.panel), share, duration: read.duration };
}

function expectNear(seen: number[], wanted: number[], what: string): void {
  expect(seen.length).toBe(3);
  for (const [at, value] of seen.entries())
    expect(
      Math.abs(value - (wanted[at] ?? NaN)),
      `${what}: channel ${at} is ${value}, wanted ${wanted[at]}`,
    ).toBeLessThanOrEqual(ROUNDING);
}

async function backgroundOf(frame: Locator): Promise<number[]> {
  return channels(
    await frame.evaluate((el) => getComputedStyle(el).backgroundColor),
  );
}

for (const size of SIZES) {
  test.describe(`at ${size.name}'s width`, () => {
    test.use({ viewport: { width: size.width, height: size.height } });

    test('held back, each late frame waits in its own colour mixed with the panel, and its picture is transparent', async ({
      page,
    }) => {
      const gate = await hold(
        page,
        late.flatMap((each) => each.entries),
      );
      const row = await near(page);
      await expect.poll(() => gate.held()).toBeGreaterThanOrEqual(1);
      const { panel, share } = await tokens(page);
      const frames = row.locator(FRAME);
      const total = await frames.count();
      expect(total, 'late frames in the Toys row').toBe(toys.entries.length);
      const attributes: string[] = [];
      const drawn: string[] = [];
      for (let at = 0; at < total; at += 1) {
        const frame = frames.nth(at);
        const waiting = await frame.getAttribute('data-waiting');
        const colour = asColour(waiting ?? '');
        expect(
          colour,
          `frame ${at}: data-waiting is ${waiting}`,
        ).not.toBeNull();
        attributes.push(colour ?? '');
        const own = hex(colour ?? '');
        const wanted = own.map(
          (each, i) => each * share + (panel[i] ?? 0) * (1 - share),
        );
        const seen = await backgroundOf(frame);
        expectNear(seen, wanted, `frame ${at}`);
        // Not the panel's: some channel is further from it than rounding is.
        const apart = Math.max(
          ...seen.map((each, i) => Math.abs(each - (panel[i] ?? 0))),
        );
        expect(apart, `frame ${at} is not the panel's`).toBeGreaterThan(
          ROUNDING,
        );
        drawn.push(seen.map((each) => Math.round(each)).join(','));
        await expect(frame.locator('img')).toHaveCSS('opacity', '0');
        await expect(frame.locator('img')).not.toHaveAttribute(
          'data-arrived',
          /.*/,
        );
      }
      expect(new Set(attributes).size, 'colours given').toBeGreaterThan(1);
      expect(new Set(drawn).size, 'colours drawn').toBeGreaterThan(1);
      test.info().annotations.push({
        type: 'measured',
        description: `${total} frames held: ${attributes.join(' ')}`,
      });
      gate.release();
    });

    test('released, each picture is marked arrived, has loaded and is fully opaque', async ({
      page,
    }) => {
      const gate = await hold(
        page,
        late.flatMap((each) => each.entries),
      );
      const row = await near(page);
      await expect.poll(() => gate.held()).toBeGreaterThanOrEqual(1);
      const images = row.locator(`${FRAME} img`);
      expect(await images.count()).toBe(toys.entries.length);
      gate.release();
      for (let at = 0; at < toys.entries.length; at += 1) {
        const img = images.nth(at);
        await expect(img).toHaveAttribute('data-arrived', '');
        await expect(img).toHaveCSS('opacity', '1');
        expect(
          await img.evaluate((el: HTMLImageElement) => el.naturalWidth),
        ).toBeGreaterThan(0);
      }
    });
  });
}

test.describe('a picture that fails, a colour that is not one, and no ease', () => {
  test.use({ viewport: { width: 1440, height: 1000 } });

  test('a picture that fails to load is marked arrived and its alt words are there', async ({
    page,
  }) => {
    const broken = toys.entries[0] ?? '';
    await hold(page, [], [broken]);
    const row = await near(page);
    const img = row.locator(`[data-entry="${broken}"] img`);
    await expect(img).toHaveAttribute('data-arrived', '');
    await expect(img).toHaveCSS('opacity', '1');
    expect(await img.evaluate((el: HTMLImageElement) => el.alt)).toMatch(/\S/);
    expect(await img.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBe(
      0,
    );
    // The others still arrive as they do.
    const other = row.locator(`[data-entry="${toys.entries[1]}"] img`);
    await expect(other).toHaveAttribute('data-arrived', '');
    expect(
      await other.evaluate((el: HTMLImageElement) => el.naturalWidth),
    ).toBeGreaterThan(0);
  });

  // The first is what a browser refuses by itself (a semicolon in a custom
  // property); the others it would take, so only the check refuses them.
  for (const bad of ['red; background: url(x)', 'red', '#FFFFFF'])
    test(`a data-waiting of ${bad} is not used`, async ({ page }) => {
      await page.route('**/', async (route) => {
        const response = await route.fetch();
        const body = (await response.text()).replace(
          /data-waiting="#[0-9a-f]{6}"/,
          `data-waiting="${bad}"`,
        );
        await route.fulfill({ response, body });
      });
      const gate = await hold(
        page,
        late.flatMap((each) => each.entries),
      );
      const row = await near(page);
      await expect.poll(() => gate.held()).toBeGreaterThanOrEqual(1);
      const frames = row.locator(FRAME);
      const { panel } = await tokens(page);
      // Document order: the first late frame in the page is the first of Toys.
      await expect(frames.first()).toHaveAttribute('data-waiting', bad);
      const own = await frames
        .first()
        .evaluate((el) =>
          (el as HTMLElement).style.getPropertyValue('--waiting'),
        );
      expect(own).toBe('');
      expectNear(
        await backgroundOf(frames.first()),
        panel,
        'the refused frame',
      );
      // And the next frame, with a good colour, was set.
      const next = await frames
        .nth(1)
        .evaluate((el) =>
          (el as HTMLElement).style.getPropertyValue('--waiting'),
        );
      expect(asColour(next)).not.toBeNull();
      gate.release();
    });

  test('under reduced motion the picture has no ease, and the states still hold', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const gate = await hold(
      page,
      late.flatMap((each) => each.entries),
    );
    const row = await near(page);
    await expect.poll(() => gate.held()).toBeGreaterThanOrEqual(1);
    const img = row.locator(`${FRAME} img`).first();
    await expect(img).toHaveCSS('opacity', '0');
    expect(
      await img.evaluate((el) => getComputedStyle(el).transitionDuration),
    ).toBe('0s');
    gate.release();
    await expect(img).toHaveAttribute('data-arrived', '');
    await expect(img).toHaveCSS('opacity', '1');
  });

  test('with no preference the picture eases its opacity, so that the check above is not vacuous', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    const gate = await hold(
      page,
      late.flatMap((each) => each.entries),
    );
    const row = await near(page);
    await expect.poll(() => gate.held()).toBeGreaterThanOrEqual(1);
    const img = row.locator(`${FRAME} img`).first();
    const style = await img.evaluate((el) => {
      const computed = getComputedStyle(el);
      return {
        properties: computed.transitionProperty,
        durations: computed.transitionDuration,
      };
    });
    const properties = style.properties.split(',').map((each) => each.trim());
    expect(properties).toContain('opacity');
    // The zoom's and the dim's eases are kept beside it.
    expect(properties).toContain('transform');
    expect(properties).toContain('filter');
    const { duration } = await tokens(page);
    const at = properties.indexOf('opacity');
    const seconds = style.durations.split(',').map((each) => each.trim())[at];
    // The token is said in ms or s, and the computed duration in seconds.
    const wanted = duration.endsWith('ms')
      ? parseFloat(duration) / 1000
      : parseFloat(duration);
    expect(wanted).toBeGreaterThan(0);
    expect(parseFloat(seconds ?? '')).toBeCloseTo(wanted, 5);
    gate.release();
  });
});

test.describe('with script off', () => {
  test.use({
    javaScriptEnabled: false,
    viewport: { width: 1440, height: 1000 },
  });

  test('every late picture is drawn and fully opaque', async ({ page }) => {
    await page.goto('/');
    const ids = late.flatMap((each) => each.entries);
    expect(ids.length).toBeGreaterThan(0);
    for (const id of ids) {
      const img = page
        .locator(`[data-entry="${id}"] noscript img, [data-entry="${id}"] img`)
        .last();
      await img.scrollIntoViewIfNeeded();
      await expect(img).toHaveCSS('opacity', '1');
      await expect
        .poll(() => img.evaluate((el: HTMLImageElement) => el.naturalWidth))
        .toBeGreaterThan(0);
    }
  });
});
