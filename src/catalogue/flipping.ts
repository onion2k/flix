// Says what a press does to the cards that flip: which card is flipped after
// it, which one it turned back to its front, and where focus is sent. It is
// names in and names out, with no page in it, so that every press from every
// state is tried in a unit test. Without it the rule would live in the script
// that reads the page, and a second card left flipped beside the first, or
// focus left on a face just turned away (which the browser drops to the top of
// the page), would be found only by a person with a keyboard.

/**
 * What a reader can do: press a card's front (its flip button, by a click, a
 * tap or Enter), press its back outside Play or its Close button (both are the
 * unflip), or press Escape, with the card that holds focus at that moment.
 * `linked` says whether the card has a Play link, which is where focus goes.
 */
export type Press =
  | { kind: 'flip'; card: string; linked: boolean }
  | { kind: 'unflip'; card: string }
  | { kind: 'escape'; focusIn: string | null };

/** A card's controls focus can be sent to: its front's flip button, its back's Play link or Close button. */
export type Control = 'flip' | 'play' | 'close';

/** What a press comes to. */
export interface Turn {
  /** The card flipped once the press is done with, or null for none. */
  flipped: string | null;
  /** The card this press turned back to its front, or null. */
  turnedBack: string | null;
  /** Where focus is sent, or null to leave it where the reader has it. */
  focus: { card: string; control: Control } | null;
}

/**
 * What `press` does when `now` is the card flipped (null for none). A flip
 * shows that card's back and turns back the one that was flipped, so that one
 * card is flipped at a time, and sends focus to its Play link, or to its Close
 * button where it has no link, since the face focus was on is turned away. An
 * unflip of the flipped card, and Escape, turn it back and send focus to its
 * flip button. Escape sends focus there only when focus was in that card: a
 * reader who has gone on to another part of the page is not taken back. A
 * press that changes nothing (the flipped card's own front, a card that is not
 * flipped, Escape with nothing flipped) moves no focus.
 */
export function turn(now: string | null, press: Press): Turn {
  const nothing: Turn = { flipped: now, turnedBack: null, focus: null };
  switch (press.kind) {
    case 'flip':
      if (press.card === now) return nothing;
      return {
        flipped: press.card,
        turnedBack: now,
        focus: { card: press.card, control: press.linked ? 'play' : 'close' },
      };
    case 'unflip':
      if (press.card !== now) return nothing;
      return {
        flipped: null,
        turnedBack: now,
        focus: { card: now, control: 'flip' },
      };
    case 'escape':
      if (now === null) return nothing;
      return {
        flipped: null,
        turnedBack: now,
        focus: press.focusIn === now ? { card: now, control: 'flip' } : null,
      };
  }
}
