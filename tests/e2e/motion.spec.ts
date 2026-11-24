// Holds spec 5: no animation, transition or smooth scroll exists outside a
// `prefers-reduced-motion: no-preference` block. It walks every rule of every
// stylesheet of the built home page, 404 and privacy page through the CSSOM (nested media
// rules and keyframes included), so it reads what the browser holds and not
// what the source says, and then checks the effect: with reduced motion
// emulated a card's picture has no transition time and a strip jumps rather
// than glides, and the card a reader settles on shows a Play button and no
// loop, the button with no transition of its own; with no preference they do
// move and the loop plays, so the check cannot pass by there being nothing to
// switch off. A page that read no rule fails, and the count
// of rules read and of rules that set motion is attached to the report.
// Without it a transition added outside the block would move for a visitor
// who asked for stillness, and no other test would notice.
import { expect } from '@playwright/test';
import { test } from '../clock';
import { settleOnFirstRow } from './card-loop';

const PAGES = [
  { name: 'the home page', path: '/' },
  { name: 'the 404', path: '/nowhere-here/' },
  { name: 'the privacy page', path: '/privacy/' },
];

interface Walk {
  read: number;
  moving: number;
  outside: string[];
}

for (const { name, path } of PAGES) {
  test(`${name}: every rule that sets motion is inside the no-preference block`, async ({
    page,
  }) => {
    await page.goto(path);
    const walk = await page.evaluate((): Walk => {
      const result: Walk = { read: 0, moving: 0, outside: [] };
      const setsMotion = (rule: CSSRule): boolean => {
        if (rule instanceof CSSKeyframesRule) return true;
        if (!(rule instanceof CSSStyleRule)) return false;
        const style = rule.style;
        for (let at = 0; at < style.length; at += 1) {
          const property = style.item(at);
          if (
            property.startsWith('transition') ||
            property.startsWith('animation')
          )
            return true;
        }
        return style.getPropertyValue('scroll-behavior') === 'smooth';
      };
      const walkRules = (rules: CSSRuleList, inside: boolean): void => {
        for (const rule of rules) {
          result.read += 1;
          if (setsMotion(rule)) {
            result.moving += 1;
            if (!inside) result.outside.push(rule.cssText.slice(0, 120));
          }
          if (rule instanceof CSSMediaRule) {
            const here = /prefers-reduced-motion:\s*no-preference/.test(
              rule.conditionText,
            );
            walkRules(rule.cssRules, inside || here);
          } else if ('cssRules' in rule) {
            walkRules(rule.cssRules as CSSRuleList, inside);
          }
        }
      };
      for (const sheet of document.styleSheets)
        walkRules(sheet.cssRules, false);
      return result;
    });
    expect(walk.read, 'rules read').toBeGreaterThan(0);
    expect(walk.moving, 'rules that set motion').toBeGreaterThan(0);
    expect(walk.outside, 'motion outside the block').toEqual([]);
    test.info().annotations.push({
      type: 'measured',
      description: `${walk.read} rules read, ${walk.moving} set motion`,
    });
  });
}

test('with reduced motion a card picture has no transition and the strip jumps', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const picture = page.locator('.card[data-linked] .frame img').first();
  const strip = page.locator('.strip').first();
  await expect(picture).toBeAttached();
  expect(
    await picture.evaluate((el) => getComputedStyle(el).transitionDuration),
  ).toBe('0s');
  expect(
    await strip.evaluate((el) => getComputedStyle(el).scrollBehavior),
  ).toBe('auto');
});

test('with no preference they do move, so that the check above is not vacuous', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/');
  const picture = page.locator('.card[data-linked] .frame img').first();
  const strip = page.locator('.strip').first();
  await expect(picture).toBeAttached();
  expect(
    await picture.evaluate((el) => getComputedStyle(el).transitionDuration),
  ).not.toBe('0s');
  expect(
    await strip.evaluate((el) => getComputedStyle(el).scrollBehavior),
  ).toBe('smooth');
});

test('with reduced motion the card settled on shows Play and no loop, and its button does not move', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
  const card = await settleOnFirstRow(page, false);
  const pause = card.locator('button.card-pause');
  await expect(pause).toHaveAccessibleName('Play the card videos');
  await expect(page.locator('section.row video')).toHaveCount(0);
  for (const each of [pause, card.locator('.card-pause-place')])
    expect(
      await each.evaluate((el) => {
        const style = getComputedStyle(el);
        return [
          style.transitionDuration,
          style.animationName,
          el.getAnimations().length,
        ];
      }),
    ).toEqual(['0s', 'none', 0]);
});

test('with no preference the card settled on plays its loop, which eases into the house lights', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
  const card = await settleOnFirstRow(page);
  await expect(card.locator('button.card-pause')).toHaveAccessibleName(
    'Pause the card videos',
  );
  expect(
    await card
      .locator('video')
      .evaluate((el) => getComputedStyle(el).transitionDuration),
  ).not.toBe('0s');
});

// Every card's shine (part 5 of plans/cards.md, then plans/foils.md): its sheen and tilt ease only
// where motion is allowed, and with less motion asked for nothing about them has
// a transition, so the walk above has reached them as well as passed them.
for (const reducedMotion of ['reduce', 'no-preference'] as const) {
  test(`with ${reducedMotion === 'reduce' ? 'reduced motion every card’s sheen and tilt have no transition' : 'no preference every card’s sheen and tilt ease'}`, async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion });
    await page.goto('/');
    const cards = page.locator('li.card');
    expect(await cards.count()).toBeGreaterThan(0);
    let reached = 0;
    for (const card of await cards.all()) {
      const eases = await card.evaluate((el) => {
        const style = getComputedStyle(el);
        const names = style.transitionProperty.split(',').map((n) => n.trim());
        const times = style.transitionDuration
          .split(',')
          .map((t) => parseFloat(t));
        return ['--shine-x', '--shine-y', '--tilt-x', '--tilt-y'].map(
          (name) => {
            const at = names.indexOf(name);
            return at < 0 ? 0 : (times[at % times.length] ?? 0);
          },
        );
      });
      if (reducedMotion === 'reduce') expect(eases).toEqual([0, 0, 0, 0]);
      else for (const time of eases) expect(time).toBeGreaterThan(0);
      reached += 1;
    }
    expect(reached).toBe(await cards.count());
  });
}
