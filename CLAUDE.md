# Ooerflix

A static website that shows the games and toys its owner builds, as a
featured entry and rows of cards that scroll sideways and flip over for
their details. It is built
with Astro into plain files and served by Netlify from `main`, at
`https://flix.ooer.com`. There is no server and no saved state.

This file says how the project is changed. It was written on 2026-11-22
from commit `d955f12`, when only the scaffold existed; each part of
`plans/first-site.md` moved it on as it landed, and `plans/cards.md` moved
it on, on 2026-11-23. How work is done is the
guardrails kit's: this project carries no copy of it, and is held to
`~/projects/guardrails/GUARDRAILS.md` and, as a website, to
`~/.claude/rules/websites.md`. The bar is WCAG 2.2 AAA, less 3.1.3 to
3.1.6.

## Commands

    npm run dev          the dev server, at http://localhost:4321
    npm run build        the site, as files in dist/, and last (postbuild)
                         dist/_headers, the whole content policy
    npm run preview      the built site, at http://localhost:4390
    npm run check:quick  the pre-commit hook: see below
    npm run test:e2e     Playwright, tests/e2e, against the built site:
                         the page, contrast as drawn, motion, axe, policy
    npm run look         the seventeen pictures, tests/look, against baselines
    npm run look:update  writes them again, for a change meant to move them
    npm run weight       page weight, tests/gates, against gates/weight.json
    npm run weight:update  writes that baseline again, on purpose
    npm run check        the quick check, a build, e2e, look, weight (~20s)
    npm run format       the formatter, writing

Two gates need the network and so are not in `check`; run them before a
publish, with a build made:

    npm run links        every https address a card links to is alive (a
                         gone one fails; others are listed as unverified)
    npm run headers -- <address>   the live address sends the whole CSP (not
                         frame-ancestors alone), HSTS, nosniff, a referrer
                         policy and X-Frame-Options (the preview sends none)
    npm run audit        npm audit at high
    npm run loops [-- <site id>]   records each game's loop from its public
                         address, for approval (reaches the network; never in
                         check; writes tools/loops/out, not committed)

`npm install` points git at `.githooks/`, and `pre-commit` there runs the
quick check, which is, cheapest first:

    npm run secrets      gitleaks over what is staged
    prettier --check .   the formatter, as a check
    npm run types        astro check: types in .astro and .ts, strict
    npm run lint         eslint, type-aware, over .ts alone
    npm run test:unit    vitest, tests/unit

A build needs the network: Astro fetches the two fonts at build time and
hosts them itself. Dependencies are pinned exact, and each arrives in a
commit of its own that says what it is for.

## Layout

- `src/catalogue/` is **the thing**: plain TypeScript with no Astro in
  it, importing nothing of the page and nothing outside the folder but
  `astro/zod`. `schema.ts` holds the shape of an entry and of the
  catalogue file, and `rows.ts` builds the page's model from them, refuses
  a catalogue that does not hold together (naming file and id) and returns
  the sites that have a file and are not listed. `paging.ts` says, from a strip's
  scroll position, whether its Previous and Next arrows are live, where
  each goes, the row's stops (its pages: a window on from the last, the end standing
  in for a stop with less than a card left) and which one it is at; a press
  is sent to a stop and the browser lands it on the card's start nearest it,
  within half a card's step, which the rule already takes to be at that
  stop. `dragging.ts` says, from a mouse's press and where it is now, whether that is a drag and where the strip is then scrolled. `colour.ts` says whether text is a colour the page may
  use (`#` and six lower-case hex digits, nothing else), and works out the
  colour a picture waits in from the pixels of a small copy of it.
  `hero.ts` says what the moving hero does at load (play its loop, offer
  it on a button, or leave the still) from three facts, the Pause
  button's words (`pauseWords`) and the cards' (`cardPauseWords`).
  `paging.ts` also has `whollyIn`: whether a focused card is wholly in its
  strip's window, less the scroll padding. `moving.ts` says where an
  arrow-key or gamepad move lands among the cards' live controls, which
  direction a pad holds, and when a held one fires (time handed in).
  `flipping.ts` says what a press (flip, unflip, Escape) does: which card is
  flipped next, which was turned back, and where focus goes. `playing.ts`
  says which card's loop plays (`inFocus`: one with a loop, its picture
  arrived, its frame wholly in the window and its front showing; the
  pointed or focused card first, else the nearest the window's centre; none
  while more than half the hero's frame shows) and when (`settled`,
  `SETTLE_MS`, time handed in). `shine.ts` says where a best card's sheen is
  and how far it tilts (`MOST_TILT`), under a mouse or from its place in the
  window. `today.ts` says which candidate is the day's feature, from a
  count and the clock's reading handed in (whole days since 1970-01-01 UTC,
  modulo the count). `buildPage` returns `candidates`: `feature`, then the
  optional `features` list of `catalogue.json`, each refused by name if it
  has no file, repeats or is `feature` itself; and marks a row's card
  `best` where `catalogue.json`'s `best` names it, refusing by name an id
  with no file, one said twice and one in no row. A card's words are said
  there: `aboutName` ("About <title>"), `closeName` ("Close <title>"),
  `linkText`/`linkName`, and a best card's label "<Kind> · Top pick"
  (`BEST_WORDS`) where another's says Play now or In the workshop. Nothing
  in `src/` calls the language's global random: the page has no chance.
