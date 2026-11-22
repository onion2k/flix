// Holds the privacy page: it answers, has one h1 and the five sections of
// the owner's words as h2 in order, no skipped heading level, the wordmark
// as a link home, each outside link at the address the words give, the date
// it was last reviewed, and the head of an indexed page (canonical address,
// no noindex). It also holds WCAG 1.4.8: at a desk's width no paragraph runs
// to more than 80 characters a line, measured from the drawn page by
// finding where each character of each paragraph was put and counting the
// characters on each line. Each test counts what it reached. Without it a
// reworded heading, a dropped link or a measure widened for looks would pass
// every other spec, since none of them reads this page's words.
import { expect } from '@playwright/test';
import { test } from '../clock';

const SITE = 'https://flix.ooer.com';
const SECTIONS = [
  'What this site collects',
  'What your browser keeps',
  'What the host sees',
  'Where the cards go',
  'Getting in touch',
];
const LINKS = [
  ['Netlify', 'https://www.netlify.com/'],
  ['privacy policy', 'https://www.netlify.com/privacy/'],
  [
    'privacy statement',
    'https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement',
  ],
  ['issue tracker', 'https://github.com/onion2k/flix/issues'],
] as const;

test('the page answers 200, with one h1 and the five sections in order', async ({
  page,
}) => {
  const response = await page.goto('/privacy/');
  expect(response?.status()).toBe(200);
  await expect(page.locator('h1')).toHaveCount(1);
  await expect(page.locator('h1')).toHaveText('Privacy');
  await expect(page.locator('h2')).toHaveText(SECTIONS);
  const levels = await page
    .locator('h1, h2, h3, h4, h5, h6')
    .evaluateAll((all) => all.map((each) => Number(each.tagName.slice(1))));
  expect(levels.length).toBe(SECTIONS.length + 1);
  expect(levels[0]).toBe(1);
  levels.forEach((level, at) => {
    if (at > 0) expect(level).toBeLessThanOrEqual((levels[at - 1] ?? 0) + 1);
  });
});

test('the wordmark is a link home, and the skip link says content', async ({
  page,
}) => {
  await page.goto('/privacy/');
  await expect(
    page.getByRole('banner').getByRole('link', { name: 'ooerflix' }),
  ).toHaveAttribute('href', '/');
  await expect(
    page.getByRole('link', { name: 'Skip to the content' }),
  ).toHaveAttribute('href', '#main');
});

test('the outside links are where the words say, and the review date is shown', async ({
  page,
}) => {
  await page.goto('/privacy/');
  const main = page.locator('main');
  for (const [name, address] of LINKS) {
    const link = main.getByRole('link', { name, exact: true });
    await expect(link, `${name} is linked once`).toHaveCount(1);
    await expect(link).toHaveAttribute('href', address);
  }
  await expect(main.getByRole('link')).toHaveCount(LINKS.length);
  const reviewed = main.locator('p', { hasText: 'Last reviewed' });
  await expect(reviewed).toHaveCount(1);
  await expect(reviewed.locator('strong')).toHaveText('22 November 2026');
});

test('the head is an indexed page: canonical address, a description, no noindex', async ({
  page,
}) => {
  await page.goto('/privacy/');
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    'href',
    `${SITE}/privacy/`,
  );
  await expect(page.locator('meta[name="robots"]')).toHaveCount(0);
  await expect(page.locator('meta[name="description"]')).toHaveAttribute(
    'content',
    'What this site collects, where it goes, and what is kept in your browser.',
  );
  await expect(page).toHaveTitle('Privacy: ooerflix');
});

test('at 1440 wide no paragraph runs to more than 80 characters a line', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/privacy/');
  await page.evaluate(() => document.fonts.ready);
  const lines = await page.evaluate(() => {
    const found: { text: string; characters: number }[] = [];
    for (const paragraph of document.querySelectorAll('p')) {
      const walker = document.createTreeWalker(paragraph, NodeFilter.SHOW_TEXT);
      const range = document.createRange();
      let top = Number.NaN;
      let line = { text: '', characters: 0 };
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const text = node.textContent ?? '';
        for (let at = 0; at < text.length; at += 1) {
          range.setStart(node, at);
          range.setEnd(node, at + 1);
          const box = range.getBoundingClientRect();
          // A collapsed space has no width and is not drawn.
          if (box.width === 0) continue;
          // A new line is where a character sits a half line lower.
          if (Number.isNaN(top) || box.top > top + box.height / 2) {
            if (line.characters > 0) found.push(line);
            line = { text: '', characters: 0 };
            top = box.top;
          }
          line.text += text[at];
          line.characters += 1;
        }
      }
      if (line.characters > 0) found.push(line);
    }
    return found;
  });
  expect(lines.length, 'lines measured').toBeGreaterThan(15);
  const longest = Math.max(...lines.map((line) => line.characters));
  test.info().annotations.push({
    type: 'measured',
    description: `${lines.length} lines, the longest ${longest} characters`,
  });
  expect(
    lines
      .filter((line) => line.characters > 80)
      .map((line) => `${line.characters}: ${line.text}`),
  ).toEqual([]);
});
