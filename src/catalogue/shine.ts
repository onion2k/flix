// Says where the shine on a best card is, and how far the card tilts. Under a
// mouse the sheen is where the pointer is in the card's box, as two numbers
// from 0 to 1 (left to right, top to bottom), and the card tilts toward it: the
// corner pointed at is pressed away, as a card held in the hand is, never past
// MOST_TILT either way. For a reader with no pointer on the card (a touch
// screen, or a mouse elsewhere) the sheen is where the card's middle is in the
// window, so that it moves across the card as the card is scrolled across the
// window, sideways in its strip and up and down the page, and there is no tilt.
// A pointer outside the box, a box or a window of no size and a number that is
// not one give null: the resting place, which is the stylesheet's (its tokens'
// first values), and no tilt. Without it the page would work out the shine
// itself, a pointer off the card could tilt it without bound, and a card out of
// the window could send its sheen off its picture.

/** The most a card tilts either way, about either axis, in degrees. */
export const MOST_TILT = 6;

/** A box in the window, as getBoundingClientRect gives it. */
export interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** Where the sheen is on the card, and the card's tilt in degrees. */
export interface Shine {
  /** The sheen's place across the card, 0 at its left, 1 at its right. */
  x: number;
  /** The sheen's place down the card, 0 at its top, 1 at its foot. */
  y: number;
  /** The turn about the card's level axis (rotateX): the foot away is less than 0. */
  tiltX: number;
  /** The turn about its upright axis (rotateY): the right away is more than 0. */
  tiltY: number;
}

const between = (value: number): number => Math.min(1, Math.max(0, value));

/** A box with a real, finite size, or null. */
function sized(box: Box): { width: number; height: number } | null {
  const width = box.right - box.left;
  const height = box.bottom - box.top;
  if (!Number.isFinite(width) || !Number.isFinite(height)) return null;
  if (!Number.isFinite(box.left) || !Number.isFinite(box.top)) return null;
  if (width <= 0 || height <= 0) return null;
  return { width, height };
}

/** The shine under a mouse at `pointer`, or null (at rest) where it is not on the card. */
export function underPointer(
  pointer: { x: number; y: number },
  box: Box,
): Shine | null {
  const size = sized(box);
  if (size === null) return null;
  if (!Number.isFinite(pointer.x) || !Number.isFinite(pointer.y)) return null;
  const x = (pointer.x - box.left) / size.width;
  const y = (pointer.y - box.top) / size.height;
  if (x < 0 || x > 1 || y < 0 || y > 1) return null;
  return {
    x: between(x),
    y: between(y),
    tiltX: -(between(y) - 0.5) * 2 * MOST_TILT,
    tiltY: (between(x) - 0.5) * 2 * MOST_TILT,
  };
}

/** The shine for a card with no pointer on it, from where it is in the window; null (at rest) for a box or window of no size. */
export function inWindow(
  box: Box,
  window: { width: number; height: number },
): Shine | null {
  const size = sized(box);
  if (size === null) return null;
  if (!Number.isFinite(window.width) || !Number.isFinite(window.height))
    return null;
  if (window.width <= 0 || window.height <= 0) return null;
  return {
    x: between((box.left + size.width / 2) / window.width),
    y: between((box.top + size.height / 2) / window.height),
    tiltX: 0,
    tiltY: 0,
  };
}
