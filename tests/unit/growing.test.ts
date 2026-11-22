// Holds the rule that says when a hovered or focused card may grow: not until
// it has been pointed at for the pause, with the time handed in as a number so
// that no clock is read here. It tries the pause to the last millisecond on
// each side and what is not a time. Each case is a figure the rule is meant to
// give. Without it a pause of nothing (so that a pointer only passing over a
// card would start a fetch and a flicker for every card on its way) would be
// seen only by a person with a stopwatch.
import { describe, expect, it } from 'vitest';
import { PAUSE_MS, pauseOver } from '../../src/catalogue/growing';

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
