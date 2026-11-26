// Holds the inline script that puts a touch screen's playable cards first in a
// row (src/scripts/touch-first-inline.js) equal to the pure rule in
// src/catalogue/fitting.ts's touchFirst, which it says a second time because a
// classic inline script cannot import. The script is run here as the browser
// runs it: as a script whose only inputs are a `document` whose currentScript
// sits after a strip, and a `matchMedia`, both made by the test. Over every row
// of up to seven cards of mixed fits, the order the strip is left in is the
// rule's. It also holds that the script does nothing on a desk, on a phone with
// a mouse (coarse and fine both), with no matchMedia, or where what stands
// before it is not a strip, and that it is static text a policy can hash.
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';
import { touchFirst } from '../../src/catalogue/fitting';

const files = import.meta.glob<string>(
  '../../src/scripts/touch-first-inline.js',
  { query: '?raw', import: 'default', eager: true },
);
const source = Object.values(files)[0] ?? '';
const calls = import.meta.glob<string>(
  '../../src/scripts/touch-first-call.js',
  {
    query: '?raw',
    import: 'default',
    eager: true,
  },
);
const call = Object.values(calls)[0] ?? '';

/** As a page runs them: the function defined once, then a row's call. */
function runBoth(context: Record<string, unknown>): void {
  runInNewContext(source, context);
  runInNewContext(call, context);
}

/** A card as the script sees it: a name and whether it carries data-touch. */
interface FakeCard {
  name: number;
  hasAttribute(name: string): boolean;
}

interface FakeStrip {
  children: FakeCard[];
  matches(selector: string): boolean;
  appendChild(card: FakeCard): FakeCard;
}

function strip(fits: boolean[], selectorMatches = true): FakeStrip {
  const cards: FakeCard[] = fits.map((fit, name) => ({
    name,
    hasAttribute: (attribute) => attribute === 'data-touch' && fit,
  }));
  const made: FakeStrip = {
    children: cards,
    matches: (selector) => selectorMatches && selector === 'ul.strip',
    // As the DOM does: a child appended is moved to the end.
    appendChild: (card) => {
      made.children = [...made.children.filter((each) => each !== card), card];
      return card;
    },
  };
  return made;
}

/** The pointers a device says it has. */
interface Pointers {
  coarse: boolean;
  fine: boolean;
}

const TOUCH: Pointers = { coarse: true, fine: false };

/** Runs the script on a strip and returns the card names in the order left. */
function run(
  fits: boolean[],
  pointers: Pointers | null,
  selectorMatches = true,
): number[] {
  const made = strip(fits, selectorMatches);
  const context: Record<string, unknown> = {
    document: { currentScript: { previousElementSibling: made } },
  };
  if (pointers !== null)
    context.matchMedia = (query: string) => ({
      matches:
        query === '(any-pointer: coarse)'
          ? pointers.coarse
          : query === '(any-pointer: fine)'
            ? pointers.fine
            : false,
    });
  runBoth(context);
  return made.children.map((each) => each.name);
}

/** Every row of `size` cards, as a list of fits. */
function rowsOf(size: number): boolean[][] {
  return Array.from({ length: 2 ** size }, (_, bits) =>
    Array.from({ length: size }, (_, at) => ((bits >> at) & 1) === 1),
  );
}

describe('src/scripts/touch-first-inline.js', () => {
  it('is read, with its call, so that an empty reading is not a pass', () => {
    expect(source.length).toBeGreaterThan(100);
    expect(call.trim()).toBe('flixTouchFirst();');
  });

  it('defines the function and moves nothing until it is called', () => {
    const made = strip([false, true]);
    const context: Record<string, unknown> = {
      document: { currentScript: { previousElementSibling: made } },
      matchMedia: (query: string) => ({ matches: query.includes('coarse') }),
    };
    runInNewContext(source, context);
    expect(typeof context.flixTouchFirst).toBe('function');
    expect(made.children.map((each) => each.name)).toEqual([0, 1]);
  });

  it('leaves each row of up to seven cards in the order touchFirst gives', () => {
    let reached = 0;
    for (let size = 0; size <= 7; size += 1) {
      for (const fits of rowsOf(size)) {
        expect(run(fits, TOUCH), fits.join()).toEqual(touchFirst(fits));
        reached += 1;
      }
    }
    // 2^0 + ... + 2^7 rows.
    expect(reached).toBe(255);
  });

  it('moves something: a row with a card that does not fit before one that does is changed', () => {
    expect(run([false, true, false, true], TOUCH)).toEqual([1, 3, 0, 2]);
  });

  it('keeps the order within each group', () => {
    expect(run([true, false, true, false, true, false], TOUCH)).toEqual([
      0, 2, 4, 1, 3, 5,
    ]);
  });

  it('does nothing on a desk, where a mouse points finely', () => {
    let reached = 0;
    for (const fits of rowsOf(5)) {
      expect(run(fits, { coarse: false, fine: true })).toEqual(
        fits.map((_, at) => at),
      );
      reached += 1;
    }
    expect(reached).toBe(32);
  });

  it('does nothing on a phone with a mouse, which is coarse and fine both', () => {
    expect(run([false, true, false], { coarse: true, fine: true })).toEqual([
      0, 1, 2,
    ]);
  });

  it('does nothing where the device says neither', () => {
    expect(run([false, true], { coarse: false, fine: false })).toEqual([0, 1]);
  });

  it('does nothing where there is no matchMedia', () => {
    expect(run([false, true, false], null)).toEqual([0, 1, 2]);
  });

  it('does nothing where what stands before it is not a strip', () => {
    expect(run([false, true, false], TOUCH, false)).toEqual([0, 1, 2]);
  });

  it('does nothing where there is nothing before it', () => {
    expect(() => {
      runBoth({
        document: { currentScript: { previousElementSibling: null } },
        matchMedia: () => ({ matches: true }),
      });
    }).not.toThrow();
    expect(() => {
      runBoth({
        document: { currentScript: null },
        matchMedia: () => ({ matches: true }),
      });
    }).not.toThrow();
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
      for (const text of [source, call])
        expect(text, String(forbidden)).not.toMatch(forbidden);
  });
});
