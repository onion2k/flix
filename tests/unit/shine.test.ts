// Holds the rule for the best cards' shine, which is the catalogue's and not
// the page's: under a mouse, the sheen's place is where the pointer is in the
// card's box (0 to 1 each way) and the card tilts toward it, the corner pointed
// at pressed away, never more than MOST_TILT degrees either way; for a reader
// with no pointer on the card, the sheen's place is where the card's middle is
// in the window, and there is no tilt. A pointer outside the box, a box of no
// size, a window of no size and a number that is not one all give the resting
// place, which is the stylesheet's (null here), and no tilt. Each table is
// counted, so that an empty one cannot pass. Without this a pointer off the
// card could tilt it past any bound, or a card scrolled out of the window send
// its sheen off the picture.
import { describe, expect, it } from 'vitest';
import {
  MOST_TILT,
  inWindow,
  underPointer,
  type Box,
} from '../../src/catalogue/shine';

/** A card 400 by 300 with its top left at (100, 200). */
const box: Box = { left: 100, top: 200, right: 500, bottom: 500 };

/** The place in the box at fractions of its width and height. */
function at(x: number, y: number) {
  return { x: 100 + 400 * x, y: 200 + 300 * y };
}

describe('MOST_TILT', () => {
  it('is a small, real angle: enough to be seen, not enough to hide the picture', () => {
    expect(MOST_TILT).toBeGreaterThan(0);
    expect(MOST_TILT).toBeLessThanOrEqual(12);
  });
});

describe('underPointer', () => {
  const cases: [number, number][] = [
    [0, 0],
    [1, 0],
    [0, 1],
    [1, 1],
    [0.5, 0.5],
    [0.25, 0.75],
    [0.9, 0.1],
  ];

  for (const [x, y] of cases)
    it(`puts the sheen at (${x}, ${y}) for a pointer there, and tilts toward it`, () => {
      const shine = underPointer(at(x, y), box);
      expect(shine).not.toBeNull();
      expect(shine?.x).toBeCloseTo(x, 10);
      expect(shine?.y).toBeCloseTo(y, 10);
      // The right side pointed at turns away (rotateY positive), and the
      // bottom pointed at turns away (rotateX negative).
      expect(shine?.tiltY).toBeCloseTo((x - 0.5) * 2 * MOST_TILT, 10);
      expect(shine?.tiltX).toBeCloseTo(-(y - 0.5) * 2 * MOST_TILT, 10);
    });

  it('reached every case, so that an empty table is not a pass', () => {
    expect(cases.length).toBe(7);
  });

  it('tilts no further than MOST_TILT either way, at any place in the box', () => {
    let reached = 0;
    for (let x = 0; x <= 1; x += 0.05)
      for (let y = 0; y <= 1; y += 0.05) {
        const shine = underPointer(at(x, y), box);
        if (shine === null) continue;
        expect(Math.abs(shine.tiltX)).toBeLessThanOrEqual(MOST_TILT);
        expect(Math.abs(shine.tiltY)).toBeLessThanOrEqual(MOST_TILT);
        for (const place of [shine.x, shine.y]) {
          expect(place).toBeGreaterThanOrEqual(0);
          expect(place).toBeLessThanOrEqual(1);
        }
        reached += 1;
      }
    expect(reached).toBeGreaterThan(300);
  });

  it('has no tilt at the middle', () => {
    const shine = underPointer(at(0.5, 0.5), box);
    expect(Math.abs(shine?.tiltX ?? 1)).toBe(0);
    expect(Math.abs(shine?.tiltY ?? 1)).toBe(0);
  });

  for (const [name, pointer] of [
    ['left of the box', { x: 99, y: 300 }],
    ['right of it', { x: 501, y: 300 }],
    ['above it', { x: 300, y: 199 }],
    ['below it', { x: 300, y: 501 }],
    ['far off', { x: -5000, y: 9000 }],
  ] as const)
    it(`gives the resting place for a pointer ${name}`, () => {
      expect(underPointer(pointer, box)).toBeNull();
    });

  for (const [name, bad] of [
    ['no width', { left: 100, top: 200, right: 100, bottom: 500 }],
    ['no height', { left: 100, top: 200, right: 500, bottom: 200 }],
    ['a negative width', { left: 500, top: 200, right: 100, bottom: 500 }],
    ['a NaN edge', { left: NaN, top: 200, right: 500, bottom: 500 }],
    ['an infinite edge', { left: 100, top: 200, right: Infinity, bottom: 500 }],
  ] as const)
    it(`gives the resting place for a box with ${name}`, () => {
      expect(underPointer(at(0.5, 0.5), bad)).toBeNull();
    });

  for (const [name, pointer] of [
    ['a NaN x', { x: NaN, y: 300 }],
    ['a NaN y', { x: 300, y: NaN }],
    ['an infinite x', { x: Infinity, y: 300 }],
  ] as const)
    it(`gives the resting place for a pointer with ${name}`, () => {
      expect(underPointer(pointer, box)).toBeNull();
    });
});

