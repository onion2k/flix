// Holds what a card says where the browser cannot run WebGPU (plans/webgpu.md):
// on exactly the eight cards whose entries say `requires: [webgpu]`, one line,
// the words of src/catalogue/webgpu.ts, on the card's front (every device), on
// its back after a flip, in a phone's sheet and in the feature's panel when the
// day's feature is one of them. The page asks the browser once, after `load`,
// and the answer is stood in here (tests/clock.ts says how: `window.__gpu` set
// by an init script of the test's own): no API, a null adapter and a rejected
// request each lack it; an adapter has it; a request left open past three
// seconds, with the clock stepped, is unknown, and with script off nothing is
// known. Only a certain "lacks" draws a line, and nowhere else is one drawn.
// Which entries require it is read from their YAML as the build reads it, so
// that the page is held to the files and not to a copy of them. Each test
// counts what it reached, so that finding nothing is a failure and not a pass.
// Without it a card could send a visitor to a game that will hang on its
// loading screen, or say so to a visitor whose browser would have run it.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, type Page } from '@playwright/test';
import { dayAt, noonOf, test, type GpuMode } from '../clock';
import { WEBGPU_WORDS, WEBGPU_WAIT_MS } from '../../src/catalogue/webgpu';
import { candidatesOf, readRows } from './catalogue';
import { inTree } from './tree';

const catalogue = readRows();
const candidates = candidatesOf(catalogue);
const PHONE = { isMobile: true, hasTouch: true } as const;

/** Whether an entry's YAML says `requires: [webgpu]`. */
function requiresWebGPU(id: string): boolean {
  const text = readFileSync(
    resolve(import.meta.dirname, `../../src/content/entries/${id}.yaml`),
    'utf8',
  );
  return /^requires:\s*\[\s*webgpu\s*\]\s*$/m.test(text);
}

const everyId = catalogue.rows.flatMap((row) => row.entries);
const requiring = everyId.filter(requiresWebGPU);
const EIGHT = [
  'artshape',
  'chess',
  'chopdrop',
  'coinpush',
  'heist',
  'nuclear-fishin',
  'ooergolf',
  'pushminer',
];

/** Says how the browser answers, before the page runs. */
async function answering(page: Page, mode: GpuMode): Promise<void> {
  await page.addInitScript((answer) => {
    Reflect.set(window, '__gpu', answer);
  }, mode);
}

/** The page, with its script run and the verdict come. */
async function ready(page: Page, verdict = 'lacks'): Promise<void> {
  await page.goto('/');
  await expect(page.locator('section.row[data-arrows]').first()).toBeAttached();
  await expect(page.locator('html')).toHaveAttribute('data-webgpu', verdict);
}

const asked = (page: Page) =>
  page.evaluate(() => ({
    calls: Reflect.get(window, '__gpuCalls') as number,
    afterLoad: Reflect.get(window, '__gpuCalledAfterLoad') as boolean | null,
  }));

test('the eight sites that require WebGPU are the eight, each in a row', () => {
  expect(requiring.sort()).toEqual([...EIGHT].sort());
});

const LACKING: GpuMode[] = ['none', 'null', 'reject'];

