// How the end-to-end and look tests run: against the built site, served by
// `astro preview`, in Chromium alone. Without this file the tests would have
// no address to open and would not be told which browser, so a result would
// depend on whichever Playwright found first. The build is made beforehand
// (`npm run build`): a check answers for the built thing, and a preview of a
// stale build has passed old code before.
import { defineConfig, devices } from '@playwright/test';

// Port 4390 is this project's own for tests, so that they never meet a dev
// server another session has open on Astro's 4321.
const address = 'http://localhost:4390';

export default defineConfig({
  testDir: 'tests',
  use: { baseURL: address },
  // Never reuse a server already on the port: it would be someone else's, and
  // it may serve a build that is not this one.
  webServer: {
    command: 'npm run preview',
    url: address,
    reuseExistingServer: false,
  },
  projects: [
    {
      name: 'e2e',
      testDir: 'tests/e2e',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'look',
      testDir: 'tests/look',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
