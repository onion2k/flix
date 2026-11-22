// Holds the rule that says when a hovered or focused card may grow: not until
// it has been pointed at for the pause, with the time handed in as a number so
// that no clock is read here. It tries the pause to the last millisecond on
// each side and what is not a time. Each case is a figure the rule is meant to
// give. Without it a pause of nothing (so that a pointer only passing over a
// card would start a fetch and a flicker for every card on its way) would be
// seen only by a person with a stopwatch.
import { describe, expect, it } from 'vitest';
import {
  GROW,
  LIFT,
  MARGIN,
  grownWidth,
  PAUSE_MS,
  pauseOver,
  placeGrown,
} from '../../src/catalogue/growing';

describe('the figure', () => {
  it('is the 600ms the plan names', () => {
    expect(PAUSE_MS).toBe(600);
  });
});

describe('pauseOver', () => {
  it('is false before the pause is over, to the last millisecond', () => {
    for (const elapsed of [0, 1, 300, PAUSE_MS - 1])
      expect(pauseOver(elapsed), `${elapsed}`).toBe(false);
  });

  it('is true from the moment the pause ends, and stays true', () => {
    for (const elapsed of [PAUSE_MS, PAUSE_MS + 1, 5000, 1e9])
      expect(pauseOver(elapsed), `${elapsed}`).toBe(true);
  });

  it('is false for a time that is no use: negative, not a number, not finite', () => {
    for (const elapsed of [-1, -1000, Number.NaN, -Infinity])
      expect(pauseOver(elapsed), `${elapsed}`).toBe(false);
  });

  it('is true for a time that is endless, since a card held for ever is held for the pause', () => {
    expect(pauseOver(Infinity)).toBe(true);
  });
});

describe('the figures of the grown card', () => {
  it('are the ones the plan names: one and a half times, a little above', () => {
    expect(GROW).toBe(1.5);
    expect(LIFT).toBeGreaterThan(0);
    expect(MARGIN).toBeGreaterThan(0);
  });
});

describe('grownWidth', () => {
  it('is GROW times the card, and no wider than the window less its margins', () => {
    expect(grownWidth(400, 1440)).toBe(600);
    expect(grownWidth(288, 320)).toBe(320 - 2 * MARGIN);
    expect(grownWidth(288, 2 * MARGIN + 432)).toBe(432);
    expect(grownWidth(288, 2 * MARGIN + 431)).toBe(431);
  });
});

describe('placeGrown', () => {
  const win = { width: 1440, height: 1000 };
  // A card in the middle of a wide window, with plenty of room all round.
  const card = { left: 500, top: 400, width: 400 };

  it('is one and a half times the card wide', () => {
    expect(placeGrown(card, win, 600).width).toBe(600);
    expect(placeGrown({ ...card, width: 387.5 }, win, 600).width).toBe(581.25);
  });

  it('is centred on the card, and a little above its top', () => {
    const found = placeGrown(card, win, 600);
    expect(found.left + found.width / 2).toBe(card.left + card.width / 2);
    expect(found.top).toBe(card.top - LIFT);
  });

  it('is kept MARGIN from the left edge of the window, and the right', () => {
    const left = placeGrown({ ...card, left: 0 }, win, 600);
    expect(left.left).toBe(MARGIN);
    expect(left.width).toBe(600);
    const right = placeGrown({ ...card, left: 1100 }, win, 600);
    expect(right.left + right.width).toBe(win.width - MARGIN);
  });

  it('is centred when it fits to the pixel, and held at the margin one pixel past that', () => {
    // A 600 wide grown card centred on a 400 wide card whose left is at
    // MARGIN + 100 has its own left edge exactly at MARGIN.
    const exact = placeGrown({ ...card, left: MARGIN + 100 }, win, 600);
    expect(exact.left).toBe(MARGIN);
    const past = placeGrown({ ...card, left: MARGIN + 99 }, win, 600);
    expect(past.left).toBe(MARGIN);
    const inside = placeGrown({ ...card, left: MARGIN + 101 }, win, 600);
    expect(inside.left).toBe(MARGIN + 1);
  });

  it('is kept inside the window at the foot, by moving up', () => {
    const found = placeGrown({ ...card, top: 800 }, win, 600);
    expect(found.top + 600).toBe(win.height - MARGIN);
  });

  it('is kept inside the window at the top', () => {
    const found = placeGrown({ ...card, top: 10 }, win, 600);
    expect(found.top).toBe(MARGIN);
  });

  it('starts at the top margin when it is taller than the window', () => {
    expect(placeGrown(card, win, 5000).top).toBe(MARGIN);
  });

  it('is narrowed to the window, less its margins, when one and a half cards will not fit', () => {
    const narrow = { width: 320, height: 800 };
    const found = placeGrown({ left: 16, top: 300, width: 288 }, narrow, 500);
    expect(found.width).toBe(narrow.width - 2 * MARGIN);
    expect(found.left).toBe(MARGIN);
  });

  it('is always inside the window, over a sweep of cards and windows', () => {
    let checked = 0;
    for (const windowWidth of [320, 390, 640, 1024, 1440])
      for (const left of [-50, 0, 16, 300, 700, 1200, 1400])
        for (const top of [-20, 0, 200, 900, 1100]) {
          const found = placeGrown(
            { left, top, width: 288 },
            { width: windowWidth, height: 1000 },
            500,
          );
          checked += 1;
          expect(
            found.left,
            `${windowWidth} ${left} ${top}`,
          ).toBeGreaterThanOrEqual(MARGIN);
          expect(found.left + found.width).toBeLessThanOrEqual(
            windowWidth - MARGIN,
          );
          expect(found.top).toBeGreaterThanOrEqual(MARGIN);
          expect(found.top + 500).toBeLessThanOrEqual(1000 - MARGIN);
        }
    expect(checked).toBe(175);
  });
});