- `src/build/` is build-time code that is not the thing: `picture-colour.ts`
  makes that small copy with `sharp` (Node, so not in `src/catalogue/`)
  and hands its pixels to `colour.ts`. `Card.astro` writes the answer on a
  late card's frame as `data-waiting`. `loops.ts` and `loop-address.ts` give
  an entry's `loop` or `heroLoop` (a path to a `.webm` in
  `src/content/loops/`, relative to its YAML) the hashed address the build
  made for it under `/_astro/`, as a picture has, and refuse by entry and
  field a path that names no file or not a `.webm` (`index.astro` checks
  every entry, listed or not). The address is written on the card as
  `data-loop`, and on a feature's section as `data-hero-loop`, which no
  browser fetches.
- `src/content/` is where the content lives: an entry a file, its
  picture, and `catalogue.json`, the one file that says which sites are
  listed (the `feature` and each row's `sites`), in which rows and in what
  order, and which shine (`best`). A site with a file that it does not name is not listed, and the
  build says so on its output ("Not listed in src/content/catalogue.json:
  ..."); nothing is deleted. `src/content.config.ts` tells
  Astro where each is and which of the catalogue's schemas it must meet.
- `src/layouts/`, `src/pages/`, `src/components/` and `src/scripts/` are
  **the page**. They draw what the catalogue returns and work nothing
  out. `Base.astro` is the head, skip link and header (the wordmark alone);
  `Footer.astro` (drawn by `Base` on every page: Privacy, the licences,
  Source); `OutsideLink.astro` and `NewWindowIcon.astro` draw a link that
  leaves the site (words: `NEW_WINDOW`, `rows.ts`); `index.astro`, `404.astro` and `privacy.astro` are the pages, `Feature`, `Row` and
  `Card` the parts, `robots.txt.ts` and `sitemap.xml.ts` the endpoints.
  `src/scripts/rows.ts` works each row's edge arrows (its Previous and Next,
  hidden from the tree where there is nothing that way), its page marks and
  the words that say the page, from `paging.ts`, brings a focused card that
  is not `whollyIn` its window to its own start, and marks the row
  `data-arrows` once it has, which is what hides the strip's scrollbar and
  what specs wait on to know script has run. The arrows take the top and
  height of the row's first picture by anchor positioning (`--row-frame`),
  16 by 9 where a browser cannot. **A strip rests on a card's start**
  however it is moved, with motion or without: `.strip` in `site.css` snaps
  `mandatory`, and its scroll padding is the gutter or an arrow's width
  (`--size-arrow-width`, never less than `--size-target`), whichever is
  wider, so a card at rest starts clear of Previous; the first card, at the
  strip's very start, rests at the gutter, where no Previous shows. `src/scripts/pictures.ts` brings in the
  pictures of the **late rows**
  (every row after the second, `LATE_ROWS_FROM` in `Row.astro`): a late
  card's `<picture>` holds its addresses in `data-` attributes and the
  ordinary picture sits beside it in a `<noscript>`, and an
  IntersectionObserver on each late row (`MARGIN`, 300px) moves them into
  `srcset` and `src`; it also checks each frame's `data-waiting` with
  `colour.ts` and sets `--waiting` through the CSSOM, and marks a picture
  `data-arrived` when it loads or fails. `src/scripts/drag.ts` lets a mouse drag a strip from `dragging.ts` (touch and pen are left to the browser). `src/scripts/moving.ts` reads the cards' live controls at each
  move and the gamepad (only while one is connected), and focuses, from
  `moving.ts`; its first button clicks a button (a flip button turns its
  card) and follows a link, opening a new window with `window.open` and
  going there in this one if the browser refuses. `src/scripts/asked.ts`
  reads, once, what the reader asked for (`lessMotion`, `savesData`), for
  both loops. Eight scripts are imported by the one script block in
  `index.astro`: `rows`, `pictures`, `drag`, `moving`, `flip`, `hero`,
  `playing` and `shine`. **The card:** `li.card` (`data-entry`,
  `data-linked`, `data-loop`, `data-best`) holds `div.card-faces` with
  `div.face.front` (the frame, the label, the `h3` title and
  `button.card-flip[hidden]` named `aboutName`, laid over the whole front)
  and `div.face.back` (the label and title again, marked `data-repeat`, the
  description, the one link `a.card-link.button`, "Play <title>" and the
  new-window icon, and `button.card-unflip[hidden]` named `closeName`, whose
  `::after` covers the back so a press outside Play is a Close). With script
  off the faces flow one under the other, the repeat is not drawn, and the
  link's `::after` covers the card, so the card is one link. `flip.ts` marks
  each card `data-flips` and shows its buttons, and works the press by
  `flipping.ts`: `data-flipped` on the card, `inert` on the face turned
  away, focus as the rule says, and `data-turns` from the first press, which
  is what lets a face turn (`rotateY`, `--duration-flip`, in the
  no-preference block only). Under `data-flips` the faces share one grid
  cell, so a card is as tall as its taller face and one size flipped or
  not; a strip stretches a row's cards level, and the front's frame takes
  the room left (never shorter than 16 by 9, the picture cropped at its
  sides to cover it). On a phone (21.25rem to 40rem) the back draws no
  repeat and Play draws "Play" and its icon, its name unchanged; a card is
  `--card-width-phone` (58vw) wide. **The card most in focus:**
  `src/scripts/playing.ts` reads the cards' boxes on scroll, resize, hover,
  focus, a flip, an arrival and the tab hidden, counts the settle on
  `requestAnimationFrame`, and keeps one `video.card-loop` (muted, looping,
  `playsinline`, `aria-hidden`), made with its `src` from the card's
  `data-loop` when the card is settled on (the first any browser hears of
  it) and taken down when another takes over or its card stops qualifying.
  Whether it plays, waits for Play or is never offered is `heroStart`'s,
  from `asked.ts`. The one Pause button (`button.card-pause` in a
  `.card-pause-place` laid over the picture) is made by script and moved
  to the front of the card in focus, after its flip button in the Tab
  order: a 44px square with a pause or play mark and its name hidden in it
  (`cardPauseWords`). A pause holds every card loop for the visit, kept
  nowhere. A loop that fails goes with its button and its card is not
  tried again. **The shine:** a best card carries `data-best` and an
  `aria-hidden` `span.foil` in its frame's cell: a band of the five
  `--color-foil-*` colours blended over the picture, a glare, and a foil
  edge just outside the card, never under a word, from
  `--shine-x`/`--shine-y` and a tilt of `.card-faces` from
  `--tilt-x`/`--tilt-y`, the four registered with `@property` in
  `tokens.css` so their first values are the resting place.
  `src/scripts/shine.ts` sets them through the CSSOM by the catalogue's rule, at most once a frame
  and only while a best card is in the window; under reduced motion it
  sets nothing, and forced colours draw no foil. House lights (`:has()`)
  dim the other pictures of a row while a card is hovered by a mouse or
  holds focus, foil and loop with them.
  **The moving hero:** the feature is a band across the window
  (`.feature`, at least `--height-hero` of its height and at most
  `--height-hero-max`) with its picture filling it (`sizes` is `100vw`,
  quality 40, said once in `Feature.astro`), its words on a solid panel at the
  lower left and the Pause button at the lower right (`FeatureWords.astro`),
  on one grid; below 64rem the picture is above the panel. Once the window's
  `load` event has come, `hero.ts` makes one `<video>` (muted, looping,
  `playsinline`, the still its poster) from the day's section's
  `data-hero-loop` and plays it; a hidden candidate's is never read. Pause
  holds and plays it, its words and `aria-label` (Pause/Play the title
  video) following the video's own state, with no `aria-pressed`; a pause
  holds for the visit and is kept nowhere. Reduced motion: no video, a button
  that reads Play and fetches the loop only when pressed. Save-Data or no
  `heroLoop`: the still alone and the button stays `hidden`. A loop that fails
  to load or play is taken down with its button. With script off: the still,
  the panel, no button. **The feature by the day:** with a list, `Feature.astro`
  writes a `section.feature` for each candidate (`data-place`, its own
  title id, all but the first `hidden`, pictures as a late card's, the
  first with a `<noscript>` picture), then one inline classic script,
  `src/scripts/today-inline.js`, which reads the clock once, shows the
  day's candidate and fills only its picture before first paint, with no
  help from the module. It says `today.ts`'s rule a second time (it cannot
  import), held equal by `today-inline.test.ts`. Astro hashes the scripts
  it bundles and not an `is:inline` one, so `astro.config.mjs` gives the
  policy that file's SHA-256 (`scriptDirective.hashes`, from
  `src/build/inline-script.ts`, the same file the page reads); with no
  list there is no script and no hash, and the page is as before. Building the catalogue in
  `index.astro` is also what stops the build on a broken one.
