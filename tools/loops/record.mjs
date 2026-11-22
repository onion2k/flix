// Records, from each game's public page, a short silent loop of the game being
// played by a scripted player, and encodes it twice: a card loop 640 wide and,
// for the sites the catalogue names as features, a hero loop 960 wide. The
// loops are for the owner to approve; nothing in the site uses them yet.
//
//   npm run loops -- <site id>     remake one loop
//   npm run loops                  remake all of them, then the sheet and video
//
// This visits the public addresses over the network, so it is never part of
// `npm run check` and never runs in a test or a hook. ffmpeg is the machine's
// own (Homebrew), not a dependency of the project. Without this one command a
// loop could only be made by hand, and an approved loop could not be built
// again when a game changes: a loop is built again and never edited.
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { recipes } from './recipes.mjs';
import { makeSheet } from './sheet.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');
const out = join(here, 'out');
const work = join(out, 'work');
const FFMPEG = process.env.FFMPEG ?? '/opt/homebrew/bin/ffmpeg';
const { chromium } = createRequire(join(root, 'package.json'))(
  '@playwright/test',
);

// Chromium's own flags for the GPU: most of these games draw with WebGPU, and
// without them they draw nothing headless.
const BROWSER_ARGS = ['--enable-unsafe-webgpu', '--use-angle=metal'];
const SIZE = { width: 1280, height: 720 };
const SECONDS = 6;
// The measured settings: about 200 KB at 640 wide and 355 KB at 960.
const CARD_WIDTH = 640;
const HERO_WIDTH = 960;

const catalogue = JSON.parse(
  readFileSync(join(root, 'src/content/catalogue.json'), 'utf8'),
);
const heroes = new Set([catalogue.feature, ...catalogue.features]);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// One step of a recipe, done as a player would do it. Returns nothing; a
// {mark} step is handled by the caller because it needs the clock.
async function doStep(page, step) {
  if ('wait' in step) return sleep(step.wait);
  if ('waitFor' in step) {
    return page.locator(step.waitFor).first().waitFor({ timeout: 30000 });
  }
  if ('click' in step) {
    if (typeof step.click === 'string') {
      return page.locator(step.click).first().click({ timeout: 15000 });
    }
    return page.mouse.click(step.click[0], step.click[1]);
  }
  if ('key' in step) {
    // Held for a time, as a finger holds a key.
    await page.keyboard.down(step.key);
    await sleep(step.hold ?? 100);
    return page.keyboard.up(step.key);
  }
  if ('down' in step) return page.keyboard.down(step.down);
  if ('up' in step) return page.keyboard.up(step.up);
  if ('press' in step) return page.keyboard.press(step.press);
  if ('drag' in step) {
    // A drag along a path of points, taking `ms` in all, with the button down.
    const pts = step.drag;
    const per = (step.ms ?? 600) / (pts.length - 1);
    await page.mouse.move(pts[0][0], pts[0][1]);
    await page.mouse.down();
    for (let i = 1; i < pts.length; i += 1) {
      const n = Math.max(1, Math.round(per / 16));
      const [x0, y0] = pts[i - 1];
      const [x1, y1] = pts[i];
      for (let k = 1; k <= n; k += 1) {
        await page.mouse.move(
          x0 + ((x1 - x0) * k) / n,
          y0 + ((y1 - y0) * k) / n,
        );
        await sleep(per / n);
      }
    }
    return page.mouse.up();
  }
  if ('move' in step) {
    const pts = step.move;
    const per = (step.ms ?? 600) / Math.max(1, pts.length - 1);
    for (const [x, y] of pts) {
      await page.mouse.move(x, y, { steps: 8 });
      await sleep(per);
    }
    return undefined;
  }
  if ('wheel' in step) {
    // The wheel turned over a spot, as a player zooms a view.
    await page.mouse.move(step.at?.[0] ?? 640, step.at?.[1] ?? 360);
    return page.mouse.wheel(0, step.wheel);
  }
  if ('run' in step) return step.run(page, { sleep });
  if ('eval' in step) return page.evaluate(step.eval);
  throw new Error(`unknown step ${JSON.stringify(step)}`);
}

