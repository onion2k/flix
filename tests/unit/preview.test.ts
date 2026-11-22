// Holds the rule that says which of a card's previews shows, from how long the
// card has been hovered or focused, with the time handed in as a number so that
// no clock is read here. It tries the pause, each preview's second in order,
// the rest after the last, and the length of a whole pass for every count a
// card may have against WCAG 2.2.2's five seconds. Each case is a figure the
// rule is meant to give. Without it a pause of nothing, a pass that never
// ended or one that ran over five seconds would be seen only by a person
// waiting with a stopwatch.
import { describe, expect, it } from 'vitest';
import {
  EACH_MS,
  MAX_PREVIEWS,
  PAUSE_MS,
  passLength,
  previewAt,
} from '../../src/catalogue/preview';

describe('the figures', () => {
  it('are the ones the plan names', () => {
    expect(PAUSE_MS).toBe(600);
    expect(EACH_MS).toBe(1000);
    expect(MAX_PREVIEWS).toBe(4);
  });
});

describe('previewAt, the pause', () => {
  it('shows nothing before the pause is over, to the last millisecond', () => {
    for (const elapsed of [0, 1, 300, PAUSE_MS - 1])
      expect(previewAt(elapsed, 3)).toBeNull();
  });

  it('shows the first preview from the moment the pause ends', () => {
    expect(previewAt(PAUSE_MS, 3)).toBe(0);
    expect(previewAt(PAUSE_MS + 1, 3)).toBe(0);
  });
});

describe('previewAt, each in turn', () => {
  it('shows each preview for its second, in order, and the next at the edge', () => {
    for (const count of [1, 2, 3, 4]) {
      for (let at = 0; at < count; at += 1) {
        const from = PAUSE_MS + at * EACH_MS;
        expect(previewAt(from, count), `${count}: from`).toBe(at);
        expect(previewAt(from + EACH_MS / 2, count), `${count}: mid`).toBe(at);
        if (at < count - 1)
          expect(
            previewAt(from + EACH_MS - 1, count),
            `${count}: last ms`,
          ).toBe(at);
      }
    }
  });

  it('gives nothing from the end of the last, however long it goes on', () => {
    for (const count of [1, 2, 3, 4]) {
      const end = PAUSE_MS + count * EACH_MS;
      expect(previewAt(end - 1, count)).toBe(count - 1);
      for (const elapsed of [end, end + 1, end + 10_000, 1e9, Infinity])
        expect(previewAt(elapsed, count), `${count} at ${elapsed}`).toBeNull();
    }
  });

  it('does not come back round for a pass that has ended', () => {
    // A rule that took the time modulo the pass would show the first again.
    expect(previewAt(PAUSE_MS + 3 * EACH_MS + PAUSE_MS, 3)).toBeNull();
  });
});

describe('passLength', () => {
  it('is the pause and each preview, and under five seconds for 1 to 4', () => {
    for (const count of [1, 2, 3, 4]) {
      expect(passLength(count)).toBe(PAUSE_MS + count * EACH_MS);
      expect(passLength(count), `${count}`).toBeLessThan(5000);
    }
    expect(passLength(4)).toBe(4600);
  });

  it('is the moment previewAt gives nothing for good', () => {
    for (const count of [1, 2, 3, 4]) {
      expect(previewAt(passLength(count) - 1, count)).toBe(count - 1);
      expect(previewAt(passLength(count), count)).toBeNull();
    }
  });

  it('is nothing for a count that cannot play', () => {
    for (const count of [0, -1, 1.5, NaN, 5, 100])
      expect(passLength(count), `${count}`).toBe(0);
  });
});

describe('previewAt, what is not a pass', () => {
  it('gives nothing for a count of none', () => {
    for (const elapsed of [0, PAUSE_MS, 1000, 5000])
      expect(previewAt(elapsed, 0)).toBeNull();
  });

  it('gives nothing for a count past the most, which would pass five seconds', () => {
    expect(previewAt(PAUSE_MS, 5)).toBeNull();
    expect(previewAt(PAUSE_MS + EACH_MS, 100)).toBeNull();
  });

  it('gives nothing for a count that is not a whole number', () => {
    for (const count of [-1, 1.5, NaN, Infinity])
      expect(previewAt(PAUSE_MS, count), `${count}`).toBeNull();
  });

  it('gives nothing for a negative time or one that is not a number', () => {
    for (const elapsed of [-1, -600, -Infinity, NaN])
      expect(previewAt(elapsed, 3), `${elapsed}`).toBeNull();
  });
});
