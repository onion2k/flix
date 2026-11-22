// Says where a move by arrow key or gamepad lands in the grid of links (the
// feature's, then each row's), which direction a pad is holding, and when a
// held direction fires, with the time handed in as a number. It is numbers
// and names in and out, with no page, no clock and no navigator in it, so that
// every row end, every passed-over row, every tie and every delay is tried in
// a unit test. Without it the rules would live in the script that reads the
// page and the pad, and a move that wrapped at a row's end, took the first
// card where the nearest was meant, or repeated at the wrong pace would be
// found only by a person with a keyboard or a controller in their hands.

/** A link that can take focus: its name, and where its centre is sideways. */
export interface Stop {
  id: string;
  /** The centre, in pixels from the window's left edge, as the reader sees it. */
  centre: number;
}

/** What a key or a pad can ask for. */
export type Move = 'left' | 'right' | 'up' | 'down' | 'first' | 'last';

/** What a pad can hold: the four ways, or nothing. */
export type Held = 'left' | 'right' | 'up' | 'down' | null;

/**
 * Where a move from `from` lands: the id of a stop, or null where nothing
 * moves. `rows` is the grid from the top, the feature first as a row of one,
 * each row holding only its linked cards, so that a row with none is an empty
 * list and is passed over. Left and right stop at a row's ends and do not
 * wrap, since a wrap would make the end of a row impossible to find by
 * feel. Up and down take the stop whose centre is nearest sideways to the
 * one moved from, and the earlier one on a tie, so that the result does not
 * depend on the order a browser lists equals.
 */
export function moveTo(
  rows: readonly (readonly Stop[])[],
  from: string,
  move: Move,
): string | null {
  const at = rows.findIndex((row) => row.some((stop) => stop.id === from));
  const row = rows[at];
  if (row === undefined) return null;
  const place = row.findIndex((stop) => stop.id === from);
  const here = row[place];
  if (here === undefined) return null;

  switch (move) {
    case 'left':
      return row[place - 1]?.id ?? null;
    case 'right':
      return row[place + 1]?.id ?? null;
    case 'first':
      return row[0]?.id ?? null;
    case 'last':
      return row[row.length - 1]?.id ?? null;
    case 'up':
    case 'down': {
      const step = move === 'up' ? -1 : 1;
      for (
        let next = at + step;
        next >= 0 && next < rows.length;
        next += step
      ) {
        const nearest = nearestTo(rows[next] ?? [], here.centre);
        if (nearest !== null) return nearest;
      }
      return null;
    }
  }
}

function nearestTo(row: readonly Stop[], centre: number): string | null {
  let best: Stop | undefined;
  for (const stop of row) {
    if (
      best === undefined ||
      Math.abs(stop.centre - centre) < Math.abs(best.centre - centre)
    )
      best = stop;
  }
  return best?.id ?? null;
}

/**
 * How far a stick must lean, out of 1, before it is a direction. A stick at
 * rest rarely reads 0 and drifts with wear; half its travel is a deliberate
 * push and still easy to reach.
 */
export const STICK_DEAD_ZONE = 0.5;

// The standard mapping's d-pad buttons: up, down, left, right.
const UP = 12;
const DOWN = 13;
const LEFT = 14;
const RIGHT = 15;

/**
 * The direction a pad holds, from its buttons (pressed or not) and its axes.
 * The d-pad wins over the stick, since a press on it is never an accident.
 * Opposite buttons together are nothing, not a pick of one. The stick, left
 * stick on axes 0 (sideways) and 1 (down is positive), needs more than the
 * dead zone, and the stronger axis wins so that a diagonal is one move, with
 * a tie going sideways.
 */
export function heldDirection(
  buttons: readonly boolean[],
  axes: readonly number[],
): Held {
  const up = buttons[UP] === true;
  const down = buttons[DOWN] === true;
  const left = buttons[LEFT] === true;
  const right = buttons[RIGHT] === true;
  if (up || down || left || right) {
    // Sideways first, as a tie on the stick does.
    if (left !== right) return left ? 'left' : 'right';
    if (up !== down) return up ? 'up' : 'down';
    return null;
  }
  const across = axes[0] ?? 0;
  const along = axes[1] ?? 0;
  const strongest = Math.max(Math.abs(across), Math.abs(along));
  if (strongest <= STICK_DEAD_ZONE) return null;
  if (Math.abs(across) >= Math.abs(along)) return across < 0 ? 'left' : 'right';
  return along < 0 ? 'up' : 'down';
}

/**
 * How long a direction is held, in ms, before it moves again: long enough
 * that a press meant as one move is one move, and short enough that a reader
 * holding it is not left waiting.
 */
export const FIRST_REPEAT_MS = 400;

/**
 * Then how often it moves while still held: quick enough to cross a row, slow
 * enough that the reader can see each card go by and let go on the one wanted.
 */
export const REPEAT_MS = 150;

/** What a held direction remembers: which, and when it next moves. */
export interface Repeat {
  direction: Exclude<Held, null>;
  nextAt: number;
}

/**
 * One frame of a held direction. `state` is what the last frame returned (null
 * to begin), `held` what the pad holds now, `now` the frame's timestamp in ms.
 * It fires at once on a new direction, then after FIRST_REPEAT_MS, then every
 * REPEAT_MS, and begins afresh when the direction changes or is let go. The
 * next time is counted from the frame that fired and not from the last
 * deadline, so a slow frame does not make two moves to catch up.
 */
export function repeating(
  state: Repeat | null,
  held: Held,
  now: number,
): { state: Repeat | null; fire: Exclude<Held, null> | null } {
  if (held === null) return { state: null, fire: null };
  if (state === null || state.direction !== held)
    return {
      state: { direction: held, nextAt: now + FIRST_REPEAT_MS },
      fire: held,
    };
  if (now < state.nextAt) return { state, fire: null };
  return { state: { direction: held, nextAt: now + REPEAT_MS }, fire: held };
}

/** A button counts once a press: true only on the frame it goes down. */
export function pressedNow(was: boolean, is: boolean): boolean {
  return is && !was;
}
