// Holds that the built home page, 404 and privacy page each carry a content-security policy
// in a <meta> tag, and that its script-src allows neither 'unsafe-inline' nor
// 'unsafe-eval'. The policy is written by the build from a hash of each inline
// script, so a change that stops that (an inline handler, a script the build
// cannot hash) would leave the page either broken or with the policy loosened
// to cover it. Without this nothing reads the policy the page actually ships.
import { expect } from '@playwright/test';
import { test } from '../clock';

for (const { name, path } of [
  { name: 'the home page', path: '/' },
  { name: 'the 404', path: '/nowhere-here/' },
  { name: 'the privacy page', path: '/privacy/' },
]) {
  test(`${name} has a policy whose script-src allows no inline or eval`, async ({
    page,
  }) => {
    await page.goto(path);
    const meta = page.locator('meta[http-equiv="content-security-policy"]');
    await expect(meta).toHaveCount(1);
    const policy = (await meta.getAttribute('content')) ?? '';
    const script = policy
      .split(';')
      .map((directive) => directive.trim())
      .find((directive) => directive.startsWith('script-src '));
    expect(script, 'the policy has a script-src').toBeDefined();
    expect(script).not.toContain("'unsafe-inline'");
    expect(script).not.toContain("'unsafe-eval'");
  });
}
