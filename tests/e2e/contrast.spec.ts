// Holds contrast as the page is drawn, not as the tokens say it should be:
// every piece of text on the home page, the 404 and the privacy page, at a desk's width and a
// phone's, against the nearest background that is not transparent, is 7:1 or
// better (4.5:1 where WCAG calls the text large); and each control that a real
// Tab press focuses has a ring that is 3:1 or better against what is behind
// it. The page has no text over a picture, so the nearest background is
// always a flat token colour. Without it a rule that recoloured a link, or a
// ring lost to a later declaration, would pass the token check, which never
// sees the page. Each test counts what it measured, so reading nothing fails.
import { expect } from '@playwright/test';
import { test } from '../clock';
import { textPieces } from './text-pieces';

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
        // The home page's button is shown by script, so it is waited for and
        // its words are among those measured.
        if (path === '/')
          await expect(
            page.getByRole('button', { name: 'Surprise me' }),
          ).toBeVisible();
        await page.evaluate(() => document.fonts.ready);
        const pieces = await textPieces(page);
        expect(pieces.length, 'text nodes measured').toBeGreaterThan(3);
        if (path === '/')
          expect(pieces.map((piece) => piece.text)).toContain('Surprise me');
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
      const box = await second.boundingBox();
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

    test('the ring of every control Tab reaches is 3:1 or better against what is behind it', async ({
      page,
    }) => {
      await page.goto('/');
      await expect(
        page.locator('section.row[data-arrows]').first(),
      ).toBeAttached();
      await expect(
        page.getByRole('button', { name: 'Surprise me' }),
      ).toBeVisible();
      const stops = await page.evaluate(
        () =>
          [
            ...document.querySelectorAll<HTMLElement>(
              'a[href], button, [tabindex="0"]',
            ),
          ].filter((el) => el.checkVisibility()).length,
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
      expect(rings.some((ring) => ring.startsWith('Surprise me'))).toBe(true);
    });
  });
}
