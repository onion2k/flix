// Holds spec 5: no animation, transition or smooth scroll exists outside a
// `prefers-reduced-motion: no-preference` block. It walks every rule of every
// stylesheet of the built home page and 404 through the CSSOM (nested media
// rules and keyframes included), so it reads what the browser holds and not
// what the source says, and then checks the effect: with reduced motion
// emulated a card's picture has no transition time and a strip jumps rather
// than glides; with no preference they do, so the check cannot pass by there
// being nothing to switch off. A page that read no rule fails, and the count
// of rules read and of rules that set motion is attached to the report.
// Without it a transition added outside the block would move for a visitor
// who asked for stillness, and no other test would notice.
import { expect, test } from '@playwright/test';

const PAGES = [
  { name: 'the home page', path: '/' },
  { name: 'the 404', path: '/nowhere-here/' },
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
