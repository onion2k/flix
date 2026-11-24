# Foils for every card

State: agreed 2026-11-24.

(On approval this file is copied to `plans/foils.md` in the project, and that
copy is the one ticked. Facts hold on commit `3b51efe`.)

## Context

The owner likes the top picks' holographic foil (round seven, live since
`0ca5501`) and wants every card to shine, with different finishes rather
than one look everywhere. Interviewed on 2026-11-24, the owner chose:

- **Every card shines,** varied. The three top picks keep today's holo.
- **Rarity tiers decide the finish,** as on trading cards. A card's tier is
  set in `src/content/catalogue.json`; a card in no tier is common.
- **Four new finishes to mock:** gold glitter, galaxy, reverse holo, cracked
  ice.
- **Decoration only:** a finish says nothing a reader must know, so no label
  changes. "Top pick" stays on top picks, in words, as now.
- **The ladder is set after the mocks:** which finish goes with which tier,
  and which cards sit in each tier, are the owner's, once they have seen the
  finishes on real cards, still and moving, at a desk and on a phone.
- **Quiet at rest:** every finish shows faintly at rest (as top picks do,
  `--share-foil-rest`, a third) and fully under a mouse. On a touch screen
  only the card in focus shows fully and follows the scroll; the others hold
  still at rest, so a row is not a wall of shimmer.
- **The page budget is raised once measured:** four finishes will pass the
  60,000-byte budget for the page with fonts and no pictures (59,232 today,
  768 left; estimated 1.5 to 2.5KB more). The real cost is measured and the
  budget raised to cover it with a little room, recorded as the owner's
  decision with the figure.
- **Smoothness is measured:** scroll frame time on a phone, headless with
  the CPU slowed to a phone's, before and after, and reported.

## Where it stands now (measured 2026-11-24)

- 19 cards in 4 rows: 15 games, 4 toys; 2 workshop games have no link; 3 top
  picks (Aquaclysm, Tiny Slots, Pushminer).
- The foil is three layers over a best card's picture (`.foil` dodge with a
  flare, `.frame::before` glitter and glare, `.foil-wash` overlay), driven by
  `--shine-x/y`, `--tilt-x/y`, `--foil-edge` and `--foil-on`, every figure a
  token (`src/styles/tokens.css`), and `src/scripts/shine.ts`. Its rules weigh
  about 1.1KB compressed on their own.
- `public/foil-glitter.svg` (587 bytes) is the one texture, fetched once.

## How it is built

- **The ladder (the owner, 2026-11-24, after the mocks):** top pick `holo`
  (Aquaclysm, Tiny Slots, Pushminer, as now); `gold` glitter (Ooergolf, Heist,
  Propshop, Snappy); `galaxy` (Chopdrop); cracked `ice` (Fruit Machine,
  Coinpusher, Ooerrace); and `reverse` holo, the common finish, for every
  other card and any card named in no list.
- **Data:** `catalogue.json` gains `finishes`, an object whose keys are the
  three named finishes (`gold`, `galaxy`, `ice`) and whose values are site
  ids. `schema.ts` allows it (no other key); `buildPage` in
  `src/catalogue/rows.ts` refuses, by file and id, an id with no file, one
  named twice (in one list or two), one in no row, and a top pick in a list.
  Each `Card` gains `finish`: `holo` for a top pick, its list's name, else
  `reverse`. `Card.astro` writes `data-finish` and draws the foil layers on
  every card.
- **One structure, several finishes:** the three layers stay as they are,
  and each finish is a set of custom properties under `[data-finish=…]`
  (its gradients, blends, strengths and texture), so a finish costs its
  values and not its rules. Reverse holo puts the shine on the card's tile
  and edge instead of its picture, so it alone has rules of its own, and must
  keep every word at 7:1 and every card's border the same as the others' (the
  owner's earlier ruling); the mock shows whether it can, and if not, the
  owner chooses again. Textures for galaxy and cracked ice are small SVGs in
  `public/`, as the glitter is, each fetched once, the same file at two sizes
  where it serves.
- **Behaviour:** `shine.ts` handles every card with a finish, not only
  `data-best`. Under a mouse as now. On a touch screen it moves only the card
  in focus, chosen by `inFocus()` in `src/catalogue/playing.ts` (the nearest
  whole card to the window's middle, settled for 600ms) with its loop
  condition set aside, since a card without a loop shines too; that card
  carries `data-foil-focus` and `--foil-on: 1`; the others stay at rest.
  Reduced motion: still, at rest, as now. Forced colours: no finish.
- **Weight and frames:** the weight gate measures the cost; the budget in
  `gates/weight.json` is raised by the owner's decision to the measured
  figure plus room, with the measurement in its status. A one-off frame
  measurement (Playwright, CPU throttled 4x through CDP, a scripted scroll of
  every row at 390 and a mouse sweep at 1440, before and after) is reported;
  there is no frame gate, and that is said under What is not held.

## Out of scope

The holo's own look; the phone layout; the label words; the loops; a frame
gate (named as missing, offered as a follow-up if the numbers ask for one).

## Parts

Each part is committed locally when its own tests and the quick check are
green; pictures and recordings go to the owner after parts 1 and 4.

- [x] 1. Mock the four finishes on real cards over the built page: gold
      glitter, galaxy, reverse holo, cracked ice, beside the holo, at 1440
      and 390, stills at two pointer places and recordings; sent to the owner.
- [x] 2. The owner sets the ladder: tier names, a finish for each, and the
      cards in each (a question the owner owes; nothing past it is built
      before it is answered). Set 2026-11-24; see The ladder, above.
- [x] 3. Tiers in the catalogue: `schema.ts`, `rows.ts` (`finish`, the four
      refusals), `Card.astro` (`data-finish`, layers on every card).
      `rows.test.ts`, `schema.test.ts`, `catalogue-file.test.ts`.
- [x] 4. The finishes in tokens and CSS, and their textures. `shine.spec.ts`
      (each card carries its tier's finish and its layers; none on forced
      colours; still under reduced motion), `contrast.spec.ts` (words 7:1
      on every finish, reverse holo included), `motion.spec.ts`.
- [x] 5. The behaviour: every finish under a mouse; on touch only the card
      in focus moves. `shine.spec.ts` (touch: one card at full, the rest at
      rest; a mouse: the card under it), `playing.test.ts` for the rule
      without a loop.
- [ ] 6. The pass: `npm run check`; weight measured and the budget raised by
      the owner's figure; frames measured before and after and reported;
      look pictures written again and every one looked at, a picture per
      finish added; mutations; `CLAUDE.md` moved on (Layout, Edge cases,
      Gates, What is not held, Keeps).

## Verification

`npm run check` green twice; the weight gate with its new budget; the frame
measurement before and after at 390 and 1440; headless pictures and
recordings of every finish at rest, under a mouse and on a touch scroll,
read before the report. Not verified, and said: a real phone, Safari and
Firefox, how the finishes feel by hand.
