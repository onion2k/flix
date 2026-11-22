// Holds the page's weight: what the built home page asks for, without
// scrolling, at a desk's width (1440x1000) and a phone's (390x844), counted
// by kind (document, script, stylesheet, font, picture, and the hero's loop as
// media) in requests and in
// bytes, with the text kinds also gzipped since the preview does not compress.
// The figures are held to gates/weight.json both ways: a count must be equal,
// bytes equal to within TOLERANCE, and a drop fails as surely as a rise so
// that it is looked at and written again on purpose (npm run weight:update).
// The budgets in that file are agreed figures, set by the owner; a
// measurement over one fails this gate and neither is moved here. Without it
// a picture made eager, a font weight added or a script grown would cost the
// visitor and no other check would say. The judgement is in judging.ts, with
// unit tests of its own; this file only measures.
//
// This is a Playwright spec and not a script that starts its own server, so
// that it shares the test server and the project's one way of opening the
// built site. It waits on the network going quiet, a state, never a timeout.
import { expect, type Page } from '@playwright/test';
import { dayAt, holdClock, noonOf, test } from '../clock';
import { candidatesOf, readRows } from '../e2e/catalogue';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import {
  KINDS,
  TEXT_KINDS,
  judge,
  overBudget,
  type Budgets,
  type Kind,
  type Weight,
} from './judging';

const FILE = resolve(import.meta.dirname, '../../gates/weight.json');

/**
 * Two builds from the same commit were measured, and every count and byte
 * was the same, so bytes are held exactly (see gates/weight.json's note). A
 * change in the build tool or in a font the provider serves would move them,
 * and is meant to be seen.
 */
const TOLERANCE = 0;

/**
 * What is measured: a desk's width on each day that gives a different feature
 * (the first is the page's day 0, whose figures have always been held as
 * "1440x1000"), and a phone's on day 0. The day changes the feature's still
 * and its loop, so each day's weight is its own: the owner's budgets are held
 * to every one. What is not measured: a phone's width on the other days, a
 * reader who scrolls (the loop is the hero's alone and is asked for once),
 * reduced motion or Save-Data (which ask for none), and anything after the
 * network has gone quiet.
 */
const PLACES = candidatesOf(readRows()).length;
const VIEWPORTS = [
  { name: '1440x1000', width: 1440, height: 1000, place: 0 },
  ...Array.from({ length: PLACES - 1 }, (_, at) => ({
    name: `1440x1000 day ${at + 1}`,
    width: 1440,
    height: 1000,
    place: at + 1,
  })),
  { name: '390x844', width: 390, height: 844, place: 0 },
];

interface BaselineFile {
  note: string;
  budgets: Budgets & { status: string };
  measured: Record<string, Weight>;
}

function empty(): Weight {
  return Object.fromEntries(
    KINDS.map((kind) => [
      kind,
      TEXT_KINDS.includes(kind)
        ? { count: 0, bytes: 0, gzip: 0 }
        : { count: 0, bytes: 0 },
    ]),
  ) as Weight;
}

async function measure(
  page: Page,
  width: number,
  height: number,
): Promise<Weight> {
  const weight = empty();
  const reads: Promise<void>[] = [];
  page.on('response', (response) => {
    const type = response.request().resourceType();
    const kind: Kind = (KINDS as readonly string[]).includes(type)
      ? (type as Kind)
      : 'other';
    reads.push(
      response.body().then((body) => {
        const figures = weight[kind];
        figures.count += 1;
        figures.bytes += body.length;
        if (figures.gzip !== undefined) figures.gzip += gzipSync(body).length;
      }),
    );
  });
  await page.setViewportSize({ width, height });
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await Promise.all(reads);
  return weight;
}

test('the page weight is the baseline, within the budgets', async ({
  browser,
}) => {
  const baseline = JSON.parse(readFileSync(FILE, 'utf8')) as BaselineFile;
  const measured: Record<string, Weight> = {};
  for (const { name, width, height, place } of VIEWPORTS) {
    const context = await browser.newContext();
    await holdClock(
      context,
      place === 0 ? undefined : noonOf(dayAt(place, PLACES)),
    );
    measured[name] = await measure(await context.newPage(), width, height);
    await context.close();
    expect(measured[name]?.document.count, `${name} documents`).toBe(1);
  }

  if (process.env['WEIGHT_UPDATE'] === '1') {
    writeFileSync(
      FILE,
      `${JSON.stringify({ ...baseline, measured }, null, 2)}\n`,
    );
    return;
  }

  const found: string[] = [];
  for (const { name } of VIEWPORTS) {
    const was = baseline.measured[name];
    const now = measured[name];
    if (was === undefined || now === undefined) {
      found.push(`${name} has no baseline: run npm run weight:update`);
      continue;
    }
    found.push(...judge(was, now, TOLERANCE).map((line) => `${name}: ${line}`));
  }
  for (const { name, width } of VIEWPORTS) {
    const weight = measured[name];
    if (weight !== undefined)
      found.push(
        ...overBudget(
          weight,
          baseline.budgets,
          width > 800 ? 'desk' : 'phone',
        ).map((line) => `${name}: ${line}`),
      );
  }
  expect(found, 'weight against baseline and budget').toEqual([]);
});
