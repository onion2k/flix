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
// reading. A spec that sets a time of its own (today.spec.ts and hero.spec.ts
// open the page on other days) sets it after this and wins, which is what it
// means to.
//
// It also stands in a WebGPU adapter in every context it holds the clock for.
// Most visitors' browsers have one, and headless Chromium has none, so without
// it the page would say on eight cards that their sites will not run (see
// src/scripts/webgpu.ts) in every spec and every look picture. The stand-in
// answers `navigator.gpu.requestAdapter()` with a plain object, and a spec says
// otherwise by setting `window.__gpu` in an init script of its own, to one of
// 'adapter' (the default), 'null' (no adapter), 'reject' (the request fails),
// 'pending' (it never answers) or 'none' (there is no navigator.gpu). The
// stand-in reads that at the call and not at install, so it does not matter
// which init script runs first. It counts the calls in `window.__gpuCalls` and
// says in `window.__gpuCalledAfterLoad` whether the first came once the
// window's `load` had fired (null until there has been a call).
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
 * A day number, near 2024, that falls at a place in a list of `count`
 * candidates, so that a spec can open the page on each feature in turn. Worked
 * out here from the day number and never from the code under test.
 */
export function dayAt(place: number, count: number): number {
  const base = 20_000;
  return base - (base % count) + place;
}

/** The values a spec may set `window.__gpu` to. */
export type GpuMode = 'adapter' | 'null' | 'reject' | 'pending' | 'none';

/**
 * Runs in the page before its own scripts: the WebGPU stand-in described
 * above. It is a function and not a string so that it is type-checked; it
 * captures nothing, since Playwright sends its source to the page.
 */
function standInWebGPU(): void {
  const mode = (): string =>
    String((window as unknown as { __gpu?: string }).__gpu ?? 'adapter');
  const gone = window as unknown as Record<string, unknown>;
  gone['__gpuCalls'] = 0;
  gone['__gpuCalledAfterLoad'] = null;
  let loaded = false;
  window.addEventListener('load', () => {
    loaded = true;
  });
  const gpu = {
    requestAdapter(): Promise<unknown> {
      gone['__gpuCalls'] = (gone['__gpuCalls'] as number) + 1;
      if (gone['__gpuCalledAfterLoad'] === null)
        gone['__gpuCalledAfterLoad'] = loaded;
      switch (mode()) {
        case 'null':
          return Promise.resolve(null);
        case 'reject':
          return Promise.reject(new Error('no adapter'));
        case 'pending':
          return new Promise(() => undefined);
        default:
          return Promise.resolve({});
      }
    },
  };
  Object.defineProperty(navigator, 'gpu', {
    configurable: true,
    get: () => (mode() === 'none' ? undefined : gpu),
  });
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
  await context.addInitScript(standInWebGPU);
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
