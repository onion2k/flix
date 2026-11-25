// Holds the wordmark's arc (the owner's choice of 2026-11-25, after Netflix's
// mark): the letters stand taller toward the ends, so that the foot of the word
// is one smooth curve that rises to the middle, the ends 18% taller than the
// middle (`--share-mark-arc`), and the head stays straight. It is read from
// the pixels as drawn: the lowest lit pixel of every column of the mark, against
// a curve worked out here from the ends and the middle alone. A word stretched
// letter by letter with nothing cutting its foot to the curve has a step under
// each letter and fails the curve; a word not stretched fails the ratio. It also
// holds that the word is heard once, as "ooerflix", and never letter by letter,
// though the letters are drawn one by one. Each test counts what it reached.
import { expect, type Page } from '@playwright/test';
import { test } from '../clock';
import { inTree } from './tree';

/** The rows and columns of a screenshot of the mark that are lit. */
async function feet(page: Page): Promise<{
  top: number;
  foot: (number | null)[];
}> {
  const mark = page.locator('.site-header .mark');
  const box = await mark.boundingBox();
  if (box === null) throw new Error('the mark is not drawn');
  const shot = await page.screenshot({
    clip: { x: box.x, y: box.y, width: box.width, height: box.height },
  });
  const reader = await page.context().newPage();
  try {
    return await reader.evaluate(async (b64) => {
      const image = new Image();
      image.src = `data:image/png;base64,${b64}`;
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = image.width;
      canvas.height = image.height;
      const context = canvas.getContext('2d');
      if (context === null) throw new Error('no canvas');
      context.drawImage(image, 0, 0);
      const { data, width, height } = context.getImageData(
        0,
        0,
        image.width,
        image.height,
      );
      // The accent is bright and the ground near black: a pixel more than half
      // lit in its red channel is the word, its antialiased edge included at
      // half, so that the edge is found to the pixel.
      const lit = (x: number, y: number) =>
        (data[(y * width + x) * 4] ?? 0) > 128;
      let top = height;
      const foot: (number | null)[] = [];
      for (let x = 0; x < width; x += 1) {
        let lowest: number | null = null;
        for (let y = 0; y < height; y += 1)
          if (lit(x, y)) {
            top = Math.min(top, y);
            lowest = y;
          }
        foot.push(lowest);
      }
      return { top, foot };
    }, shot.toString('base64'));
  } finally {
    await reader.close();
  }
}

/** The arc, judged from the pixels: the ends, the middle, and every foot. */
function judge({ top, foot }: { top: number; foot: (number | null)[] }) {
  const inked = foot
    .map((y, x) => ({ x, y }))
    .filter((each): each is { x: number; y: number } => each.y !== null);
  const first = inked[0]?.x ?? 0;
  const last = inked.at(-1)?.x ?? 0;
  const width = last - first;
  const lowestIn = (from: number, to: number) =>
    Math.max(
      ...inked
        .filter((each) => each.x >= from && each.x <= to)
        .map((each) => each.y),
    );
  const middle = lowestIn(first + width * 0.45, first + width * 0.55);
  const height = middle - top;
  // The curve the rule gives, from the head and the middle alone: 18% deeper
  // at the ends than at the middle, as a parabola (the ellipse the page cuts by
  // is within a twentieth of a pixel of it over this span). A round letter's
  // foot lies above it at its sides, so the curve is a floor every foot keeps
  // above, and the straight feet reach it.
  const centre = first + width / 2;
  const curve = (x: number) =>
    middle + height * 0.18 * ((x - centre) / (width / 2)) ** 2;
  const offCurve = inked.map((each) => each.y - curve(each.x));
  return {
    reached: inked.length,
    // How far the deepest foot is below the head, against the middle's.
    ratio: (Math.max(...inked.map((each) => each.y)) - top) / height,
    sides: Math.abs(
      lowestIn(first, first + width * 0.12) -
        lowestIn(last - width * 0.12, last),
    ),
    below: Math.max(...offCurve),
    // The share of columns whose foot is on the curve, to a pixel and a half.
    on: offCurve.filter((by) => by > -1.5).length / inked.length,
  };
}

for (const { name, path, width, script } of [
  { name: 'the home page', path: '/', width: 1440, script: true },
  { name: 'the home page', path: '/', width: 390, script: true },
  { name: 'the home page', path: '/', width: 320, script: true },
  { name: 'the privacy page', path: '/privacy/', width: 1440, script: true },
  { name: 'the home page', path: '/', width: 1440, script: false },
]) {
  test.describe(`${name} at ${width}px, script ${script ? 'on' : 'off'}`, () => {
    test.use({ javaScriptEnabled: script, deviceScaleFactor: 2 });

    test('the wordmark stands on an arc: the ends taller, the foot one curve', async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 600 });
      await page.goto(path);
      await page.evaluate(() => document.fonts.ready);
      const drawn = judge(await feet(page));
      // At least the width of the word, in device pixels, was read.
      expect(drawn.reached).toBeGreaterThan(100);
      expect(
        drawn.ratio,
        'the ends 18% taller than the middle',
      ).toBeGreaterThan(1.14);
      expect(drawn.ratio).toBeLessThan(1.22);
      expect(drawn.sides, 'the two ends level').toBeLessThanOrEqual(2);
      expect(drawn.below, 'no foot below the curve').toBeLessThanOrEqual(1.5);
      expect(drawn.on, 'the feet on the curve').toBeGreaterThan(0.5);
    });
  });
}

for (const { path, role } of [
  { path: '/', role: 'heading' },
  { path: '/privacy/', role: 'link' },
]) {
  test(`the wordmark at ${path} is heard as one word, never letter by letter`, async ({
    page,
  }) => {
    await page.goto(path);
    const mark = page.locator('.site-header .mark');
    await expect(mark).toHaveAccessibleName('ooerflix');
    const heard = await inTree(mark);
    expect(heard[0]).toBe(`${role}: ooerflix`);
    // Every name in the tree under the mark is the whole word: no letter of
    // it is a node of its own.
    expect(heard.length).toBeGreaterThan(0);
    for (const each of heard) expect(each).toMatch(/: ooerflix$/);
    // The letters are drawn one by one.
    expect(await mark.locator('[aria-hidden="true"] > span').count()).toBe(8);
  });
}
