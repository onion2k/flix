// Holds the rules of moving by arrow keys and a gamepad: where a move lands
// in the grid of links (the feature, then each row), which direction a pad
// holds, and when a held direction fires, with the time handed in as a number
// so that no clock is read here. The rules are pure so that every end, every
// passed-over row and every tie is tried with numbers and not through a
// browser. Each case states what it is given. Without this a move that
// wrapped at a row's end, took the first card where the nearest was meant, or
// repeated at the wrong pace would be found only by a person with a pad.
import { describe, expect, it } from 'vitest';
import {
  FIRST_REPEAT_MS,
  REPEAT_MS,
  STICK_DEAD_ZONE,
  heldDirection,
  moveTo,
  pressedNow,
  repeating,
  type Held,
  type Stop,
} from '../../src/catalogue/moving';

/** A row of stops whose centres are given; ids are the row letter and place. */
const row = (name: string, ...centres: number[]): Stop[] =>
  centres.map((centre, at) => ({ id: `${name}${at}`, centre }));

// The feature is a row of one; the third row has no linked card at all.
const grid = [
  row('f', 300),
  row('a', 100, 400, 700, 1000),
  row('b', 120, 330, 560),
  [],
  row('c', 50, 900),
  [],
];

describe('moveTo, along a row', () => {
  it('goes right to the next stop and left to the previous', () => {
    expect(moveTo(grid, 'a1', 'right')).toBe('a2');
    expect(moveTo(grid, 'a1', 'left')).toBe('a0');
  });

  it('moves nothing at either end of a row, and does not wrap', () => {
    expect(moveTo(grid, 'a3', 'right')).toBeNull();
    expect(moveTo(grid, 'a0', 'left')).toBeNull();
  });

  it('moves nothing sideways in the feature, a row of one', () => {
    expect(moveTo(grid, 'f0', 'right')).toBeNull();
    expect(moveTo(grid, 'f0', 'left')).toBeNull();
  });

  it('takes first and last to the ends of the row', () => {
    expect(moveTo(grid, 'a2', 'first')).toBe('a0');
    expect(moveTo(grid, 'a1', 'last')).toBe('a3');
  });

  it('answers first and last with the stop itself when it is the end', () => {
    expect(moveTo(grid, 'a0', 'first')).toBe('a0');
    expect(moveTo(grid, 'a3', 'last')).toBe('a3');
  });
});

describe('moveTo, between rows', () => {
  it('goes down to the stop whose centre is nearest, not the first', () => {
    expect(moveTo(grid, 'a3', 'down')).toBe('b2');
    expect(moveTo(grid, 'a1', 'down')).toBe('b1');
    expect(moveTo(grid, 'a0', 'down')).toBe('b0');
  });

  it('goes up to the nearest too', () => {
    expect(moveTo(grid, 'b2', 'up')).toBe('a2');
    expect(moveTo(grid, 'b0', 'up')).toBe('a0');
  });

  it('passes over a row with no stops, down and up', () => {
    expect(moveTo(grid, 'b1', 'down')).toBe('c0');
    expect(moveTo(grid, 'c1', 'up')).toBe('b2');
  });

  it('goes from the first row up to the feature, and from it down', () => {
    expect(moveTo(grid, 'a1', 'up')).toBe('f0');
    expect(moveTo(grid, 'f0', 'down')).toBe('a1');
  });

  it('moves nothing up from the feature, nor down from the last row with a stop', () => {
    expect(moveTo(grid, 'f0', 'up')).toBeNull();
    expect(moveTo(grid, 'c0', 'down')).toBeNull();
    expect(moveTo(grid, 'c1', 'down')).toBeNull();
  });

  it('breaks a tie in favour of the earlier stop', () => {
    const tied = [row('p', 200), row('q', 100, 300)];
    expect(moveTo(tied, 'p0', 'down')).toBe('q0');
  });

  it('measures from the centre as it is now, so a scrolled row changes the answer', () => {
    const scrolled = [row('p', 100), row('q', -500, -100, 400)];
    expect(moveTo(scrolled, 'p0', 'down')).toBe('q1');
  });
});

describe('moveTo, what is not a stop', () => {
  it('moves nothing from an id that is in no row', () => {
    for (const direction of [
      'left',
      'right',
      'up',
      'down',
      'first',
      'last',
    ] as const) {
      expect(moveTo(grid, 'nowhere', direction)).toBeNull();
    }
  });

  it('moves nothing from an empty grid', () => {
    expect(moveTo([], 'a0', 'right')).toBeNull();
  });
});

