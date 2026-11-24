// Holds contrast as the page is drawn, not as the tokens say it should be:
// every piece of text on the home page, the 404 and the privacy page, at a desk's width and a
// phone's, against the nearest background that is not transparent, is 7:1 or
// better (4.5:1 where WCAG calls the text large); and each control that a real
// Tab press focuses has a ring that is 3:1 or better against what is behind
// it. The page has no text over a picture, so the nearest background is
// always a flat token colour. The cards' Pause button, over a playing loop, is
// measured as drawn: its ground solid, its edge, its mark and its ring 3:1
// against that ground, whatever the loop shows. Without it a rule that recoloured a link, or a
// ring lost to a later declaration, would pass the token check, which never
// sees the page. Each test counts what it measured, so reading nothing fails.
import { expect } from '@playwright/test';
import { test } from '../clock';
import { textPieces } from './text-pieces';
import { settleOnFirstRow } from './card-loop';
import {
  channelsOf,
  darkestOfTile,
  darkestUnderWords,
  luminanceOf,
  newReader,
  ratioOf,
} from './tile';

const WIDTHS = [1440, 390];
const PAGES = [
  { name: 'the home page', path: '/' },
  { name: 'the 404', path: '/nowhere-here/' },
  { name: 'the privacy page', path: '/privacy/' },
];