- `src/styles/tokens.css` says every colour, size and font once.
  `src/styles/site.css` reads them and holds no value of its own.
- `astro.config.mjs` holds the site's address, the fonts and the content
  policy's directives. `src/build/write-headers.mjs`, run as `postbuild`,
  hashes every inline script and style of every built page and writes
  `dist/_headers`: the one place the policy is sent from, `frame-ancestors`
  among it. `netlify.toml` holds the build and the other headers.
- `tests/unit/` is vitest. `tests/e2e/`, `tests/look/` and `tests/gates/`
  are Playwright (three projects), against the built site under
  `npm run preview`. `gates/` holds the weight baseline and its budgets,
  `scripts/` the two gates that need the network.
- `plans/` holds each plan, with its state line and its boxes.

**To set the features by the day:** `features` in `catalogue.json` is a
list of site ids (each with a file, none twice, none the `feature`); the
day's is `[feature, ...features]` at index whole days since 1970-01-01 UTC
modulo its length. `feature` is still what shows with script off and what
the social card uses. Empty or absent, the page is one feature as before.

**To set the best cards:** `best` in `catalogue.json` is a list of site
ids, each with a file, none twice, each in a row; those cards, wherever a
row draws them, carry the foil and "Top pick". Empty or absent, none shines.

**To list, unlist or move a site:** edit `src/content/catalogue.json`. A
new site also needs its `entries/<id>.yaml` and its picture in
`pictures/`. **To give a site a loop:** make it with
`npm run loops -- <id>`, have the owner approve it, copy it, bytes
unchanged, to `src/content/loops/<id>.webm` and name it in the site's YAML
as `loop: ../loops/<id>.webm`; a file that is missing or not `.webm` stops
the build and names the entry. A site with none keeps its picture, flips, and
never plays. **A site that may be the day's feature needs a hero loop** (960
wide) as well: `npm run loops -- <id>` makes both from one take; for one whose
card loop is approved already, `node tools/loops/hero-from-take.mjs <id>
<start second>` cuts it from the kept take in `tools/loops/out/work/<id>/`
at the second its card loop starts (found by matching the card loop's first
frame against the take's), so it is the approved loop at hero size; copy it,
bytes unchanged, to `src/content/loops/<id>.hero.webm` and name it `heroLoop:
../loops/<id>.hero.webm`. One more than 450,000 bytes fails `npm run weight`. Run `npm run check`. The look and weight baselines move when
the page does, and are then written again on purpose (`look:update`,
`weight:update`).

There is no persisted shape. What has been given out is an address: the
site's own, each row's anchor and each entry's id. They are kept, and
name a thing by what it is.

## Model features

- **Something the user sees:** `Card.astro`, held by `tests/e2e/page.spec.ts`
  (what a card draws and links), `flip.spec.ts` (its two faces: the flip by
  click, tap and Enter, what is in the tree, one size), `keyboard.spec.ts`
  (its ring and target) and `nojs.spec.ts` (one link with script off). Each
  spec counts what it reached.
- **The thing's logic:** `tests/unit/rows.test.ts`. It builds a small
  catalogue in the test, reads each refusal's message for the file and
  the id, and was mutation-checked by hand for each rule.
- **A gate to copy the shape of:** `tests/gates/weight.spec.ts`. The
  judging is a pure function in `judging.ts` with its own unit tests, the
  measuring is the spec, the baseline is a file written on purpose by a
  `:update` script, the wobble was measured and is written beside the
  tolerance, and it was seen failing on two faults put in on purpose.
- **A tool that measures:** `tests/unit/tokens.test.ts`. It reads the
  file as the build does, counts what it reached so that reading nothing
  is a failure, and was seen to fail with a token removed and with one
  said twice.

## The test API

A unit test imports from `src/catalogue/` and from `tokens.css` as text.
An end-to-end test opens the built site through Playwright's `baseURL`
(`playwright.config.ts`), on port 4390 (the config runs `astro preview
--ignore-lock`, since Astro 7 otherwise backgrounds the server and
Playwright reads that as it dying), which is this project's own so
that a test never meets a dev server on 4321. It never reuses a server
it finds there. The page is the same on every load: it has no chance.
What is in the accessibility tree is asked of the browser's own tree over
the DevTools protocol (`tests/e2e/tree.ts`), since Playwright's reading of
roles counts an `inert` face as there. `tests/e2e/card-loop.ts` brings a
card loop on in real time (the first row centred, the settle waited out)
for the specs that need one there; `playing.spec.ts` and `flip.spec.ts`
step the clock instead, as below. `moving.spec.ts` stands a gamepad in with
`addInitScript` (`navigator.getGamepads` returns what the test sets on
`window.__pad`: standard mapping, 17 buttons, 4 axes, and a count of
calls) and holds the clock with `page.clock.install` then `pauseAt`. Each
`runFor(16)` is one frame, since Playwright steps `requestAnimationFrame`,
`performance.now` and `Date` together, so the 400ms and 150ms are stepped;
`playing.spec.ts` steps the 600ms settle the same way, and asks a loop's
playing of the video (`currentTime`, `paused`), since media time is the
browser's.

**The clock.** With a list of features the page shows a different
feature each day, so every spec takes `test` from `tests/clock.ts` and
never from `@playwright/test` (`fixture-used.test.ts` fails for one that
does). Its auto fixture holds `Date` at noon on day 0 (1970-01-01 UTC,
which is the first candidate whatever the list's length) in every context,
before any page script runs, with `setFixedTime`: timers and frames still
run. A test that makes a context of its own calls `holdClock(context)`; a
test for another day calls `page.clock.setFixedTime(noonOf(day))` before
`goto`. `moving.spec.ts` and `playing.spec.ts` install the stepped clock
themselves on day 0, which replaces the held one.

## Edge cases

Every new thing is taken through each of these that it can reach.

- With script and without it. Late pictures arrive by script when it is on
  and from the `<noscript>` when it is off; each must be whole, and a card
  has exactly one picture in the accessibility tree either way.
- With script a row has no scrollbar and moves by its edge arrows, with
  script off it keeps its scrollbar and has no arrows or marks (a mouse
  with no sideways wheel has no other way along). Below 340px a row stacks
  and has neither. At rest after an arrow press, a swipe, a wheel, a drag or
  a key, with motion and without, no card wholly in the window has any of
  itself under an arrow that shows, outside the bands named under What is
  not held: try each side of 40rem and 64rem, and of a band.
- A mouse, a touch screen and a pen: only a mouse drags a strip, and a
  press that does not move is a click.
- By keyboard alone: order, a visible focus ring, nothing trapped. With
  focus on a card's live control or the feature's link, arrows move it and
  are the grid's even at an end; on a strip, a footer link, a row arrow or
  with a modifier, they are the browser's.
- A card flipped: by click, tap and Enter, turned back by Close, a press on
  the back and Escape; one flipped at a time; focus to Play (Close with no
  link) and back to the flip button; the face away inert and out of the
  tree; one size flipped or not, at a desk and a phone; reduced motion (the
  faces swap at once); a late card before and after its picture; text
  spacing with a card flipped; script off (no flip, one link).
- The card most in focus playing: none while the hero's half shows, none
  short of the settle, none for a flipped card or one whose picture has not
  come; mouse and focus taking over; Pause holding every card for the visit
  and Play; reduced motion (Play, fetched on press), Save-Data (nothing), a
  loop that fails, a late row, a touch screen, script off.
- The shine: the three best cards and no other; a mouse (sheen and tilt),
  touch (sheen by place, no tilt), reduced motion (still), script off (a
  still foil), forced colours (none); never under words.
- The date, with a list of features: each place in the list, 60 days
  running, the first and last millisecond of a day, a zone far either side
  of UTC (the day changes at midnight UTC for everyone), and the module
  never loading. Exactly one feature is in the accessibility tree.
- A gamepad: none connected reads nothing; connected, one read a frame;
  disconnected, none.
- A desk's width, a phone's (390px), 320px, 640px standing in for 200%
  zoom, and each side of every step in `site.css`: a fault can sit
  between two widths that both pass. WCAG 1.4.12 text spacing.
- `prefers-reduced-motion`: motion exists only inside a `no-preference`
  block.
- `forced-colors`.
- The hero, on each feature day: a loop never asked for before `load` nor a
  hidden candidate's; Pause by click and by Enter; reduced motion, Save-Data,
  script off, a loop that fails; at 390 the picture above the panel.
- A card hovered (mouse) and focused (Tab): the others in its row dim,
  nothing else does, text stays 7:1. A tap on touch dims nothing.
- An entry with an address and one without. A link inside the site and
  one that leaves it (new window). A row that overflows and one
  that fits. A long title, a long description.
- A picture slow to arrive or missing: the words still stand.
- The 404 page and the privacy page.

## Gates

| Gate                                | What it holds today                                    |
| ----------------------------------- | ------------------------------------------------------ |
| `npm run secrets`                   | nothing staged looks like a key                        |
| `prettier --check .`                | one formatter decides every file it should             |
| `npm run types`                     | no type error in `.astro` or `.ts`                     |
| `npm run lint`                      | type-aware mistakes in `.ts`                           |
| `tests/unit/tokens.test.ts`         | the five colours and the foil's, each said once        |
| `tests/unit/contrast.test.ts`       | listed pairs: text 7:1, edges and rings 3:1            |
| `tests/unit/schema.test.ts`         | an entry and the rows file refused by path or name     |
| `tests/unit/rows.test.ts`           | the page's model, best, the words, refusals            |
| `tests/unit/catalogue-file.test.ts` | the real catalogue.json and its site files             |
| `tests/unit/structure.test.ts`      | `src/catalogue` imports only `astro/zod`; no           |
|                                     | global random anywhere in `src/`                       |
| `tests/unit/colour.test.ts`         | the colour check: one spelling, nothing else passes    |
| `tests/unit/paging.test.ts`         | the paging rule, a pixel of tolerance; `whollyIn`      |
| `tests/unit/flipping.test.ts`       | every press from every state: flipped, focus           |
| `tests/unit/playing.test.ts`        | which card plays, the hero's half, the 600ms settle    |
| `tests/unit/shine.test.ts`          | the sheen's place and the tilt, clamped; at rest       |
| `tests/unit/hero.test.ts`           | the start rule, every case; both buttons' words        |
| `tests/unit/loop-address.test.ts`   | a loop's built address; a missing file, by entry       |
| `tests/unit/moving.test.ts`         | where a move lands, the pad's direction, the repeat    |
| `tests/unit/dragging.test.ts`       | the drag rule: threshold, direction, both ends         |
| `tests/unit/today.test.ts`          | the day's index: day 0, steps, wraps, UTC, refusals    |
| `tests/unit/fixture-used.test.ts`   | no spec takes `test` from `@playwright/test`           |
| `tests/unit/today-inline.test.ts`   | the inline script equals the rule, many dates          |
| `tests/unit/inline-script.test.ts`  | the policy's hash is the script file's, if listed      |
| `tests/unit/favicon.test.ts`        | the icon's colours equal the tokens'                   |
| `tests/unit/weight-judging.test.ts` | counts, both ways, the four budgets, card loops        |
| `tests/unit/headers-build.test.ts`  | the `_headers` step: union, hashes, what stops it      |
| `tests/e2e/page.spec.ts`            | the model drawn, labels, head, 404, footer, header     |
| `tests/e2e/privacy.spec.ts`         | the privacy page: sections, links, 80-character line   |
| `tests/e2e/rows.spec.ts`            | edge arrows, marks and words, ends; a phone's rows     |
| `tests/e2e/arrows.spec.ts`          | at rest no card wholly in is under an arrow: presses   |
|                                     | to each end and back, 341 to 1920, both motions; swipe |
| `tests/e2e/drag.spec.ts`            | a mouse drag, nothing flipped; touch left alone        |
| `tests/e2e/late.spec.ts`            | late rows: unfetched, then fetched by scroll,          |
|                                     | address, Tab, print, no observer; no address in markup |
| `tests/e2e/keyboard.spec.ts`        | real Tab: order, ring, uncovered; 44px; arrows, Pause  |
| `tests/e2e/moving.spec.ts`          | arrows through live controls; a stood-in pad, stepped  |
| `tests/e2e/contrast.spec.ts`        | drawn text 7:1 (large 4.5:1), Tab rings and Pause 3:1  |
| `tests/e2e/motion.spec.ts`          | all motion in no-preference; loop and shine still      |
| `tests/e2e/axe.spec.ts`             | axe, WCAG 2.0-2.2, best practice; flipped, playing     |
| `tests/e2e/policy.spec.ts`          | the meta policy's script-src has no unsafe-*           |
| `tests/e2e/header-policy.spec.ts`   | `_headers`: all hashes in; pages run under it, and     |
|                                     | the hero and a card loop play under Permissions-Policy |
| `tests/e2e/today.spec.ts`           | the day's feature: four places, one picture fetched,   |
|                                     | no module, UTC, script off, arrows, clean console      |
| `tests/e2e/reflow.spec.ts`          | each side of every layout step, 320 to 1440, spaced    |
| `tests/e2e/nojs.spec.ts`            | whole with script off: a card one link, no flip        |
| `tests/e2e/waiting.spec.ts`         | waiting frames: colour, arrival, ease, bad colour      |
| `tests/e2e/flip.spec.ts`            | the flip and back, one at a time, tree, one size       |
| `tests/e2e/playing.spec.ts`         | the card in focus plays, stepped; Pause; when not      |
| `tests/e2e/shine.spec.ts`           | three best cards: foil, label, sheen, tilt, still      |
| `tests/e2e/hero.spec.ts`            | the moving hero, each feature day: load, Pause, off    |
| `tests/e2e/lights.spec.ts`          | a hovered or focused card dims its row; a tap does not |
| `tests/e2e/origin.spec.ts`          | own origin only, clean console, a loop; nothing stored |
| `tests/e2e/windows.spec.ts`         | outside links: target, rel, name, icon; one new page   |
| `tests/look/look.spec.ts`           | seventeen pictures of the built site, as written       |
| `tests/gates/weight.spec.ts`        | requests and bytes by kind, 1440 (three days), 390;    |
|                                     | hero and card loops apart, each to its own budget      |
| `scripts/links.mjs`                 | no card's address is gone (network; not in check)      |
| `scripts/headers.mjs`               | a live address sends the whole policy (not in check)   |

Where the figures are kept, never here. The look's baselines are the
pictures in `tests/look/baselines/` and its tolerance and the wobble
measured for it are `TOLERANCE` in `tests/look/look.spec.ts`. The weight's
baseline and its budgets are `gates/weight.json`; its tolerance (0, bytes
held exactly, with the evidence) is `TOLERANCE` in
`tests/gates/weight.spec.ts`. The budgets there are agreed figures, set
by the owner on 2026-11-22, the card loop's on 2026-11-23. The privacy page's words are the owner's, and
the date they were last reviewed is the last paragraph of
`src/pages/privacy.astro`: move it when they are read again. The contrast pairs are `TEXT` and `EDGES` in
`tests/unit/contrast.test.ts`.

## Done, here

The nine points of the definition of done, as this project has them.

1. Acceptance criteria are tests: `tests/unit/` for the catalogue,
   `tests/e2e/` for the page.
2. The edge cases above.
3. `npm run check`.
4. End to end is Playwright against the built site, working each control
   as a user does: a real Tab, a real click.
5. There is no fuzzer. See below.
6. Performance is page weight: `npm run weight`.
7. Looked at headless, at a desk's width, a phone's and 320px.
8. A new test is seen to fail with its fault put back.
9. What was not verified is said.

## What is not held

- **No fuzzer or saved shape,** and time is stepped only for the gamepad,
  the card loops' settle and the flip. A static page has no use for them.
  The catalogue's refusals at build are to stand in for "what comes from
  outside is checked". **There is no chance on the page** since Surprise me
  went, so there is no seed. Focus moved by script
  after a mouse press is ringed through `focus({ focusVisible: true })`,
  which Chromium honours and Safari and Firefox are not seen to.
- **The hero is seen in Chromium alone.** Safari's autoplay and a real phone
  are not tried. `autoplay=()` was found not to stop a muted video in this
  Chromium (a test page played under it, with and without the user-activation
  flag), so the `Permissions-Policy` change to `autoplay=(self)` is held by
  its text and by the hero playing under it, and by no browser that refuses
  it. The weight gate measures three days at a desk's width and one at a
  phone's, once the network is quiet; it times no start and counts nothing
  after (a reader pausing, reduced motion, Save-Data, scrolling).
- **A real touch device and Safari's video are not tried.** The loops are
  WebM (VP9): Chromium plays them here, and Safari 16+ and Firefox are only
  read of (caniuse), not seen. The loops are recordings of other sites made on
  one day and do not change when those sites do. Playwright's media time is
  the browser's and not the clock's, so a loop's playing is asked of the
  video (`currentTime`, `paused`), and the card-loop look pictures hold the
  loop paused at 2.0 s. A card that plays again asks the browser for its
  loop again (the video is taken down, not kept); Netlify's `immutable`
  header on `/_astro/*` is what answers that from cache, and nothing here
  reads it. Autoplay of a card loop is held as the hero's is, in Chromium.
- **Save-Data and touch are stood in** (the page's `navigator.connection`
  made to say so; a touch context and a dispatched `pointerenter`), not real;
  no real phone has been tried.
- **With a list of features the big picture is found by the inline
  script and not by the browser's look-ahead,** so it may start a moment
  later; nothing times that (the weight gate counts requests and bytes). A
  browser that blocks inline scripts (the hash is what allows it; seen with
  the script taken out) shows the first candidate with its words and link,
  and in its frame a broken-image mark with the picture's alt words in the
  panel colour, for good. The day changes at midnight UTC and only on a
  load: a page left open does not change.
- **Headers as served.** Nothing here meets Netlify. `dist/_headers` is
  read as text and, in `header-policy.spec.ts`, added to each document by
  the test itself, since the preview sends none. That Netlify sends it, and
  that `netlify.toml` leaves it alone, is read only by `npm run headers`
  against the live address, after a deploy.
- **The page Netlify serves is not quite the page built.** Netlify adds
  its "Powered by Netlify" badge script (`/.netlify/scripts/hud`) to every
  page at its edge. The content policy refuses the frame it draws in, so
  no badge shows and a live console has two Trusted Types refusals a page:
  Netlify's own docs say a policy without `'unsafe-inline'` does this and
  that nothing else is affected. No local test sees that script. The
  badge is switched off in Netlify (Project configuration, General) where
  the plan allows.
- **A card half cut off at a strip's edge is brought into view by
  script only.** With script off, Tab leaves it part hidden (the arrow
  keys scroll the strip).
- **The secret scan reaches only what is staged,** so run by hand outside
  a commit it scans nothing and passes. The history is not scanned.
- **The entries' YAML is held by the build alone.** No unit test parses
  it, since that would need a dependency the project does not have; a
  refusal there is a failed `npm run build`. `catalogue.json` is held by
  `catalogue-file.test.ts`. A site left out of it by accident is only
  said on the build's output, and nothing fails.
- **No licence or unused-dependency check.** `npm run audit` is by hand.
- **Late rows' pictures depend on script when it is on.** If
  `pictures.ts` fails to run (an error, a blocked file) the late rows
  keep their panel colour and no picture; the words stand and nothing
  holds that case. The waiting colour's rule is held by unit tests on
  made-up pixels; against the real pictures only the look picture shows
  it. `loading="lazy"` alone does not wait (Chromium fetched
  rows 2000px down), so the weight gate is what holds the waiting, by
  count and by the budget. It measures the home page alone and times no
  load or interaction.
- **The look is one machine's.** Its baselines are this Mac's Chromium
  and were looked at by one person, once. Another GPU or font stack would
  draw them a little differently. Nothing holds the 640 or forced-colors
  pictures. A whole page is pictured in a window as tall as the page, never
  with Playwright's full-page shot, which collapses the window's width as
  it captures and made one card draw from a different file by chance
  (`openWhole` in `tests/look/look.spec.ts` has the measurements).
- **House lights need `:has()`.** A browser without it shows no dimming,
  which is the page as it was, and has no fallback. Nothing holds a real
  touch device: the tap test is Chromium's mobile emulation, and no row of
  the catalogue mixes linked and unlinked cards, so that test makes one in
  the page.
- **Contrast of a hovered card's edge** (accent over a picture) is held
  by no gate, since no token says what is under it.
- **axe's incompletes** are attached to its report, counted and not
  failed; they are not read by anything.
- **Drag by a real mouse and a real touch screen.** The drag is tried
  with Playwright's mouse, and touch and pen with dispatched pointer
  events, which scroll nothing. How it feels is a person's to try.
- **Whether a real browser lets a gamepad's button open a window is not
  known.** `moving.ts` falls back to this window; a test stands in a
  refusal. Nothing here tries a real pop-up blocker.
- **One browser, Chromium, on one machine.** Firefox, Safari and a real
  phone are not looked at. A screen reader is a person's to try.
- **Node.** This machine runs 23.4.0, which vitest 5.1.1 does not list
  and on which npm 10.9.2 needed `--legacy-peer-deps` to install it.
  Netlify builds on 22. Neither has been seen to matter.
- **The fonts have no metric-matched fallback** (`optimizedFallbacks` is
  off, since the build fails with it on), so text may shift as they
  arrive.
- **No real controller has been tried.** The stand-in proves the reading
  and the timing, not a device. The standard mapping is assumed (d-pad
  buttons 12 to 15, left stick axes 0 and 1, first button 0); a pad with
  another mapping is ignored. The owner is to try one.
- **No mutation gate.** Mutations are by hand, and reported.
- **The cards were seen in Chromium alone.** A real phone, a real touch
  flip, Safari's and Firefox's video and autoplay, anchor positioning (the
  arrows' height; a browser without it has the 16 by 9), `@property` and the
  foil's blend and mask are not seen elsewhere. A screen reader hearing the
  flip, the face away being inert and the Pause button's name is a
  person's to try; the tree is read from Chromium's own. Forced colours as
  drawn are not pictured. When the cards' Pause button has focus and its
  card scrolls away, the button goes with the card in focus and focus drops
  to the page; nothing holds where it should go. A focused card at a desk's
  width is brought to its own start, which may move a row more than a
  reader expects; nothing pictures it.
- **A phone card's picture is cropped** at its sides to fill the room its
  row's tallest back leaves: the back's description lines and the Play
  link set it. At 390 More to play shows 63% of each picture's width, its
  tallest card Fruit Machine, with seven lines of description.
- **In four bands of window width a card at rest can have an edge under an
  arrow.** Where a desk's card is 17rem (a window under about 1070px) or
  25rem (over about 1574px), a window whose width leaves a card ending
  within an arrow's width of its right edge has that card wholly in and its
  last few px, up to 55, under Next at the strip's start, at the mirror
  place under Previous at its end, and at a rest part way. At the strip's
  start and end the strip cannot be anywhere else, so no snap or padding
  mends it; only the card's width or the arrows', which the owner has
  accepted, could. Measured without a scrollbar, by setting each rest's
  scroll from 341 to 2600: 649 to 709, 959 to 1019, 1814 to 1873 and 2260 to
  2319 (a classic scrollbar moves each up by its width, 15px). The phone's
  widths, 341 to 640, have none. `arrows.spec.ts` tries each side of the
  first two (645, 715, 955, 1023) and nothing holds a band itself.

- **A scrollbar is only seen with flags.** Headless Chromium on this Mac
  draws none, so `rows.spec.ts` and `nojs.spec.ts` launch with
  `--disable-features=OverlayScrollbar` and without `--hide-scrollbars`;
  the look pictures draw none either way.
- **Only an arrow press is told to a screen reader.** The page's one
  polite live region (`data-rows-live`, in `index.astro`) is empty until a
  press has settled (`scrollend`), then holds the row's words; a wheel, a
  drag or a key on the strip is silent, and a browser with no `scrollend`
  is told at once, with where the press is going. The marks and arrows are
  not seen by any screen reader test here.

## Keeps

What `/ooer-design:polish` or a reader may question, kept on purpose.

- **One theme, dark.** The pictures are the colour, and the look the owner
  chose from the mocks (`plans/first-site-look/`) is a cinema listing.
- **`--color-text` is a warm off-white.** The scanner reads it as a cream.
  It is the ink on a dark ground and never a ground itself.
- **The waiting colours are not tokens.** They are each picture's own,
  worked out at build, carry no words and no meaning, and are mixed with
  the panel token by `--share-waiting` so they stay inside the dark look.
- **No print styles.** Preflight asks for them, and the page is not one to
  print.
- **The foil has more colours than the look's five** (`--color-foil-*`), on
  three cards only. They are decoration and say nothing by themselves:
  "Top pick" says it beside them, in words, and replaces Play now in a best
  card's label.
- **The cards' Pause button is a mark** with its name hidden in it, where
  the hero's is a word: it sits on a small picture, and a word would cover
  it.

## How a change lands

- **Merge style:** a merge commit.
- **What an agent may do without asking:** commit locally. Pushing,
  opening a PR, merging and tagging are each asked for, each time. These
  are the kit's defaults, taken until the owner says otherwise.
- **Stale after:** 30 days.
- The remote is `https://github.com/onion2k/flix.git`. Netlify builds
  `main`, so a push there is a public deploy.
