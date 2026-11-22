// Holds the dragging rule: from where a press began, where the pointer is now,
// where the strip was scrolled at the press and the furthest it can scroll,
// whether this is a drag yet and where the strip should be scrolled. It is a
// pure function so that the threshold, the direction and the two ends are
// tried here with numbers and not through a browser. Each case states its
// figures. The direction is the one that matters most: the pointer moving left
// drags the content left, which is a scrollLeft that rises, and a rule written
// the other way round would feel like a strip pushed away from the hand.
import { describe, expect, it } from 'vitest';
import { DRAG_THRESHOLD, dragging } from '../../src/catalogue/dragging';

/** A press at (500, 300), with the strip scrolled to `from` of at most 2000. */
const press = (x: number, y = 300, from = 0, furthest = 2000) =>
  dragging({
    began: { x: 500, y: 300 },
    pointer: { x, y },
    scrolledFrom: from,
    furthest,
  });

describe('dragging', () => {
  it('names a threshold of a few pixels', () => {
    expect(DRAG_THRESHOLD).toBeGreaterThanOrEqual(4);
    expect(DRAG_THRESHOLD).toBeLessThanOrEqual(8);
  });

  it('is not a drag with no movement', () => {
    expect(press(500).dragging).toBe(false);
  });

  it('is not a drag at the threshold, in either direction', () => {
    expect(press(500 - DRAG_THRESHOLD).dragging).toBe(false);
    expect(press(500 + DRAG_THRESHOLD).dragging).toBe(false);
  });

  it('is a drag one pixel past the threshold, in either direction', () => {
    expect(press(500 - DRAG_THRESHOLD - 1).dragging).toBe(true);
    expect(press(500 + DRAG_THRESHOLD + 1).dragging).toBe(true);
  });

  it('is not a drag for movement that is only vertical', () => {
    expect(press(500, 300 + 200).dragging).toBe(false);
    expect(press(500, 300 - 200).dragging).toBe(false);
  });

  it('is not a drag for movement that is mostly vertical', () => {
    expect(press(500 - DRAG_THRESHOLD - 1, 300 + 100).dragging).toBe(false);
  });

  it('leaves the strip where it was while it is not a drag', () => {
    expect(press(500 - 3, 300, 700).scrollLeft).toBe(700);
  });

  it('scrolls right when the pointer moves left, one for one', () => {
    expect(press(500 - 300, 300, 100).scrollLeft).toBe(400);
  });

  it('scrolls left when the pointer moves right, one for one', () => {
    expect(press(500 + 250, 300, 600).scrollLeft).toBe(350);
  });

  it('stops at the start, however far the pointer goes right', () => {
    expect(press(500 + 900, 300, 100).scrollLeft).toBe(0);
  });

  it('stops at the furthest, however far the pointer goes left', () => {
    expect(press(500 - 900, 300, 1800, 2000).scrollLeft).toBe(2000);
  });

  it('holds a strip that cannot scroll at 0', () => {
    expect(press(100, 300, 0, 0).scrollLeft).toBe(0);
  });

  it('stays a drag once begun, back inside the threshold or off to one side', () => {
    const back = dragging({
      began: { x: 500, y: 300 },
      pointer: { x: 502, y: 300 },
      scrolledFrom: 100,
      furthest: 2000,
      begun: true,
    });
    expect(back).toEqual({ dragging: true, scrollLeft: 98 });
    const down = dragging({
      began: { x: 500, y: 300 },
      pointer: { x: 480, y: 700 },
      scrolledFrom: 100,
      furthest: 2000,
      begun: true,
    });
    expect(down).toEqual({ dragging: true, scrollLeft: 120 });
  });
});