for (const width of WIDTHS) {
  test.describe(`at ${width} wide`, () => {
    test.use({ viewport: { width, height: width > 800 ? 1000 : 844 } });

    for (const { name, path } of PAGES) {
      test(`${name}: every piece of text is 7:1 or better (4.5:1 if large)`, async ({
        page,
      }) => {
        await page.goto(path);
        // The home page's rows draw their page words by script, so it is
        // waited for and they are among those measured.
        if (path === '/')
          await expect(
            page.locator('section.row[data-arrows]').first(),
          ).toBeAttached();
        await page.evaluate(() => document.fonts.ready);
        const pieces = await textPieces(page);
        expect(pieces.length, 'text nodes measured').toBeGreaterThan(3);
        const short = pieces.filter(
          (piece) => piece.ratio < (piece.large ? 4.5 : 7),
        );
        expect(
          short.map(
            (piece) =>
              `${piece.ratio.toFixed(2)}:1 "${piece.text}" ${piece.colour} on ${piece.background}`,
          ),
        ).toEqual([]);
        test.info().annotations.push({
          type: 'measured',
          description: `${pieces.length} text nodes, ${pieces.filter((p) => p.large).length} large`,
        });
      });
    }

    test('with a card hovered, so that the others are dimmed, every piece of text is still 7:1 or better', async ({
      page,
    }) => {
      await page.goto('/');
      await expect(
        page.locator('section.row[data-arrows]').first(),
      ).toBeAttached();
      await page.evaluate(() => document.fonts.ready);
      const second = page
        .locator('section.row')
        .first()
        .locator('.card')
        .nth(1);
      await second.scrollIntoViewIfNeeded();
      // Pointed at by its title: at a phone's width the card is cut off at the
      // strip's edge, where the row's arrow lies over its picture, as tall as
      // the picture, and a pointer on the picture would be on the arrow.
      const box = await second.locator('.front .card-title').boundingBox();
      expect(box, 'the card is drawn').not.toBeNull();
      await page.mouse.move(
        (box?.x ?? 0) + (box?.width ?? 0) / 2,
        (box?.y ?? 0) + (box?.height ?? 0) / 2,
      );
      // The state is the one measured only if the neighbours have dimmed and
      // the ease has finished: wait for both, never a time.
      await expect(
        page
          .locator('section.row')
          .first()
          .locator('.card')
          .first()
          .locator('.frame img')
          .first(),
      ).not.toHaveCSS('filter', 'none');
      await page.waitForFunction(() => document.getAnimations().length === 0);
      const pieces = await textPieces(page);
      expect(pieces.length, 'text nodes measured').toBeGreaterThan(3);
      const short = pieces.filter(
        (piece) => piece.ratio < (piece.large ? 4.5 : 7),
      );
      expect(
        short.map(
          (piece) =>
            `${piece.ratio.toFixed(2)}:1 "${piece.text}" ${piece.colour} on ${piece.background}`,
        ),
      ).toEqual([]);
      test.info().annotations.push({
        type: 'measured',
        description: `${pieces.length} text nodes, with a card hovered`,
      });
    });

    test('an edge arrow’s edge and chevron, and a page mark, are 3:1 or better as drawn', async ({
      page,
    }) => {
      await page.goto('/');
      await expect(
        page.locator('section.row[data-arrows]').first(),
      ).toBeAttached();
      const first = page.locator('section.row').first();
      // Part way along, so that both arrows and the marks are drawn.
      await first.getByRole('button', { name: /^Next/ }).click();
      await expect(
        first.getByRole('button', { name: /^Previous/ }),
      ).toBeVisible();
      await page.waitForFunction(() => document.getAnimations().length === 0);
      const drawn = await page.evaluate(() => {
        const luminance = (colour: string): number => {
          const channels =
            colour
              .match(/[\d.]+/g)
              ?.map(Number)
              .slice(0, 3) ?? [];
          return [0.2126, 0.7152, 0.0722].reduce((sum, weight, at) => {
            const value = (channels[at] ?? 0) / 255;
            return (
              sum +
              weight *
                (value <= 0.03928
                  ? value / 12.92
                  : ((value + 0.055) / 1.055) ** 2.4)
            );
          }, 0);
        };
        const ratio = (a: string, b: string): number => {
          const [high, low] = [luminance(a), luminance(b)].sort(
            (x, y) => y - x,
          );
          return ((high ?? 0) + 0.05) / ((low ?? 0) + 0.05);
        };
        const row = document.querySelector('section.row');
        const out: { what: string; ratio: number }[] = [];
        // An arrow is on its own solid ground, so its edge and its chevron
        // are measured against that and not against the picture behind it.
        for (const arrow of row?.querySelectorAll<HTMLElement>(
          'button[data-page]',
        ) ?? []) {
          const style = getComputedStyle(arrow);
          const chevron = getComputedStyle(
            arrow.querySelector('svg') as Element,
          );
          out.push({
            what: `${arrow.dataset['page']} ground is solid`,
            ratio: style.backgroundColor.startsWith('rgb(') ? 99 : 0,
          });
          out.push({
            what: `${arrow.dataset['page']} edge`,
            ratio: ratio(style.borderTopColor, style.backgroundColor),
          });
          out.push({
            what: `${arrow.dataset['page']} chevron`,
            ratio: ratio(chevron.color, style.backgroundColor),
          });
        }
        const ground = getComputedStyle(document.body).backgroundColor;
        for (const mark of row?.querySelectorAll<HTMLElement>(
          '.row-pages .page-mark',
        ) ?? []) {
          out.push({
            what: `page mark${mark.hasAttribute('data-current') ? ' (current)' : ''}`,
            ratio: ratio(getComputedStyle(mark).borderTopColor, ground),
          });
        }
        return out;
      });
      expect(
        drawn.length,
        'edges, chevrons and marks measured',
      ).toBeGreaterThan(6);
      expect(drawn.filter((each) => each.what.includes('chevron')).length).toBe(
        2,
      );
      expect(
        drawn.filter((each) => each.what.startsWith('page mark')).length,
      ).toBeGreaterThan(1);
      for (const each of drawn)
        expect(
          each.ratio,
          `${each.what} is 3:1 or better`,
        ).toBeGreaterThanOrEqual(3);
    });

    // The cards' Pause is a small, quiet mark (the owner, 2026-11-23: the
    // button was big and in the way): a small disc of the ground with its
    // mark on it, inside a target that is still 44 by 44 and drawn clear.
    test('the cards’ Pause, over a playing loop, is a small disc of solid ground in a 44px target, its mark and ring 3:1 or better as drawn', async ({
      page,
    }) => {
      await page.emulateMedia({ reducedMotion: 'no-preference' });
      await page.goto('/');
      const card = await settleOnFirstRow(page);
      await card.locator('button.card-flip').focus();
      await page.keyboard.press('Tab');
      const pause = card.locator('button.card-pause');
      await expect(pause).toBeFocused();
      const drawn = await pause.evaluate((button) => {
        const channels = (colour: string): number[] =>
          colour
            .match(/[\d.]+/g)
            ?.map(Number)
            .slice(0, 4) ?? [];
        const luminance = (colour: string): number =>
          [0.2126, 0.7152, 0.0722].reduce((sum, weight, at) => {
            const value = (channels(colour)[at] ?? 0) / 255;
            return (
              sum +
              weight *
                (value <= 0.03928
                  ? value / 12.92
                  : ((value + 0.055) / 1.055) ** 2.4)
            );
          }, 0);
        const ratio = (a: string, b: string): number => {
          const [high, low] = [luminance(a), luminance(b)].sort(
            (x, y) => y - x,
          );
          return ((high ?? 0) + 0.05) / ((low ?? 0) + 0.05);
        };
        const style = getComputedStyle(button);
        const disc = getComputedStyle(button, '::before');
        const mark = getComputedStyle(button.querySelector('svg') as Element);
        const ground = disc.backgroundColor;
        // The ring's gap is a shadow of the ground round the target, so that
        // the ring is drawn against it and not against the loop.
        const gap = /^(rgb\([^)]*\))/.exec(style.boxShadow)?.[1] ?? '';
        const box = button.getBoundingClientRect();
        return {
          solid: ground.startsWith('rgb(') && channels(ground).length === 3,
          clear: style.backgroundColor === 'rgba(0, 0, 0, 0)',
          gapIsGround: gap === ground,
          mark: ratio(mark.color, ground),
          ring: ratio(style.outlineColor, ground),
          disc: parseFloat(disc.width),
          target: Math.min(box.width, box.height),
        };
      });
      expect(drawn.solid, 'the disc is solid ground').toBe(true);
      expect(drawn.clear, 'the target round it is clear').toBe(true);
      expect(drawn.gapIsGround, 'the ring has a gap of the ground').toBe(true);
      expect(drawn.mark).toBeGreaterThanOrEqual(3);
      expect(drawn.ring).toBeGreaterThanOrEqual(3);
      expect(drawn.disc, 'the disc is small').toBeLessThanOrEqual(26);
      expect(drawn.disc).toBeGreaterThan(0);
      expect(drawn.target, 'the target is 44px').toBeGreaterThanOrEqual(44);
    });

    test('the ring of every control Tab reaches is 3:1 or better against what is behind it', async ({
      page,
    }) => {
      await page.goto('/');
      await expect(
        page.locator('section.row[data-arrows]').first(),
      ).toBeAttached();
      const stops = await page.evaluate(
        () =>
          [
            ...document.querySelectorAll<HTMLElement>(
              'a[href], button, [tabindex="0"]',
            ),
            // A card's face that is turned away is inert: it is drawn (its
            // back hidden) but nothing in it is a stop.
          ].filter(
            (el) => el.checkVisibility() && el.closest('[inert]') === null,
          ).length,
      );
      expect(stops).toBeGreaterThan(3);
      const rings: string[] = [];
      for (let stop = 0; stop < stops; stop += 1) {
        await page.keyboard.press('Tab');
        const seen = await page.evaluate(() => {
          const el = document.activeElement;
          if (el === null) return null;
          const channels = (colour: string): number[] =>
            colour
              .match(/[\d.]+/g)
              ?.map(Number)
              .slice(0, 3) ?? [];
          const luminance = (colour: string): number =>
            [0.2126, 0.7152, 0.0722].reduce((sum, weight, at) => {
              const value = (channels(colour)[at] ?? 0) / 255;
              return (
                sum +
                weight *
                  (value <= 0.03928
                    ? value / 12.92
                    : ((value + 0.055) / 1.055) ** 2.4)
              );
            }, 0);
          // The ring is on the control or, for a card, on the card, and it is
          // drawn outside its owner (or inside the strip, which has no
          // background of its own), so what is behind it is the first
          // background found from the owner's parent upwards.
          const owner = [el, el.closest('li')].find(
            (each): each is Element =>
              each !== null &&
              getComputedStyle(each).outlineStyle !== 'none' &&
              getComputedStyle(each).outlineColor !== 'rgba(0, 0, 0, 0)',
          );
          if (owner === undefined) return { label: 'no ring', ratio: 0 };
          const colour = getComputedStyle(owner).outlineColor;
          let background = 'rgba(0, 0, 0, 0)';
          for (
            let up = owner.parentElement;
            up !== null && background === 'rgba(0, 0, 0, 0)';
            up = up.parentElement
          )
            background = getComputedStyle(up).backgroundColor;
          const [high, low] = [luminance(colour), luminance(background)].sort(
            (x, y) => y - x,
          );
          return {
            label: `${(el.getAttribute('aria-label') ?? el.textContent ?? '').trim().slice(0, 30)}: ${colour} on ${background}`,
            ratio: ((high ?? 0) + 0.05) / ((low ?? 0) + 0.05),
          };
        });
        expect(seen, `stop ${stop} has focus`).not.toBeNull();
        expect(
          seen?.ratio,
          `ring of ${seen?.label ?? 'nothing'} is 3:1 or better`,
        ).toBeGreaterThanOrEqual(3);
        rings.push(seen?.label ?? '');
      }
      expect(rings.length).toBe(stops);
      // Controls that script shows were reached: a row's Next arrow and a
      // card's flip button, whose ring is drawn round its card.
      expect(rings.some((ring) => ring.startsWith('Next'))).toBe(true);
      expect(rings.some((ring) => ring.startsWith('About '))).toBe(true);
    });
  });
}

