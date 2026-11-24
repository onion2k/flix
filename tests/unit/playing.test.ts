// Holds the rule for which card's loop plays, which is the catalogue's and not
// the page's: a card qualifies with a loop, its picture arrived, the whole of
// its picture's frame in the window and its front showing; the card a mouse is
// on or that holds focus wins where it qualifies, and otherwise the one whose
// picture's centre is nearest the window's, the earlier on a tie; and none at
// all while more than half of the hero's frame is in the window. The settle
// time is held to the millisecond, and a time that is no use is refused. Each
// table is counted, so that an empty one cannot pass. Without this a first
// screen could fetch a card loop, two pictures could move at once, or a reader
// scrolling past a row could be sent a loop for every card on the way.
import { describe, expect, it } from 'vitest';
import {
  SETTLE_MS,
  heroHolds,
  inFocus,
  qualifies,
  settled,
  type Box,
  type PlayCard,
} from '../../src/catalogue/playing';

const window_ = { width: 1440, height: 1000 };

/** A frame 400 by 225 with its top left at (left, top). */
function frame(left: number, top: number): Box {
  return { left, top, right: left + 400, bottom: top + 225 };
}

/** A card that qualifies, at a place, with any of its facts changed. */
function card(
  id: string,
  left: number,
  top: number,
  change: Partial<PlayCard> = {},
): PlayCard {
  return {
    id,
    hasLoop: true,
    arrived: true,
    flipped: false,
    frame: frame(left, top),
    ...change,
  };
}

/** A hero frame of the window's width with `shown` px of its 600 in the window. */
function hero(shown: number): Box {
  return { left: 0, top: shown - 600, right: 1440, bottom: shown };
}

describe('qualifies', () => {
  it('takes a card with a loop, its picture arrived, wholly in the window and not flipped', () => {
    expect(qualifies(card('a', 100, 300), window_)).toBe(true);
  });

  const each = [
    ['no loop', { hasLoop: false }],
    ['its picture not arrived', { arrived: false }],
    ['flipped', { flipped: true }],
  ] as const;

  it('has a case for each fact', () => {
    expect(each).toHaveLength(3);
  });

  for (const [what, change] of each)
    it(`refuses a card with ${what}, and only for that`, () => {
      expect(qualifies(card('a', 100, 300, change), window_)).toBe(false);
    });

  const out = [
    ['past the left edge', frame(-2, 300)],
    ['past the right edge', frame(1042, 300)],
    ['past the top', frame(100, -2)],
    ['past the foot', frame(100, 777)],
  ] as const;

  it('has a case for each edge', () => {
    expect(out).toHaveLength(4);
  });

  for (const [what, box] of out)
    it(`refuses a frame ${what} by more than a pixel`, () => {
      expect(qualifies(card('a', 0, 0, { frame: box }), window_)).toBe(false);
    });

  it('takes a frame a pixel over an edge, since boxes are read in fractions', () => {
    expect(qualifies(card('a', -1, -1), window_)).toBe(true);
    expect(qualifies(card('a', 1041, 776), window_)).toBe(true);
  });
});

describe('heroHolds', () => {
  it('holds while more than half of the hero is in the window, and not at half', () => {
    expect(heroHolds(hero(600), window_)).toBe(true);
    expect(heroHolds(hero(301), window_)).toBe(true);
    expect(heroHolds(hero(300), window_)).toBe(false);
    expect(heroHolds(hero(0), window_)).toBe(false);
    expect(heroHolds(hero(-100), window_)).toBe(false);
  });

  it('counts only what is in the window of a hero taller than it', () => {
    const tall = { left: 0, top: -500, right: 1440, bottom: 1500 };
    expect(heroHolds(tall, window_)).toBe(false);
  });

  it('does not hold with no hero, or one with no size', () => {
    expect(heroHolds(null, window_)).toBe(false);
    expect(
      heroHolds({ left: 0, top: 100, right: 0, bottom: 100 }, window_),
    ).toBe(false);
  });
});

describe('inFocus', () => {
  it('names none when no card qualifies, or there are none', () => {
    expect(inFocus([], window_, null, null)).toBeNull();
    expect(
      inFocus(
        [card('a', 100, 300, { hasLoop: false }), card('b', -50, 300)],
        window_,
        null,
        null,
      ),
    ).toBeNull();
  });

  it('names the card whose picture’s centre is nearest the window’s', () => {
    // The window's centre is (720, 500); b's is (720, 512).
    const cards = [
      card('a', 20, 400),
      card('b', 520, 400),
      card('c', 1000, 400),
    ];
    expect(inFocus(cards, window_, null, null)).toBe('b');
  });

  it('measures nearness both ways, not along one axis', () => {
    // a's centre is 180 across and 0 down from the window's; b's is 0 across
    // and 300 down.
    const cards = [card('a', 700, 387.5), card('b', 520, 687.5)];
    expect(inFocus(cards, window_, null, null)).toBe('a');
  });

  it('names the earlier in the page on a tie', () => {
    // Centres 200 either side of the window's.
    const cards = [card('a', 320, 387.5), card('b', 720, 387.5)];
    expect(inFocus(cards, window_, null, null)).toBe('a');
    expect(inFocus([...cards].reverse(), window_, null, null)).toBe('b');
  });

  it('passes over a nearer card that does not qualify', () => {
    const cards = [
      card('a', 20, 400),
      card('b', 520, 400, { flipped: true }),
      card('c', 1000, 400),
    ];
    expect(inFocus(cards, window_, null, null)).toBe('c');
  });

  it('names the pointed card where it qualifies, however far it is', () => {
    const cards = [
      card('a', 20, 400),
      card('b', 520, 400),
      card('c', 1000, 400),
    ];
    expect(inFocus(cards, window_, null, 'c')).toBe('c');
  });

  it('names the nearest when the pointed card does not qualify, or is not a card', () => {
    const cards = [
      card('a', 20, 400),
      card('b', 520, 400),
      card('c', 1000, 400, { arrived: false }),
    ];
    expect(inFocus(cards, window_, null, 'c')).toBe('b');
    expect(inFocus(cards, window_, null, 'nowhere')).toBe('b');
  });

  it('names none while more than half of the hero is in the window, pointed or not', () => {
    const cards = [card('a', 20, 600), card('b', 520, 600)];
    expect(inFocus(cards, window_, hero(301), null)).toBeNull();
    expect(inFocus(cards, window_, hero(301), 'a')).toBeNull();
    expect(inFocus(cards, window_, hero(300), null)).toBe('b');
    expect(inFocus(cards, window_, hero(300), 'a')).toBe('a');
  });
});

