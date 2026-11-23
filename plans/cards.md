# Cards that flip, play and shine

State: landed on main at 7107a6a, 2026-11-23.

Agreed in a harness's plan file and copied here the same day; this copy is
the one ticked. Its facts hold on commit `6c8d3aa`.

## Context

The owner finds the site good at a desk and dull on a phone, where a card is
78vw wide and a row reads as one column. Five changes, asked for on
2026-11-23: the header's nav goes; a phone keeps its sideways rows with
smaller cards; a card flips over for its details and no longer grows on
hover; the loop of the card most in focus plays by itself; and the three
best games (Aquaclysm, Pushminer, Tiny Slots) shine like a foil card.

Answered by the owner on 2026-11-23:

- **Header:** all of the nav goes, Surprise me with it. The header is the
  wordmark alone.
- **Flip:** a tap, click or Enter anywhere on a card flips it. Front:
  picture (where the loop plays), label, title. Back: label, title,
  description, a Play button that opens the game. A tap on the back outside
  Play, or Escape, flips it back. One card flipped at a time.
- **Pause:** the one card that is playing shows a small Pause button on its
  picture. It holds every card loop for the visit and then reads Play. The
  hero's button is unchanged.
- **Size:** a card is one size, flipped or not ("It'd be better if cards
  didn't change height (or size)"). On a phone the back drops its repeat of
  the label and title and Play reads "Play"; at every width the front's
  picture fills the room left over, cropped at its sides and never shorter
  than 16 by 9.

**Built on Opus,** as the owner asked: each part is handed to the `builder`
agent with `model: opus`, one part at a time (they share `Card.astro` and
`site.css`), and what comes back is checked against this file before the
next starts.

## Where it stands now (measured 2026-11-23)

- Card width on a phone: 78vw (304px at 390), so the next card shows 50px.
- 12 card loops, 6.0 s each, 36,710 to 218,443 bytes, 1,377,206 in all.
  Today none is fetched until a card grows.
- Page with fonts and no pictures: 54,631 of 60,000 bytes (5,369 to spare).
- First screen at 1440x1000: no row picture is wholly in the window (an
  estimate from the stylesheet: the hero is 672px, the row's pictures end
  near 1080). At 390x844 the first card's picture is.

## What is built

### 1. The header

- `Base.astro`: the `<nav>`, its links and the Surprise me button go; the
  `rows` prop goes. `index.astro` stops passing it and importing
  `surprise`.
- Deleted: `src/scripts/surprise.ts`, `src/catalogue/chance.ts`,
  `tests/unit/chance.test.ts`, `tests/e2e/surprise.spec.ts`, the nav and
  `.surprise-button` rules in `site.css`. `structure.test.ts` keeps "no
  global random in `src/`". `window.ooerflixSeed` leaves the test API.
- Row ids stay as anchors (given out, kept): `late.spec.ts` reaches a late
  row by `goto('/#toys')` where it used a nav link; `page.spec.ts` and
  `moving.spec.ts` lose their nav cases.

### 2. Phone rows

- `tokens.css`: `--card-width-phone: 58vw` (226px at 390: one card and 60%
  of the next), `--size-card-title-phone`. `Card.astro`'s `sizes` says 58vw.
- The stack below 340px stays (WCAG 1.4.10), unchanged.
- A strip comes to rest on a card's start however it is moved, with motion
  or without, its start kept an arrow's width clear so that no card at rest
  is under Previous, and the first card at the strip's very start rests at
  the gutter as before.

### 3. The flip (replaces the grown card)

- **Markup, `Card.astro`:** `li.card > div.card-faces > div.face.front +
div.face.back`. Front: the frame, the label, `h3` (plain title, no link),
  and `button.card-flip[hidden]` named `card.aboutName`. Back: label, title
  (a `p`, not a second heading), description, the one link
  `a.card-link.button` (words `linkText`, the new-window icon, `aria-label`
  `linkName`), and `button.card-unflip[hidden]` named `card.closeName`. The
  label line loses its icon. On a phone (21.25rem to 40rem) the back does
  not draw its repeat of the label and title, and Play's drawn words are
  "Play" and its icon, its name unchanged.
- **Words, said once in `src/catalogue/rows.ts`:** `aboutName` "About
  <title>", `closeName` "Close <title>". Drafts: the owner edits them.
- **Without script, or before it runs:** the faces flow one under the
  other and the link's `::after` covers the card, so the card is one link
  as now. `flip.ts` marks each card `data-flips` and unhides the buttons;
  CSS under `[data-flips]` stacks the faces in one grid cell (the card is
  as tall as its taller face, the strip stretches a row's cards level, so
  nothing is clipped at any text size, and a card is the same size flipped
  or not), lets the front's picture fill the room its label and title leave
  (never shorter than 16 by 9, cropped at its sides), and takes the link's
  stretch off.
- **Rule, `src/catalogue/flipping.ts`** (pure): from which card is flipped
  and a press (flip, unflip, Escape, another card's flip), which is flipped
  next and where focus goes. Unit-tested.
- **Script, `src/scripts/flip.ts`:** `data-flipped` on the card, `inert`
  on the face turned away, focus to the Play link (the unflip button on a
  card with no link) and back to the flip button. Every card flips, linked
  or not.
- **Look:** `rotateY(180deg)` with `backface-visibility: hidden`; the turn's
  transition is in the no-preference block only, so reduced motion swaps
  faces at once. Forced colours: borders stand.
- **Goes:** `src/scripts/grow.ts`, `src/catalogue/growing.ts`,
  `tests/unit/growing.test.ts`, `tests/e2e/grow.spec.ts`, `.grown*` rules,
  the three grow tokens, `data-play`.
- **Follows:** `src/scripts/moving.ts` stops are each card's live control
  (the flip button, or Play when flipped), and the pad's first button
  clicks a flip button; house lights in `site.css` key on `:hover` and
  `:has(:focus-visible)` of the card, not `[data-grown]`; `drag.ts` is
  unchanged (a press that does not move is the click that flips).

### 4. The loop of the card most in focus

- **Rule, `src/catalogue/playing.ts`** (pure, time handed in):
  `inFocus(cards, window, hero, pointed)`. A card qualifies with a loop,
  its picture arrived and wholly in the window, and not flipped. The card a
  mouse is on or keyboard focus is in wins; otherwise the one whose
  picture's centre is nearest the window's, the earlier on a tie. **None
  while more than half of the hero's frame is in the window,** so one
  picture moves at a time and the first screen fetches no card loop.
  `settled(elapsed)`: the answer must hold 600ms (the old `PAUSE_MS`)
  before a loop is asked for, so scrolling past fetches nothing. The start
  rule is `heroStart` from `src/catalogue/hero.ts`, reused: play, offer
  (reduced motion: Play button, fetched on press), still (Save-Data, no
  loop).
- **Script, `src/scripts/playing.ts`:** reads boxes on scroll (page and
  strips), resize, hover, focus and flip, on `requestAnimationFrame`; one
  `<video>` (muted, looping, `playsinline`, `aria-hidden`) in the playing
  card's frame, made with its `src` then and taken down when another card
  takes over; `button.card-pause` on that frame, words and name from a new
  `cardPauseWords` beside `pauseWords`. A pause holds for the visit, kept
  nowhere. A loop that fails is taken down with its button.
- **Weight:** `gates/weight.json` gains `cardLoopBytes: 250000` (the
  largest today is 218,443) and `judging.ts` holds any card loop on a first
  screen to it, apart from the hero's. Expected count on every measured
  first screen: none. **Approving this plan agrees that figure.**

### 5. The shine

- **Content:** `catalogue.json` gains `best: ["aquaclysm", "pushminer",
"tiny-slots"]`. `schema.ts` allows it; `buildPage` refuses, by name, an
  id with no file, one said twice and one in no row; `Card` gains `best`,
  and a best card's label reads "<Kind> · Top pick" (a draft, the owner's
  to edit), so the shine is not the only thing that says it.
- **Rule, `src/catalogue/shine.ts`** (pure): from a pointer in a card's box,
  or a card's box in the window, the sheen's place (0 to 1 each way) and
  the tilt in degrees, clamped.
- **Script, `src/scripts/shine.ts`:** sets `--shine-x`, `--shine-y`,
  `--tilt-x`, `--tilt-y` through the CSSOM on `li.card[data-best]`. A mouse:
  the sheen follows the pointer and the card tilts. Touch: the sheen
  follows the card's place in the window as the page and strip scroll, no
  tilt. Runs only while a best card is in the window. No idle animation
  (nothing moves by itself, so 2.2.2 is not reached).
- **Look:** a foil layer over the picture and a foil edge on the card, from
  new `--color-foil-*` and `--share-foil` tokens, never under words.
  Reduced motion: a still sheen at a fixed place, no tilt. Forced colours:
  none.

## Acceptance criteria

1. The header holds the wordmark and no nav, link list or button, at every
   width, on every page.
2. At 390px a row scrolls sideways and its second card shows at least half;
   at 320 to 339px rows stack as now.
3. A click, tap or Enter on a card flips it: the back's words are in the
   tree, the front's are not, focus is on Play. No game opens.
4. Play on the back opens the game in a new window, with the name and `rel`
   the card's link has today.
5. A tap on the back outside Play, the Close button and Escape each flip it
   back, with focus on its flip button. Flipping a second card flips the
   first back.
6. With script off a card shows all its words and is one link, as now.
7. Nothing grows on hover or focus; no `.grown` is ever in the page.
8. Scrolled past the hero and settled 600ms, exactly one card's loop plays:
   the one the rule names. A hovered or focused card takes it over. No loop
   is asked for at load, while scrolling, or for a flipped card.
9. Pause on the playing card holds it; no card loop plays again that visit
   until Play. Reduced motion: none plays unasked. Save-Data: none fetched.
10. The three best cards, and no other, carry the foil and "Top pick"; the
    sheen follows a mouse; under reduced motion nothing on them moves.
11. Text stays 7:1, rings and edges 3:1, every control 44px, axe clean.

## Edge cases

- **Script off:** 6. No flip, loop, pause or sheen motion; a still foil.
- **Row arrows, marks, no scrollbar:** unchanged; stops follow the new
  card width (`rows.ts` reads it).
- **Mouse, touch, pen:** all flip by click; only a mouse hover takes the
  loop or moves the sheen by pointer; a drag flips nothing.
- **Keyboard:** Tab order flip button, then Pause where shown; a turned-away
  face is inert; arrows move between cards' live controls.
- **Gamepad:** first button flips, and on Play opens the game.
- **Widths:** 1440, 390, 320, 640, each side of 21.25rem, 40rem, 64rem;
  text spacing with a card flipped.
- **Reduced motion, forced colours:** as said in each part.
- **The date and the hero:** unchanged; the hero in view holds card loops
  off on each feature day.
- **No link / no loop:** flips with no Play; never plays. A long title or
  description makes its row's cards taller, never clipped.
- **Picture slow or missing, late rows:** flips; plays only once arrived.
- **Surprise me:** gone. **404 and privacy:** header only.

## Tests

- Unit: `flipping.test.ts`, `playing.test.ts`, `shine.test.ts`; `rows.test.ts`
  and `schema.test.ts` for `best` and the new names; `hero.test.ts` for
  `cardPauseWords`; `weight-judging.test.ts` for the card-loop budget.
- E2E, new: `flip.spec.ts`, `playing.spec.ts` (clock stepped as
  `moving.spec.ts` does; a loop's playing asked of the video), `shine.spec.ts`.
- E2E, changed: `page`, `keyboard`, `moving`, `lights`, `windows`, `nojs`,
  `late`, `reflow`, `contrast`, `axe`, `motion`, `header-policy`, `origin`,
  `drag`, `today`, `hero` where they name the nav, `h3 a`, or the grown card.
- Look: home at 1440, 390 and 320 written again; the grown-card picture
  replaced by a flipped card at 1440 and at 390; added, a best card with
  its sheen at a fixed pointer, and a card's loop held at 2.0 s.
- Each new test is seen failing first, and mutation-checked by hand.

## Out of scope

The hero and its button; the feature by the day; the loops' files; the
stack below 340px; a real phone, Safari and a screen reader (said as not
verified); pushing (asked for when the pass is green).

## Parts

Each is committed locally when its own tests and `npm run check:quick` are
green. Headless pictures at 390 and 1440 are sent to the owner after parts
2, 3 and 5; the build does not wait on them.

- [x] 1. The header is the wordmark alone. `page.spec.ts`, `late.spec.ts`.
- [x] 2. Phone rows have smaller cards. `reflow.spec.ts`, `rows.spec.ts`.
- [x] 3. A card flips and nothing grows. `flipping.test.ts`, `flip.spec.ts`,
      `moving.spec.ts`, `nojs.spec.ts`.
- [x] 4. The card most in focus plays, with Pause. `playing.test.ts`,
      `playing.spec.ts`, `weight-judging.test.ts`.
- [x] 5. The best cards shine. `shine.test.ts`, `shine.spec.ts`,
      `rows.test.ts`.
- [x] 6. The pass: `npm run check`; look and weight baselines written again
      on purpose and every picture read; mutations; `CLAUDE.md` (Commands,
      Layout, Test API, Edge cases, Gates, What is not held) moved on.

## Verification

`npm run check` (quick check, build, e2e, look, weight), then by hand
`npm run audit`. Headless pictures and a short stepped run of a flip, a
loop taking over and the sheen, at 1440, 390 and 320, read before the
report. The report says what was not verified: a real phone, Safari's
video and autoplay, a real touch flip, a screen reader.