describe('heldDirection', () => {
  const buttons = (...pressed: number[]) =>
    Array.from({ length: 17 }, (_, at) => pressed.includes(at));

  it('reads the d-pad: 12 up, 13 down, 14 left, 15 right', () => {
    expect(heldDirection(buttons(12), [0, 0])).toBe('up');
    expect(heldDirection(buttons(13), [0, 0])).toBe('down');
    expect(heldDirection(buttons(14), [0, 0])).toBe('left');
    expect(heldDirection(buttons(15), [0, 0])).toBe('right');
  });

  it('reads the left stick past the dead zone, on axis 0 sideways and 1 up and down', () => {
    expect(heldDirection(buttons(), [0.9, 0])).toBe('right');
    expect(heldDirection(buttons(), [-0.9, 0])).toBe('left');
    expect(heldDirection(buttons(), [0, 0.9])).toBe('down');
    expect(heldDirection(buttons(), [0, -0.9])).toBe('up');
  });

  it('holds nothing at the dead zone itself or under it', () => {
    expect(heldDirection(buttons(), [STICK_DEAD_ZONE, 0])).toBeNull();
    expect(heldDirection(buttons(), [0, -STICK_DEAD_ZONE])).toBeNull();
    expect(heldDirection(buttons(), [0.3, 0.3])).toBeNull();
  });

  it('lets the stronger axis win, and a tie go sideways', () => {
    expect(heldDirection(buttons(), [0.6, -0.9])).toBe('up');
    expect(heldDirection(buttons(), [0.9, 0.6])).toBe('right');
    expect(heldDirection(buttons(), [0.8, 0.8])).toBe('right');
  });

  it('prefers the d-pad to the stick', () => {
    expect(heldDirection(buttons(14), [0.9, 0])).toBe('left');
  });

  it('takes opposite d-pad buttons as none, and falls to nothing, not the stick', () => {
    expect(heldDirection(buttons(14, 15), [0, 0])).toBeNull();
    expect(heldDirection(buttons(12, 13), [0, 0])).toBeNull();
  });

  it('holds nothing when nothing is pressed, and survives a pad with too few axes', () => {
    expect(heldDirection(buttons(), [0, 0])).toBeNull();
    expect(heldDirection([], [])).toBeNull();
  });
});

describe('repeating', () => {
  /** Runs frames at the given times, returning each one's firing. */
  function run(frames: [time: number, held: Held][]) {
    let state = repeating(null, null, 0).state;
    return frames.map(([time, held]) => {
      const step = repeating(state, held, time);
      state = step.state;
      return step.fire;
    });
  }

  it('fires at once on a new direction', () => {
    expect(run([[1000, 'right']])).toEqual(['right']);
  });

  it('does not fire again until the first delay has passed', () => {
    const fired = run([
      [1000, 'right'],
      [1000 + FIRST_REPEAT_MS - 1, 'right'],
      [1000 + FIRST_REPEAT_MS, 'right'],
    ]);
    expect(fired).toEqual(['right', null, 'right']);
  });

  it('then fires every repeat interval, and not before', () => {
    const start = 1000;
    const at = start + FIRST_REPEAT_MS;
    const fired = run([
      [start, 'down'],
      [at, 'down'],
      [at + REPEAT_MS - 1, 'down'],
      [at + REPEAT_MS, 'down'],
      [at + REPEAT_MS + 1, 'down'],
      [at + 2 * REPEAT_MS, 'down'],
    ]);
    expect(fired).toEqual(['down', 'down', null, 'down', null, 'down']);
  });

  it('begins afresh when the direction changes', () => {
    const fired = run([
      [0, 'right'],
      [10, 'left'],
      [20, 'left'],
    ]);
    expect(fired).toEqual(['right', 'left', null]);
  });

  it('begins afresh when the direction is let go and pressed again', () => {
    const fired = run([
      [0, 'right'],
      [16, null],
      [32, 'right'],
      [48, 'right'],
    ]);
    expect(fired).toEqual(['right', null, 'right', null]);
  });

  it('fires nothing while nothing is held', () => {
    expect(
      run([
        [0, null],
        [16, null],
      ]),
    ).toEqual([null, null]);
  });

  it('names its delays as the plan says: 400ms, then 150ms', () => {
    expect(FIRST_REPEAT_MS).toBe(400);
    expect(REPEAT_MS).toBe(150);
  });
});

describe('pressedNow', () => {
  it('is true only on the frame a button goes down', () => {
    expect(pressedNow(false, true)).toBe(true);
    expect(pressedNow(true, true)).toBe(false);
    expect(pressedNow(true, false)).toBe(false);
    expect(pressedNow(false, false)).toBe(false);
  });
});