test.describe('where the browser lacks WebGPU, at a desk', () => {
  test.use({ viewport: { width: 1440, height: 1000 } });

  for (const mode of LACKING) {
    test(`with ${mode}: the line is on the front of exactly the eight cards, and nowhere else`, async ({
      page,
    }) => {
      await answering(page, mode);
      await ready(page);
      let withLine = 0;
      let without = 0;
      for (const id of everyId) {
        const card = page.locator(`li.card[data-entry="${id}"]`);
        const line = card.locator('.face.front .card-webgpu');
        if (requiresWebGPU(id)) {
          await expect(card, id).toHaveAttribute('data-requires', 'webgpu');
          await expect(line, id).toHaveCount(1);
          await expect(line, id).toHaveText(WEBGPU_WORDS);
          await card.scrollIntoViewIfNeeded();
          await expect(line, id).toBeVisible();
          // Nothing but the front's own line is added to the back yet drawn.
          withLine += 1;
        } else {
          await expect(card, id).not.toHaveAttribute('data-requires', /.*/);
          await expect(card.locator('.card-webgpu'), id).toHaveCount(0);
          without += 1;
        }
      }
      expect(withLine).toBe(8);
      expect(without).toBeGreaterThan(8);
      // Exactly one on a front and one on a back, for each of the eight.
      await expect(page.locator('.face.front .card-webgpu')).toHaveCount(8);
      await expect(page.locator('.face.back .card-webgpu')).toHaveCount(8);
      // The page asked the browser once, after the window had loaded; with no
      // API there was nothing to ask.
      expect(await asked(page)).toEqual(
        mode === 'none'
          ? { calls: 0, afterLoad: null }
          : { calls: 1, afterLoad: true },
      );
    });
  }

  test('a flipped card shows the line on its back, once, in the tree', async ({
    page,
  }) => {
    await answering(page, 'null');
    await ready(page);
    let reached = 0;
    for (const id of requiring) {
      const card = page.locator(`li.card[data-entry="${id}"]`);
      await card.scrollIntoViewIfNeeded();
      // Before the flip the front is the face in the tree, and holds it once.
      const front = (await inTree(card.locator('.face.front'))).filter((each) =>
        each.includes(WEBGPU_WORDS),
      );
      expect(front, `${id} front, in the tree`).toHaveLength(1);
      await card.locator('button.card-flip').click();
      await expect(card).toHaveAttribute('data-flipped', '');
      const line = card.locator('.face.back .card-webgpu');
      await expect(line, id).toBeVisible();
      await expect(line, id).toHaveText(WEBGPU_WORDS);
      const back = (await inTree(card.locator('.face.back'))).filter((each) =>
        each.includes(WEBGPU_WORDS),
      );
      expect(back, `${id} back, in the tree`).toHaveLength(1);
      // The face turned away is inert: the front's line is out of the tree.
      expect(
        (await inTree(card.locator('.face.front'))).filter((each) =>
          each.includes(WEBGPU_WORDS),
        ),
        `${id} front, turned away`,
      ).toHaveLength(0);
      await card.locator('button.card-unflip').click();
      reached += 1;
    }
    expect(reached).toBe(8);
  });

  test('a card with the line is the same size flipped or not, and a row stays level', async ({
    page,
  }) => {
    await answering(page, 'null');
    await ready(page);
    const id = requiring[0] ?? '';
    const card = page.locator(`li.card[data-entry="${id}"]`);
    await card.scrollIntoViewIfNeeded();
    const before = await card.boundingBox();
    await card.locator('button.card-flip').click();
    await expect(card).toHaveAttribute('data-flipped', '');
    const after = await card.boundingBox();
    expect(before).not.toBeNull();
    expect(after?.height).toBeCloseTo(before?.height ?? 0, 0);
    // Every card of its row is as tall as it.
    const heights = await card
      .locator('xpath=ancestor::ul[1]/li')
      .evaluateAll((els) => els.map((el) => el.getBoundingClientRect().height));
    expect(heights.length).toBeGreaterThan(2);
    for (const height of heights)
      expect(height).toBeCloseTo(heights[0] ?? 0, 0);
  });

  test('the console is clean and the content policy refuses nothing', async ({
    page,
  }) => {
    const talk: string[] = [];
    page.on('console', (message) => {
      if (['error', 'warning'].includes(message.type()))
        talk.push(`${message.type()}: ${message.text()}`);
    });
    page.on('pageerror', (error) => talk.push(`uncaught: ${error.message}`));
    for (const mode of LACKING) {
      await answering(page, mode);
      await ready(page);
      await expect(page.locator('.card-webgpu').first()).toBeAttached();
    }
    expect(talk).toEqual([]);
  });
});

