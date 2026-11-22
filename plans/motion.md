# Motion: loops, a card that grows, a moving hero

State: building, part 3 of 4.

## Context

You found that the earlier ideas did not make the site more exciting, and
chose, from mocks drawn on the real page on 2026-11-22, two of three: **A,
the card grows** and plays a gameplay loop on hover or focus, and **C, a
moving hero**, the feature full-width with its loop playing behind a solid
panel. B, the detail panel, was not chosen. Both run on short gameplay
loops recorded from the games themselves, so the loops come first.

Settled already:

- **Format:** WebM (VP9), silent. caniuse (read 2026-11-22) gives full WebM
  support in Safari 16 on macOS, iOS 17.4, Chrome and Firefox; older
  browsers get the still, as now. No MP4 copy.
- **Sizes, measured on the Chopdrop recording:** a card loop at 640 wide is
  about 180–240 KB; the hero loop at 960 wide about 355 KB.
- **The hero loop has a budget of its own,** 450,000 bytes, and starts only
  after the page has drawn. The 150,000-byte first-screen picture budget
  stays as it is (your answer, 2026-11-22).
- **A replaces the stills preview and the segments bar** (said in the
  question you answered). The 20 preview stills and the `previews` field
  go; the motion is the loop.

## The loops (part 1)

- Each is about six seconds, recorded headless from the game's public page
  by a scripted player (keys or clicks a game understands), as the Chopdrop
  loop was: take-off, flight, a turn. A recipe a game, kept in
  `tools/loops/` with the commands that remake it, so a loop is built again
  and never edited.
- Encoded twice: a card loop 640 wide, and, for the five feature
  candidates (Nuclear Fishin', Aquaclysm, Ooergolf, Chopdrop and whatever
  `features` names then), a hero loop 960 wide. Stored in
  `src/content/loops/`, named in each site's YAML as `loop` (and
  `heroLoop`), checked by the schema like a picture.
- **A game that will not record headless** keeps its still and no loop.
  Snappy and ooerrace have no public address and are left without.
- **You approve the loops before anything uses them:** one contact sheet
  and one video of them all, from me, and a loop you do not like is
  dropped or recorded again. Their words and choice are yours.
- The repo grows by roughly 4–6 MB, against the 1.9 MB of stills removed.

## A: the card grows (part 2)

- On a mouse hover (where `(hover: hover) and (pointer: fine)`) or keyboard
  focus on a card's link, after the same 600 ms pause the previews use, an
  enlarged copy of the card (1.5 times, as in the mock) opens over its row:
  the loop playing, the label, title, description and the Play link.
  Leaving shrinks it at once. A card with no loop grows with its still.
- **Accessibility:** the grown card is a picture of the card, not a second
  control: `aria-hidden`, out of the Tab order, and a click on it follows
  the real card's link. The ring is on the grown card while the real link
  has focus. Escape closes it.
- **Not:** under reduced motion (no growth, no loop), with Save-Data on (it
  grows with the still, nothing fetched), on touch (a tap goes to the game,
  as now), or with script off. House lights still dim the row.
- The loop is fetched on the first open only; nothing at load.
- Removes `src/components/Previews.astro`, `src/catalogue/preview.ts`, the
  previews half of `src/scripts/preview.ts` and their tests, the segments
  bar and its tokens; the rule for the pause stays, in a module of its own.

## C: the moving hero (part 3)

- The day's feature becomes a full-width band under the header (about
  72vh at a desk's width), its loop filling it, the title, label,
  description and Play on a solid ground-coloured panel at the lower left,
  and a **Pause** button at the lower right (WCAG 2.2.2: a loop that runs
  past five seconds needs one). Pause holds for the visit, nowhere saved.
- The still is drawn first, as the poster; the loop is fetched only once
  the page has loaded, and only the day's.
- **On a phone** the loop sits above the panel, not behind it.
- **Not:** reduced motion (the still, and a Play button for the loop if the
  reader asks), Save-Data (the still), script off (the still, as now).
- The feature-by-day script, the social card and the arrow-key moves keep
  working with the new markup.

## How each part is built

By the `builder` agent, tests first, one part at a time, as before: the
house rules, AAA, motion only inside `prefers-reduced-motion:
no-preference`, nothing fetched that the reader did not ask for, the clock
held. After each I run the full check, look at the pictures, put a fault
of my own in, and commit locally. The look baselines move on purpose and
each is looked at. Pushing is asked for each time.

- [x] 1. The loops, recorded and shown to you for approval. Approved on
      2026-11-22, twelve of seventeen: Chopdrop, Nuclear Fishin',
      Aquaclysm, Ooergolf, Fruit Machine, Codex Squadron, Heist, Chess,
      Book Worm, Pushminer, PETZ-9000 and Tiny Slots. Coinpush,
      coinpusher, Spiro, Propshop and Release Flow Model keep their still
      and grow with it.
- [x] 2. A: the card grows. The owner's new order put the picture budget
      over; the feature is now drawn at AVIF quality 40 and the picture
      budget is 200,000, both the owner's choice on 2026-11-22.
- [ ] 3. C: the moving hero, with its own budget in `gates/weight.json`.
- [ ] 4. The pass: full check, polish, preflight against the live site
      after a push you approve, and the report.

## Verification

- `npm run check`: unit, end to end (hover, focus, Escape, leave, reduced
  motion, Save-Data, touch, script off, one picture in the accessibility
  tree, nothing fetched at load), look, weight (pictures at 150,000 and
  the hero loop at 450,000, each failing on a fault put in).
- A recording of each interaction in motion, sent to you, beside the look
  pictures.
- After a push: `npm run headers` and a live browser load, as last time.

## Out of scope

B, the detail panel. Sound. Loops for the 29 other subdomains. Changing
which sites are listed. The content policy (video from the site's own
origin is already allowed by `default-src 'self'`; checked in part 2).
