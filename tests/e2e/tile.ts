// What is behind a card's words, read as the page draws it. A card's front
// (and, at a desk, its back) is a light tile whose finish moves with the light,
// so no token says what is under a word: the words are hidden, the pixels
// they stood on are read from a screenshot, and the darkest of them is the
// ground the dark words must hold 7:1 against. The luminance and the ratio are
// worked out here from the WCAG formulas and not by the browser. The pixels are
// read in a blank page of its own (the reader), since the site's policy does
// not allow a data: picture. The contrast spec and the shine spec share it so
// that they cannot come to measure two ways.
import type { Locator, Page } from '@playwright/test';

/** The relative luminance WCAG gives a colour of three channels, 0 to 255. */
export function luminanceOf(channels: number[]): number {
  return [0.2126, 0.7152, 0.0722].reduce((sum, weight, at) => {
    const value = (channels[at] ?? 0) / 255;
    return (
      sum +
      weight *
        (value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4)
    );
  }, 0);
}

/** WCAG's ratio of two luminances, whichever is the lighter. */
export function ratioOf(a: number, b: number): number {
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/** The channels of an `rgb()` or `rgba()` colour as the browser writes it. */
export function channelsOf(colour: string): number[] {
  return (colour.match(/[\d.]+/g) ?? []).map(Number).slice(0, 3);
}

/** A blank page of the same context, to read a screenshot's pixels in. */
export function newReader(page: Page): Promise<Page> {
  return page.context().newPage();
}

/** The luminance of the darkest pixel of a PNG, as base64. */
export async function darkestOf(reader: Page, png: Buffer): Promise<number> {
  return reader.evaluate(async (shot) => {
    const luminance = (r: number, g: number, b: number): number =>
      [r, g, b].reduce((sum, channel, at) => {
        const value = channel / 255;
        return (
          sum +
          ([0.2126, 0.7152, 0.0722][at] ?? 0) *
            (value <= 0.03928
              ? value / 12.92
              : ((value + 0.055) / 1.055) ** 2.4)
        );
      }, 0);
    const image = new Image();
    image.src = `data:image/png;base64,${shot}`;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext('2d');
    if (context === null) throw new Error('no canvas');
    context.drawImage(image, 0, 0);
    const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
    let darkest = Infinity;
    for (let i = 0; i < data.length; i += 4)
      darkest = Math.min(
        darkest,
        luminance(data[i] ?? 0, data[i + 1] ?? 0, data[i + 2] ?? 0),
      );
    return darkest;
  }, png.toString('base64'));
}

/**
 * The darkest pixel under a piece of words: the words are made clear, the
 * box is photographed (without the two pixels round its edge, where a card's
 * own border may lie under a lifted or tilted card), and they are put back.
 */
export async function darkestUnderWords(
  page: Page,
  reader: Page,
  words: Locator,
  inset = 2,
): Promise<number> {
  const box = await words.boundingBox();
  if (box === null) throw new Error('the words are not drawn');
  await words.evaluate((el) => (el.style.color = 'transparent'));
  const shot = await page.screenshot({
    clip: {
      x: box.x + inset,
      y: box.y + inset,
      width: box.width - inset * 2,
      height: box.height - inset * 2,
    },
  });
  await words.evaluate((el) => (el.style.color = ''));
  return darkestOf(reader, shot);
}

/**
 * The darkest pixel of a face's tile, the whole of it but a few pixels in at
 * its edge: everything in the face is hidden while it is photographed.
 */
export async function darkestOfTile(
  page: Page,
  reader: Page,
  face: Locator,
  inset = 4,
): Promise<number> {
  const box = await face.boundingBox();
  if (box === null) throw new Error('the face is not drawn');
  await face.evaluate((el) => {
    for (const child of el.children)
      (child as HTMLElement).style.visibility = 'hidden';
  });
  const shot = await page.screenshot({
    clip: {
      x: box.x + inset,
      y: box.y + inset,
      width: box.width - inset * 2,
      height: box.height - inset * 2,
    },
  });
  await face.evaluate((el) => {
    for (const child of el.children)
      (child as HTMLElement).style.visibility = '';
  });
  return darkestOf(reader, shot);
}

/**
 * How far two screenshots of one box are from each other: the greatest
 * difference in any channel of any pixel, and the share of channels that
 * differ at all. A picture drawn twice on a composited page may differ by a
 * level or two at its edge, from the browser's own resampling; a layer laid
 * over it differs by a great deal more, and over far more of it.
 */
export async function differBy(
  reader: Page,
  a: Buffer,
  b: Buffer,
): Promise<{ greatest: number; share: number }> {
  return reader.evaluate(
    async ([first, second]) => {
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
      const [x, y] = [await pixels(first ?? ''), await pixels(second ?? '')];
      if (x.length !== y.length) return { greatest: 255, share: 1 };
      let greatest = 0;
      let differing = 0;
      for (let i = 0; i < x.length; i += 1) {
        const by = Math.abs((x[i] ?? 0) - (y[i] ?? 0));
        if (by > 0) differing += 1;
        greatest = Math.max(greatest, by);
      }
      return { greatest, share: differing / x.length };
    },
    [a.toString('base64'), b.toString('base64')],
  );
}
