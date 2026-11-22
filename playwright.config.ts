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
  // A test that waits on a state fails in seconds; one that waits longer is
  // waiting on something that is not coming.
  timeout: 15_000,
  use: { baseURL: address },
  // Pictures sit beside the spec that takes them, one folder, no platform in
  // the name: they are this machine's and the file says so in its header.
  snapshotPathTemplate: '{testDir}/baselines/{arg}{ext}',
  // Never reuse a server already on the port: it would be someone else's, and
  // it may serve a build that is not this one.
  webServer: {
    // Astro 7 sends `preview` to the background and exits when it is run by an
    // agent or in CI-like shells, which Playwright reads as the server dying.
    // --ignore-lock keeps it in the foreground, and leaves no lock file
    // behind for a later `astro preview` to trip over.
    command: 'npm run preview -- --ignore-lock',
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
      // Page weight: measured in Chromium, held to gates/weight.json.
      name: 'weight',
      testDir: 'tests/gates',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      // Drawn in software: the GPU path coloured a card's picture two ways,
      // by chance, so a baseline could not be held to. See look.spec.ts.
      name: 'look',
      testDir: 'tests/look',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: { args: ['--disable-gpu'] },
      },
    },
  ],
});
