// Holds the words a card says of what its site needs, the rule that a site
// fits touch only if it needs nothing, and the order that puts the sites a
// phone can play first. The partition is held to being stable by cases whose
// groups are each longer than one, so that a reversal or a sort of either
// group would be seen; and every case counts what it reached.
import { describe, expect, it } from 'vitest';
import {
  NEEDS,
  fitsTouch,
  needsWords,
  touchFirst,
} from '../../src/catalogue/fitting';
import type { Need } from '../../src/catalogue/fitting';

describe('NEEDS', () => {
  it('names the three, in the order the words say them', () => {
    expect([...NEEDS]).toEqual(['keyboard', 'mouse', 'gamepad']);
  });
});

describe('fitsTouch', () => {
  it('is true for an empty list and false for any need', () => {
    expect(fitsTouch([])).toBe(true);
    for (const need of NEEDS) expect(fitsTouch([need]), need).toBe(false);
    expect(fitsTouch(['keyboard', 'mouse'])).toBe(false);
    expect(fitsTouch([...NEEDS])).toBe(false);
  });
});

describe('needsWords', () => {
  it('says an empty list plays on a phone or a computer', () => {
    expect(needsWords([])).toBe('Plays on a phone or a computer.');
  });

  it('says each single need', () => {
    expect(needsWords(['keyboard'])).toBe('Needs a keyboard.');
    expect(needsWords(['mouse'])).toBe('Needs a mouse.');
    expect(needsWords(['gamepad'])).toBe('Needs a gamepad.');
  });

  it('says two with "and", and three with a comma and "and"', () => {
    expect(needsWords(['keyboard', 'mouse'])).toBe(
      'Needs a keyboard and a mouse.',
    );
    expect(needsWords(['keyboard', 'gamepad'])).toBe(
      'Needs a keyboard and a gamepad.',
    );
    expect(needsWords(['mouse', 'gamepad'])).toBe(
      'Needs a mouse and a gamepad.',
    );
    expect(needsWords(['keyboard', 'mouse', 'gamepad'])).toBe(
      'Needs a keyboard, a mouse and a gamepad.',
    );
  });

  it('says them in NEEDS order whatever order the list was written in', () => {
    const swapped: Need[][] = [
      ['mouse', 'keyboard'],
      ['gamepad', 'keyboard'],
      ['gamepad', 'mouse'],
      ['gamepad', 'mouse', 'keyboard'],
      ['mouse', 'gamepad', 'keyboard'],
    ];
    for (const list of swapped) {
      const sorted = NEEDS.filter((need) => list.includes(need));
      expect(needsWords(list), list.join()).toBe(needsWords(sorted));
    }
    expect(swapped.length).toBe(5);
    expect(needsWords(['gamepad', 'mouse', 'keyboard'])).toBe(
      'Needs a keyboard, a mouse and a gamepad.',
    );
  });
});

describe('touchFirst', () => {
  it('is empty for an empty row', () => {
    expect(touchFirst([])).toEqual([]);
  });

  it('keeps the order when all fit and when none does', () => {
    expect(touchFirst([true, true, true])).toEqual([0, 1, 2]);
    expect(touchFirst([false, false, false])).toEqual([0, 1, 2]);
  });

  it('puts those that fit first, each group keeping its own order', () => {
    expect(touchFirst([false, true, false, true, true, false])).toEqual([
      1, 3, 4, 0, 2, 5,
    ]);
    expect(touchFirst([false, false, true])).toEqual([2, 0, 1]);
    expect(touchFirst([true, false, true])).toEqual([0, 2, 1]);
  });

  it('is a permutation of the indices, over every row of up to six', () => {
    let rows = 0;
    for (let size = 0; size <= 6; size++) {
      for (let bits = 0; bits < 1 << size; bits++) {
        const fits = Array.from(
          { length: size },
          (_, i) => (bits >> i) & 1,
        ).map(Boolean);
        const order = touchFirst(fits);
        rows++;
        expect([...order].sort((a, b) => a - b)).toEqual(fits.map((_, i) => i));
        const split = fits.filter(Boolean).length;
        // Each group ascends, which is stability, and the groups are in place.
        const head = order.slice(0, split);
        const tail = order.slice(split);
        expect(head.every((i) => fits[i])).toBe(true);
        expect(tail.every((i) => !fits[i])).toBe(true);
        expect(head).toEqual([...head].sort((a, b) => a - b));
        expect(tail).toEqual([...tail].sort((a, b) => a - b));
      }
    }
    expect(rows).toBe(127);
  });
});