// Every card is a light tile in its finish, with dark words, so the tokens
// say nothing of what is under a word: the tile moves with the light and the
// finish is a picture of bands, sparkles and shards. It is measured as drawn.
// For one card of each finish (cracked ice on two), at rest and at full
// shine (a mouse on the card), with the light at the corners, the edges and the
// middle, the words are hidden and the pixels they stood on are read; the
// darkest of them is the ground the words must hold 7:1 against. The front's
// label and title, then the back's label, title and description (at a desk,
// where the back is a face of the card: a phone's back is the dark sheet,
// held by the text measure above). Then, on the back, the Play link's edge and
// every focus ring in it are 3:1 against the darkest of the tile.
const CARDS = [
  { id: 'aquaclysm', finish: 'holo' },
  { id: 'ooergolf', finish: 'gold' },
  { id: 'chopdrop', finish: 'galaxy' },
  { id: 'fruit-machine', finish: 'ice' },
  { id: 'coinpusher', finish: 'ice' },
  { id: 'chess', finish: 'reverse' },
] as const;

const PLACES = [
  [0, 0],
  [1, 0],
  [0.5, 0.5],
  [0, 1],
  [1, 1],
  [0.3, 0.9],
  [0.9, 0.3],
] as const;

test.describe('every finish’s words, on its tile, as drawn', () => {
  test.use({ viewport: { width: 1440, height: 1000 } });
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
  });

  test('front and back words are 7:1 or better against the darkest of their tile, at rest and at full shine, the light anywhere; the Play edge and every ring 3:1', async ({
    page,
  }) => {
    test.setTimeout(180_000);
    await page.goto('/');
    await expect(
      page.locator('section.row[data-arrows]').first(),
    ).toBeAttached();
    await page.evaluate(() => document.fonts.ready);
    const reader = await newReader(page);
    const ink = await page.evaluate(() =>
      getComputedStyle(document.documentElement)
        .getPropertyValue('--color-ground')
        .trim(),
    );
    expect(ink).toMatch(/^#[0-9a-f]{6}$/);
    const inkLuminance = luminanceOf(
      [1, 3, 5].map((at) => parseInt(ink.slice(at, at + 2), 16)),
    );
    const worst: Record<string, number> = {};
    const note = (key: string, ratio: number) => {
      worst[key] = Math.min(worst[key] ?? Infinity, ratio);
    };
    let measured = 0;
    for (const { id, finish } of CARDS) {
      const card = page.locator(`li.card[data-entry="${id}"]`).first();
      expect(await card.getAttribute('data-finish'), id).toBe(finish);
      await card.evaluate((el) =>
        el.scrollIntoView({
          block: 'center',
          inline: 'center',
          behavior: 'instant',
        }),
      );
      const title = card.locator('.front .card-title');
      const box = await title.boundingBox();
      if (box === null) throw new Error('the title is not drawn');
      const pointAt = () =>
        page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      const states = [
        {
          name: 'rest',
          settle: async () => {
            await page.mouse.move(2, 2);
            await expect
              .poll(() =>
                card.evaluate((el) =>
                  getComputedStyle(el).getPropertyValue('--foil-on'),
                ),
              )
              .toBe('0.35');
          },
        },
        {
          name: 'full',
          settle: async () => {
            await pointAt();
            await expect
              .poll(() =>
                card.evaluate((el) =>
                  getComputedStyle(el).getPropertyValue('--foil-on'),
                ),
              )
              .toBe('1');
          },
        },
      ];
      const light = (x: number, y: number) =>
        card.evaluate(
          (el: HTMLElement, [x, y]) => {
            el.style.setProperty('--shine-x', String(x));
            el.style.setProperty('--shine-y', String(y));
          },
          [x, y],
        );
      const readWords = async (
        face: string,
        parts: string[],
        state: string,
      ) => {
        for (const [x, y] of PLACES) {
          await light(x, y);
          for (const part of parts) {
            const words = card.locator(`${face} ${part}`);
            const colour = await words.evaluate(
              (el) => getComputedStyle(el).color,
            );
            // The words are the ink, the ground token, and not another dark.
            expect(
              luminanceOf(channelsOf(colour)),
              `${id} ${face} ${part} is the ink`,
            ).toBeCloseTo(inkLuminance, 4);
            const ratio = ratioOf(
              luminanceOf(channelsOf(colour)),
              await darkestUnderWords(page, reader, words),
            );
            note(`${finish} ${face}`, ratio);
            expect(
              ratio,
              `${id} ${face} ${part} ${state}, light at ${x},${y}`,
            ).toBeGreaterThanOrEqual(7);
            measured += 1;
          }
        }
      };
      for (const state of states) {
        await state.settle();
        await readWords('.front', ['.label', '.card-title'], state.name);
      }
      // Turned over (a press on the card): the back is the same tile.
      await pointAt();
      await card.locator('button.card-flip').click();
      await expect(card).toHaveAttribute('data-flipped', '');
      const back = card.locator('.face.back');
      for (const state of states) {
        await state.settle();
        await readWords(
          '.face.back',
          ['.label', '.card-title', '.description'],
          state.name,
        );
        // The rings, by a real Tab, read first (hiding the face to read its
        // tile takes focus off what is in it): Play, then Close.
        const rings: { what: string; colour: string }[] = [];
        const ringNow = async () => {
          const ring = await page.evaluate(() => {
            const el = document.activeElement;
            if (el === null) return null;
            const style = getComputedStyle(el);
            return {
              what: el.className,
              colour: style.outlineColor,
              style: style.outlineStyle,
              width: parseFloat(style.outlineWidth),
            };
          });
          expect(ring, `${id} has focus`).not.toBeNull();
          expect(ring?.style, `${id} ${ring?.what} ring`).toBe('solid');
          expect(ring?.width).toBeGreaterThanOrEqual(2);
          rings.push({ what: ring?.what ?? '', colour: ring?.colour ?? '' });
        };
        await card.locator('.face.back button.card-unflip').focus();
        await page.keyboard.press('Shift+Tab');
        await expect(card.locator('a.card-link')).toBeFocused();
        await ringNow();
        await page.keyboard.press('Tab');
        await expect(card.locator('button.card-unflip')).toBeFocused();
        await ringNow();
        // The Play link's edge and every ring, against the tile's darkest.
        const edge = await card
          .locator('a.card-link')
          .evaluate((el) => getComputedStyle(el).borderTopColor);
        // The edge is drawn, and is the ink itself: a clear one would read as
        // black to a ratio and pass.
        expect(edge, `${id} Play edge is drawn`).toMatch(/^rgb\(/);
        expect(
          luminanceOf(channelsOf(edge)),
          `${id} Play edge is the ink`,
        ).toBeCloseTo(inkLuminance, 4);
        for (const [x, y] of PLACES) {
          await light(x, y);
          const darkest = await darkestOfTile(page, reader, back);
          const edgeRatio = ratioOf(luminanceOf(channelsOf(edge)), darkest);
          note(`${finish} play edge`, edgeRatio);
          expect(
            edgeRatio,
            `${id} Play edge ${state.name}, light at ${x},${y}`,
          ).toBeGreaterThanOrEqual(3);
          for (const ring of rings) {
            const ringRatio = ratioOf(
              luminanceOf(channelsOf(ring.colour)),
              darkest,
            );
            note(`${finish} ring`, ringRatio);
            expect(
              ringRatio,
              `${id} ring of ${ring.what} ${state.name}, light at ${x},${y}`,
            ).toBeGreaterThanOrEqual(3);
          }
          measured += 1 + rings.length;
        }
      }
      await page.keyboard.press('Escape');
      await expect(card).not.toHaveAttribute('data-flipped', '');
      await page.mouse.move(2, 2);
    }
    await reader.close();
    expect(measured).toBeGreaterThan(CARDS.length * PLACES.length * 10);
    const summary = Object.entries(worst)
      .map(([key, ratio]) => `${key} ${ratio.toFixed(2)}:1`)
      .join('; ');
    console.log(`TILE-WORST ${summary}`);
    test.info().annotations.push({
      type: 'measured',
      description: `${measured} readings; worst ${summary}`,
    });
  });
});