describe('inFocus, with a mouse (nothing nearest)', () => {
  const ask = (
    cards: PlayCard[],
    pointed: string | null,
    heroBox: Box | null = null,
  ) => inFocus(cards, window_, heroBox, pointed, false);
  const row = () => [
    card('a', 20, 400),
    card('b', 520, 400),
    card('c', 1000, 400),
  ];

  it('names the pointed card where it qualifies, wherever it is', () => {
    expect(ask(row(), 'a')).toBe('a');
    expect(ask(row(), 'c')).toBe('c');
  });

  it('names none with nobody pointed, though cards qualify and one is nearest the middle', () => {
    expect(inFocus(row(), window_, null, null, true)).toBe('b');
    expect(ask(row(), null)).toBeNull();
  });

  it('names none, and no other card, when the pointed card does not qualify', () => {
    const faults = [
      { flipped: true },
      { hasLoop: false },
      { arrived: false },
    ] as const;
    expect(faults).toHaveLength(3);
    for (const fault of faults)
      expect(
        ask([card('a', 20, 400), card('b', 520, 400, fault)], 'b'),
        JSON.stringify(fault),
      ).toBeNull();
  });

  it('names none for a card cut off at the window’s edge, or a name that is no card', () => {
    expect(ask([card('a', 20, 400), card('b', -50, 400)], 'b')).toBeNull();
    expect(ask(row(), 'nowhere')).toBeNull();
  });

  it('names none while more than half of the hero is in the window, pointed or not', () => {
    const cards = [card('a', 20, 600), card('b', 520, 600)];
    expect(ask(cards, 'a', hero(301))).toBeNull();
    expect(ask(cards, 'a', hero(300))).toBe('a');
    expect(ask(cards, null, hero(300))).toBeNull();
  });

  it('names none for no cards', () => {
    expect(ask([], 'a')).toBeNull();
  });
});

describe('settled', () => {
  it('is 600ms, said once', () => {
    expect(SETTLE_MS).toBe(600);
  });

  it('is no until the settle time has gone, and yes from that millisecond on', () => {
    expect(settled(0)).toBe(false);
    expect(settled(599)).toBe(false);
    expect(settled(599.9)).toBe(false);
    expect(settled(600)).toBe(true);
    expect(settled(601)).toBe(true);
    expect(settled(60_000)).toBe(true);
  });

  const nonsense = [Number.NaN, -1, -600, Number.POSITIVE_INFINITY];

  it('has its nonsense to try', () => {
    expect(nonsense).toHaveLength(4);
  });

  for (const elapsed of nonsense)
    it(`refuses a time that is no use: ${elapsed}`, () => {
      expect(settled(elapsed)).toBe(false);
    });
});

// The shine (src/scripts/shine.ts) asks the same rule which card is in focus
// on a touch screen, feeding it every card as having a loop and its picture
// arrived (a card shines without either) and nobody pointed at: so the card
// nearest the window's middle, wholly in it, with its front showing, shines,
// whether or not it has a loop, and none does while the hero holds. No change
// to the rule was needed, and this holds the use.
describe('inFocus, as the shine asks it', () => {
  const asked = (cards: PlayCard[], heroBox: Box | null = null) =>
    inFocus(cards, window_, heroBox, null);

  it('picks the nearest whole card whatever its loop, with every card said to have one and its picture to have arrived', () => {
    // The nearest to the middle (720, 500) is "near", whose frame is centred
    // 40px from it; both are fed as the page feeds the shine.
    const cards = [
      card('far', 20, 40),
      card('near', 520, 387),
      card('other', 900, 700),
    ];
    expect(cards).toHaveLength(3);
    expect(asked(cards)).toBe('near');
  });

  it('leaves out a flipped card and one not wholly in the window, so that the next nearest shines', () => {
    const cards = [
      card('flipped', 520, 387, { flipped: true }),
      card('cut', 1300, 387),
      card('whole', 100, 300),
    ];
    expect(asked(cards)).toBe('whole');
  });

  it('is none while more than half of the hero shows, and the nearest once less does', () => {
    const cards = [card('a', 520, 387)];
    expect(asked(cards, hero(400))).toBeNull();
    expect(asked(cards, hero(250))).toBe('a');
  });

  it('is none with no card in the window', () => {
    expect(asked([])).toBeNull();
    expect(asked([card('out', 1500, 387)])).toBeNull();
  });
});
