// Holds the rule that says what a press does to the cards: which card is
// flipped after it, which was turned back to its front by it, and where focus
// is sent. Each case is a press a reader can make (a card's flip button, its
// Close or the back outside Play, Escape) from each state the cards can be in
// (none flipped, this one flipped, another flipped), and says the figures the
// plan gives. Without it a second card left flipped beside the first, focus
// left on a face that has just been turned away (and so lost to the top of the
// page), or an Escape that took focus from wherever the reader had gone would
// be found only by a person with a keyboard.
import { describe, expect, it } from 'vitest';
import { turn, type Press, type Turn } from '../../src/catalogue/flipping';

const flipA: Press = { kind: 'flip', card: 'a', linked: true };
const flipB: Press = { kind: 'flip', card: 'b', linked: true };
const flipBare: Press = { kind: 'flip', card: 'bare', linked: false };

describe('a flip', () => {
  it('flips the card when none is, and sends focus to its Play link', () => {
    expect(turn(null, flipA)).toEqual<Turn>({
      flipped: 'a',
      turnedBack: null,
      focus: { card: 'a', control: 'play' },
    });
  });

  it('sends focus to the Close button of a card with no link, which has no Play', () => {
    expect(turn(null, flipBare)).toEqual<Turn>({
      flipped: 'bare',
      turnedBack: null,
      focus: { card: 'bare', control: 'close' },
    });
  });

  it('of a second card turns the first back, so that one is flipped at a time, and sends focus to the second’s back', () => {
    expect(turn('a', flipB)).toEqual<Turn>({
      flipped: 'b',
      turnedBack: 'a',
      focus: { card: 'b', control: 'play' },
    });
    expect(turn('a', flipBare)).toEqual<Turn>({
      flipped: 'bare',
      turnedBack: 'a',
      focus: { card: 'bare', control: 'close' },
    });
  });

  it('of the card already flipped changes nothing and moves no focus', () => {
    expect(turn('a', flipA)).toEqual<Turn>({
      flipped: 'a',
      turnedBack: null,
      focus: null,
    });
  });
});

describe('an unflip (Close, or a press on the back outside Play)', () => {
  it('turns the flipped card back and sends focus to its flip button', () => {
    expect(turn('a', { kind: 'unflip', card: 'a' })).toEqual<Turn>({
      flipped: null,
      turnedBack: 'a',
      focus: { card: 'a', control: 'flip' },
    });
  });

  it('of a card that is not flipped changes nothing, and leaves the flipped one be', () => {
    expect(turn(null, { kind: 'unflip', card: 'a' })).toEqual<Turn>({
      flipped: null,
      turnedBack: null,
      focus: null,
    });
    expect(turn('b', { kind: 'unflip', card: 'a' })).toEqual<Turn>({
      flipped: 'b',
      turnedBack: null,
      focus: null,
    });
  });
});

describe('Escape', () => {
  it('turns the flipped card back and, with focus in it, sends focus to its flip button', () => {
    expect(turn('a', { kind: 'escape', focusIn: 'a' })).toEqual<Turn>({
      flipped: null,
      turnedBack: 'a',
      focus: { card: 'a', control: 'flip' },
    });
  });

  it('with focus gone elsewhere turns the card back and leaves focus where the reader put it', () => {
    for (const focusIn of [null, 'b'])
      expect(turn('a', { kind: 'escape', focusIn })).toEqual<Turn>({
        flipped: null,
        turnedBack: 'a',
        focus: null,
      });
  });

  it('with nothing flipped does nothing', () => {
    for (const focusIn of [null, 'a'])
      expect(turn(null, { kind: 'escape', focusIn })).toEqual<Turn>({
        flipped: null,
        turnedBack: null,
        focus: null,
      });
  });
});

describe('one card at a time, through a run of presses', () => {
  it('never has two flipped, and every card turned back is the one that was', () => {
    const presses: Press[] = [
      flipA,
      flipB,
      flipBare,
      { kind: 'unflip', card: 'a' },
      flipA,
      { kind: 'escape', focusIn: 'a' },
      { kind: 'escape', focusIn: null },
      flipB,
      { kind: 'unflip', card: 'b' },
    ];
    let now: string | null = null;
    const turnedBack: (string | null)[] = [];
    for (const press of presses) {
      const next = turn(now, press);
      // What is turned back is what was flipped, and never the card flipped now.
      if (next.turnedBack !== null) expect(next.turnedBack).toBe(now);
      expect(next.turnedBack === null || next.turnedBack !== next.flipped).toBe(
        true,
      );
      turnedBack.push(next.turnedBack);
      now = next.flipped;
    }
    expect(turnedBack).toEqual([
      null,
      'a',
      'b',
      null,
      'bare',
      'a',
      null,
      null,
      'b',
    ]);
    expect(now).toBeNull();
  });
});
