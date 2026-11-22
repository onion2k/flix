// Holds that the page asks nothing of any other origin and says nothing wrong
// to the console: it loads the page, scrolls to the end, works a row, and then
// reads every request, response and console message. A script or style the
// content policy refuses shows here as a console error, so this is also the
// test that the policy and the script agree.
import { expect, test } from '@playwright/test';
import { readRows } from './catalogue';

const catalogue = readRows();

test("every request is to the page's own origin, none fails, the console is clean", async ({
  page,
  baseURL,
}) => {
  const own = new URL(baseURL ?? '').origin;
  const requests: string[] = [];
  const failed: string[] = [];
  const bad: string[] = [];
  const talk: string[] = [];
  page.on('request', (request) => requests.push(request.url()));
  page.on('requestfailed', (request) => failed.push(request.url()));
  page.on('response', (response) => {
    if (response.status() >= 400)
      bad.push(`${response.status()} ${response.url()}`);
  });
  page.on('console', (message) => {
    if (['error', 'warning'].includes(message.type()))
      talk.push(`${message.type()}: ${message.text()}`);
  });
  page.on('pageerror', (error) => talk.push(`uncaught: ${error.message}`));

  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  const first = catalogue.rows[0];
  if (first === undefined) throw new Error('no rows were read');
  const next = page
    .locator(`section[id="${first.id}"]`)
    .getByRole('button', { name: /^Next/ });
  await next.click();
  const list = page.locator(`section[id="${first.id}"]`).getByRole('list');
  await expect
    .poll(() => list.evaluate((el) => el.scrollLeft))
    .toBeGreaterThan(0);
  // Every picture, lazy ones included, has come in.
  await page.waitForFunction(() =>
    [...document.images].every((img) => img.complete),
  );

  expect(requests.length).toBeGreaterThan(5);
  expect(requests.filter((url) => new URL(url).origin !== own)).toEqual([]);
  expect(failed).toEqual([]);
  expect(bad).toEqual([]);
  expect(talk).toEqual([]);
});