describe('inWindow', () => {
  const window_ = { width: 1000, height: 800 };

  /** A card 200 by 100 with its middle at (x, y). */
  function middleAt(x: number, y: number): Box {
    return { left: x - 100, top: y - 50, right: x + 100, bottom: y + 50 };
  }

  const cases: [number, number, number, number][] = [
    [500, 400, 0.5, 0.5],
    [0, 0, 0, 0],
    [1000, 800, 1, 1],
    [250, 600, 0.25, 0.75],
    [900, 80, 0.9, 0.1],
  ];

  for (const [x, y, wantX, wantY] of cases)
    it(`puts the sheen at (${wantX}, ${wantY}) for a card whose middle is at (${x}, ${y}), with no tilt`, () => {
      const shine = inWindow(middleAt(x, y), window_);
      expect(shine?.x).toBeCloseTo(wantX, 10);
      expect(shine?.y).toBeCloseTo(wantY, 10);
      expect(Math.abs(shine?.tiltX ?? 1)).toBe(0);
      expect(Math.abs(shine?.tiltY ?? 1)).toBe(0);
    });

  it('reached every case, so that an empty table is not a pass', () => {
    expect(cases.length).toBe(5);
  });

  it('moves the sheen sideways as the card moves sideways, and down as it moves down', () => {
    const left = inWindow(middleAt(200, 400), window_);
    const right = inWindow(middleAt(700, 400), window_);
    const high = inWindow(middleAt(500, 100), window_);
    const low = inWindow(middleAt(500, 700), window_);
    expect(right?.x ?? 0).toBeGreaterThan(left?.x ?? 1);
    expect(right?.y).toBeCloseTo(left?.y ?? -1, 10);
    expect(low?.y ?? 0).toBeGreaterThan(high?.y ?? 1);
    expect(low?.x).toBeCloseTo(high?.x ?? -1, 10);
  });

  it('holds the place inside 0 to 1 for a card partly or wholly out of the window', () => {
    for (const [x, y] of [
      [-300, 400],
      [1300, 400],
      [500, -500],
      [500, 2000],
    ] as const) {
      const shine = inWindow(middleAt(x, y), window_);
      expect(shine).not.toBeNull();
      for (const place of [shine?.x ?? -1, shine?.y ?? -1]) {
        expect(place).toBeGreaterThanOrEqual(0);
        expect(place).toBeLessThanOrEqual(1);
      }
    }
  });

  it('gives the resting place for a card of no size, a window of no size and a number that is not one', () => {
    expect(
      inWindow({ left: 10, top: 10, right: 10, bottom: 60 }, window_),
    ).toBeNull();
    expect(inWindow(middleAt(500, 400), { width: 0, height: 800 })).toBeNull();
    expect(inWindow(middleAt(500, 400), { width: 1000, height: 0 })).toBeNull();
    expect(
      inWindow({ left: NaN, top: 10, right: 60, bottom: 60 }, window_),
    ).toBeNull();
    expect(
      inWindow(middleAt(500, 400), { width: NaN, height: 800 }),
    ).toBeNull();
  });
});
