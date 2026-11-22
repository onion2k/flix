// The one `test` every Playwright spec uses, which holds the page's clock. With
// a list of features set in src/content/catalogue.json the page shows a
// different feature each day, so a spec that read the real clock would see one
// page today and another tomorrow. This holds Date at a fixed reading before
// any page script runs, in every context a test is given, and says how a test
// opens the page on another day. Without it a spec would pass on the day it
// was written and fail, with no change made, on a later one.
//
// What is held is Date alone (Playwright's setFixedTime): timers, animation
// frames and performance.now keep running, so a spec that waits for a frame
// still gets one. A spec that wants to step all of them, as moving.spec.ts
// does, installs Playwright's clock itself, which takes the place of this
// reading. A spec that sets a time of its own (surprise.spec.ts seeds chance
// from the clock) sets it after this and wins, which is what it means to.
//
// tests/unit/fixture-used.test.ts holds that no spec imports `test` from
// anywhere but here.
import { test as base, type BrowserContext } from '@playwright/test';

/** The length of a day, in milliseconds, as a test counts them. */
export const DAY_MS = 86_400_000;

/**
 * Where the clock is held unless a test says otherwise: noon on day 0, the
 * first of January 1970 UTC. Day 0 is the first candidate whatever the list's
 * length, so the page a spec sees is the page without a list.
 */
export const DAY_ZERO = 12 * 3_600_000;

/** The reading for the middle of a whole day, counted from 1970-01-01 UTC. */
export function noonOf(day: number): number {
  return day * DAY_MS + 12 * 3_600_000;
}

/**
 * Holds a context's clock at a reading. Called by the fixture, and by a spec
 * that makes a context of its own (the weight gate does) or another day.
 */
export async function holdClock(
  context: BrowserContext,
  at: number = DAY_ZERO,
): Promise<void> {
  await context.clock.setFixedTime(at);
}

export const test = base.extend<{ heldClock: undefined }>({
  heldClock: [
    async ({ context }, use) => {
      await holdClock(context);
      await use(undefined);
    },
    { auto: true },
  ],
});
