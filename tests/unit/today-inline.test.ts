// Holds the inline script that picks the day's feature before the page is first
// drawn (src/scripts/today-inline.js) equal to the pure rule in
// src/catalogue/today.ts, which it says a second time because a classic inline
// script cannot import. The script is run here as the browser runs it: as the
// body of a function whose only inputs are a `document` the test makes and a
// `Date` whose clock the test sets. Over many days, times of day and counts,
// the section it leaves shown is the one the rule gives. It also holds the
// script to what the content policy and the page need of it: static text
// (nothing built from a string, nothing imported), read count from the page,
// and the first candidate left shown where the clock is not a number.
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';
import { featureIndex } from '../../src/catalogue/today';

const files = import.meta.glob<string>('../../src/scripts/today-inline.js', {
  query: '?raw',
  import: 'default',
  eager: true,
});
const source = Object.values(files)[0] ?? '';

const DAY = 86_400_000;

/** A section as the script sees it: attributes and the hidden flag only. */
interface FakeSection {
  hidden: boolean;
  attributes: Map<string, string>;
  getAttribute(name: string): string | null;
  setAttribute(name: string, value: string): void;
  removeAttribute(name: string): void;
  querySelector(selector: string): null;
  querySelectorAll(selector: string): never[];
}

function section(startsHidden: boolean): FakeSection {
  const attributes = new Map<string, string>();
  return {
    hidden: startsHidden,
    attributes,
    getAttribute: (name) => attributes.get(name) ?? null,
    setAttribute: (name, value) => void attributes.set(name, value),
    removeAttribute: (name) => void attributes.delete(name),
    querySelector: () => null,
    querySelectorAll: () => [],
  };
}

/** Runs the script on a page of `count` sections at a clock's reading. */
function run(count: number, reading: number): number[] {
  const sections = Array.from({ length: count }, (_, at) => section(at > 0));
  const document = {
    querySelectorAll: (selector: string) =>
      selector === 'section.feature[data-place]' ? sections : [],
  };
  const clock = { now: () => reading };
  runInNewContext(source, { document, Date: clock });
  return sections.flatMap((each, at) => (each.hidden ? [] : [at]));
}

describe('src/scripts/today-inline.js', () => {
  it('is read, so that an empty reading is not a pass', () => {
    expect(source.length).toBeGreaterThan(100);
  });

  it('shows the one section the pure rule gives, over 40000 readings', () => {
    let reached = 0;
    for (const count of [1, 2, 3, 4, 5, 7, 11]) {
      for (let day = -40; day < 700; day += 1) {
        for (const within of [0, 1, DAY / 2, DAY - 1]) {
          const reading = day * DAY + within;
          expect(run(count, reading), `${count} at ${reading}`).toEqual([
            featureIndex(count, reading),
          ]);
          reached += 1;
        }
      }
    }
    expect(reached).toBeGreaterThan(20_000);
  });

  it('agrees on readings that are far from 1970 and not on a whole day', () => {
    for (let at = 0; at < 3000; at += 1) {
      const reading = 1_700_000_000_000 + at * 7_919_113;
      expect(run(4, reading)).toEqual([featureIndex(4, reading)]);
    }
  });

  it('leaves the first shown where the clock is not a number', () => {
    for (const reading of [Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(run(4, reading), String(reading)).toEqual([0]);
    }
  });

  it('does nothing on a page with no candidate', () => {
    expect(run(0, 5 * DAY)).toEqual([]);
  });

  it('is static text a policy can hash: nothing imported, nothing built from a string', () => {
    for (const forbidden of [
      /\bimport\b/,
      /\bexport\b/,
      /\beval\b/,
      /new Function/,
      /\binnerHTML\b/,
      /`/,
      /\$\{/,
    ])
      expect(source, String(forbidden)).not.toMatch(forbidden);
  });
});