// Plays one recipe in a fresh browser context, recording the page, and returns
// the path of the whole recording and the second at which the loop begins.
async function play(browser, id, recipe) {
  const dir = join(work, id);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const ctx = await browser.newContext({
    viewport: SIZE,
    recordVideo: { dir, size: SIZE },
  });
  const t0 = Date.now();
  const page = await ctx.newPage();
  let start = null;
  try {
    await page.goto(recipe.url, { waitUntil: 'load', timeout: 60000 });
    for (const step of recipe.steps) {
      if ('mark' in step) start = (Date.now() - t0) / 1000 + (step.mark || 0);
      else await doStep(page, step);
    }
    if (start === null)
      throw new Error('the recipe never marks where the loop starts');
    const needed = start + SECONDS;
    const now = (Date.now() - t0) / 1000;
    if (now < needed) await sleep((needed - now) * 1000 + 300);
    await page.screenshot({ path: join(dir, 'last.png') });
  } finally {
    await ctx.close();
  }
  return { video: await page.video().path(), start };
}

// The most a loop may weigh: the hero's is the plan's own budget, the card's
// is a ceiling a little above the measured 200-240 KB. A busy picture that
// goes over is encoded again at a lower quality, so it is never trimmed by hand.
const LIMITS = { [CARD_WIDTH]: 300000, [HERO_WIDTH]: 450000 };
const CRFS = [46, 50, 54, 58, 62];

function encode(src, start, width, crop, dest) {
  for (const crf of CRFS) {
    encodeAt(src, start, width, crop, dest, crf);
    if (statSync(dest).size <= LIMITS[width]) return crf;
  }
  throw new Error(
    `${dest} is over ${LIMITS[width]} bytes even at crf ${CRFS.at(-1)}`,
  );
}

function encodeAt(src, start, width, crop, dest, crf) {
  // A game that does not fill a 16:9 window is cut to the part worth seeing,
  // never stretched: the crop keeps the shape.
  let cut = '';
  if (crop) {
    const [x, y, w, h] = crop;
    if (Math.abs(w * 9 - h * 16) > 16)
      throw new Error(`crop ${crop} is not 16:9`);
    cut = `crop=${w}:${h}:${x}:${y},`;
  }
  execFileSync(
    FFMPEG,
    [
      '-loglevel',
      'error',
      '-y',
      '-ss',
      String(start),
      '-t',
      String(SECONDS),
      '-i',
      src,
      '-an',
      '-vf',
      `${cut}scale=${width}:-2,fps=25`,
      '-c:v',
      'libvpx-vp9',
      '-b:v',
      '0',
      '-crf',
      String(crf),
      '-row-mt',
      '1',
      '-deadline',
      'good',
      dest,
    ],
    { stdio: 'inherit' },
  );
}

async function main() {
  const args = process.argv.slice(2);
  // For trying a recipe: skips the sheet and video, which the whole set makes.
  const noSheet = args.includes('--no-sheet');
  const asked = args.filter((a) => !a.startsWith('--'));
  const ids = asked.length ? asked : Object.keys(recipes);
  for (const id of ids) {
    if (!recipes[id]) throw new Error(`no recipe for "${id}"`);
  }
  mkdirSync(out, { recursive: true });
  const failed = [];
  for (const id of ids) {
    const recipe = recipes[id];
    // A browser a game, so that one game's crash or leak cannot spoil the next.
    const browser = await chromium.launch({ args: BROWSER_ARGS });
    try {
      const { video, start } = await play(browser, id, recipe);
      encode(
        video,
        start,
        CARD_WIDTH,
        recipe.crop,
        join(out, `${id}.card.webm`),
      );
      const heroPath = join(out, `${id}.hero.webm`);
      if (heroes.has(id))
        encode(video, start, HERO_WIDTH, recipe.crop, heroPath);
      else rmSync(heroPath, { force: true });
      const bytes = statSync(join(out, `${id}.card.webm`)).size;
      console.log(`${id}: loop from ${start.toFixed(1)}s, card ${bytes} bytes`);
    } catch (error) {
      failed.push(id);
      console.error(`${id}: FAILED, ${error.message.split('\n')[0]}`);
    } finally {
      await browser.close();
    }
  }
  if (!noSheet) await makeSheet({ out, recipes, ffmpeg: FFMPEG, root });
  if (failed.length) {
    console.error(`failed: ${failed.join(', ')}`);
    process.exitCode = 1;
  }
}

await main();