test.describe('where the browser has WebGPU, or has not said', () => {
  test.use({ viewport: { width: 1440, height: 1000 } });

  test('with an adapter no line is drawn anywhere, and the verdict is has', async ({
    page,
  }) => {
    // The default stand-in is an adapter; this says it too.
    await answering(page, 'adapter');
    await ready(page, 'has');
    await expect(page.locator('.card-webgpu')).toHaveCount(0);
    expect(await page.locator('[data-requires~="webgpu"]').count()).toBe(8 + 2);
    expect(await asked(page)).toEqual({ calls: 1, afterLoad: true });
  });

  test('with no setting at all the stand-in is an adapter', async ({
    page,
  }) => {
    await ready(page, 'has');
    await expect(page.locator('.card-webgpu')).toHaveCount(0);
  });

  test('a request still open at three seconds is unknown and draws nothing; before then nothing is said', async ({
    page,
  }) => {
    await answering(page, 'pending');
    await page.clock.install({ time: 0 });
    await page.goto('/');
    await expect(
      page.locator('section.row[data-arrows]').first(),
    ).toBeAttached();
    await expect.poll(() => asked(page).then((got) => got.calls)).toBe(1);
    expect((await asked(page)).afterLoad).toBe(true);
    // From here nothing moves until the test steps it.
    const now = await page.evaluate(() => Date.now());
    await page.clock.pauseAt(now + 1);
    await page.clock.runFor(WEBGPU_WAIT_MS - 1000);
    await expect(page.locator('html')).not.toHaveAttribute('data-webgpu', /.*/);
    await page.clock.runFor(WEBGPU_WAIT_MS);
    await expect(page.locator('html')).toHaveAttribute(
      'data-webgpu',
      'unknown',
    );
    await expect(page.locator('.card-webgpu')).toHaveCount(0);
    // Still one question.
    expect((await asked(page)).calls).toBe(1);
  });

  test('a request answered with null in time says lacks without waiting out the three seconds', async ({
    page,
  }) => {
    await answering(page, 'null');
    await page.clock.install({ time: 0 });
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-webgpu', 'lacks');
    await expect(page.locator('.face.front .card-webgpu')).toHaveCount(8);
  });
});

test.describe('with script off', () => {
  test.use({
    viewport: { width: 1440, height: 1000 },
    javaScriptEnabled: false,
  });

  test('the attribute is in the markup of exactly the eight, and no line is drawn', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page.locator('li.card').first()).toBeAttached();
    await expect(page.locator('li.card[data-requires~="webgpu"]')).toHaveCount(
      8,
    );
    await expect(page.locator('.card-webgpu')).toHaveCount(0);
    await expect(page.locator('html')).not.toHaveAttribute('data-webgpu', /.*/);
  });
});

test.describe('the feature’s panel, on each day of the list', () => {
  test.use({ viewport: { width: 1440, height: 1000 } });

  candidates.forEach((id, place) => {
    test(`on place ${place} (${id}) with no adapter`, async ({ page }) => {
      await answering(page, 'null');
      await page.clock.setFixedTime(noonOf(dayAt(place, candidates.length)));
      await ready(page);
      const shown = page.locator('section.feature:not([hidden])');
      await expect(shown).toHaveAttribute('data-entry', id);
      const line = shown.locator('.card-webgpu');
      if (requiresWebGPU(id)) {
        await expect(shown).toHaveAttribute('data-requires', 'webgpu');
        await expect(line).toHaveCount(1);
        await expect(line).toHaveText(WEBGPU_WORDS);
        await expect(line).toBeVisible();
      } else {
        await expect(line).toHaveCount(0);
      }
    });

    test(`on place ${place} (${id}) with an adapter, nothing`, async ({
      page,
    }) => {
      await page.clock.setFixedTime(noonOf(dayAt(place, candidates.length)));
      await ready(page, 'has');
      await expect(
        page.locator('section.feature:not([hidden]) .card-webgpu'),
      ).toHaveCount(0);
    });
  });

  test('the list holds one that does not need it and two that do', () => {
    expect(candidates.map(requiresWebGPU)).toEqual([false, true, true]);
  });
});

test.describe('a touch phone, with no adapter', () => {
  test.use({ ...PHONE, viewport: { width: 390, height: 844 } });

  test('the front says it, and a tap opens a sheet that says it too', async ({
    page,
  }) => {
    await answering(page, 'null');
    await ready(page);
    let reached = 0;
    for (const id of requiring.slice(0, 3)) {
      const card = page.locator(`li.card[data-entry="${id}"]`);
      await card.scrollIntoViewIfNeeded();
      await expect(card.locator('.face.front .card-webgpu'), id).toBeVisible();
      await card.locator('button.card-flip').tap();
      await expect(card).toHaveAttribute('data-flipped', '');
      const words = card.locator('.face.back .card-webgpu');
      await expect(words, id).toBeVisible();
      await expect(words, id).toHaveText(WEBGPU_WORDS);
      await expect
        .poll(
          () =>
            words.evaluate((el) => {
              const box = el.getBoundingClientRect();
              return box.bottom <= innerHeight + 1 && box.top >= 0;
            }),
          { message: `${id}: the line is in the window` },
        )
        .toBe(true);
      await card.locator('button.card-unflip').tap();
      reached += 1;
    }
    expect(reached).toBe(3);
  });
});
