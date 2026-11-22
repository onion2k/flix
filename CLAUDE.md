# Ooerflix

A static website that shows the games and toys its owner builds, as a
featured entry and rows of large cards that scroll sideways. It is built
with Astro into plain files and served by Netlify from `main`, at
`https://flix.ooer.com`. There is no server and no saved state.

This file says how the project is changed. It was written on 2026-11-22
from commit `d955f12`, when only the scaffold existed, and each part of
`plans/first-site.md` moves it on as it lands. How work is done is the
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
    npm run look         the ten pictures, tests/look, against baselines
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
  scroll position, whether its Previous and Next buttons are live and
  where each goes. `dragging.ts` says, from a mouse's press and where it is now, whether that is a drag and where the strip is then scrolled. `colour.ts` says whether text is a colour the page may
  use (`#` and six lower-case hex digits, nothing else), and works out the
  colour a picture waits in from the pixels of a small copy of it.
  `moving.ts` says where an arrow-key or gamepad move lands among the
  links, which direction a pad holds, and when a held one fires (time
  handed in). `chance.ts` is the one source of chance: a seeded generator
  (mulberry32), `pick` (one id that is not excluded, with the random
  handed in), and `seedFrom` (a seed from outside, or the clock's reading
  handed in). Nothing in `src/` calls the language's global random.
  `today.ts` says which candidate is the day's feature, from a count and
  the clock's reading handed in (whole days since 1970-01-01 UTC, modulo
  the count). `buildPage` returns `candidates`: `feature`, then the
  optional `features` list of `catalogue.json`, each refused by name if it
  has no file, repeats or is `feature` itself. `preview.ts` says which of
  a card's previews shows, from how long it has been hovered or focused
  (time handed in): none for 600ms, then each for 1000ms, then none for
  good, so under 5s for the four an entry's `previews` may hold.
- `src/build/` is build-time code that is not the thing: `picture-colour.ts`
  makes that small copy with `sharp` (Node, so not in `src/catalogue/`)
  and hands its pixels to `colour.ts`. `Card.astro` writes the answer on a
  late card's frame as `data-waiting`.
- `src/content/` is where the content lives: an entry a file, its
  picture, and `catalogue.json`, the one file that says which sites are
  listed (the `feature` and each row's `sites`), in which rows and in what
  order. A site with a file that it does not name is not listed, and the
  build says so on its output ("Not listed in src/content/catalogue.json:
  ..."); nothing is deleted. `src/content.config.ts` tells
  Astro where each is and which of the catalogue's schemas it must meet.
- `src/layouts/`, `src/pages/`, `src/components/` and `src/scripts/` are
  **the page**. They draw what the catalogue returns and work nothing
  out. `Base.astro` is the head, skip link and header;
  `Footer.astro` (drawn by `Base` on every page: Privacy, the licences,
  Source); `OutsideLink.astro` and `NewWindowIcon.astro` draw a link that
  leaves the site (words: `NEW_WINDOW`, `rows.ts`); `index.astro`, `404.astro` and `privacy.astro` are the pages, `Feature`, `Row` and
  `Card` the parts, `robots.txt.ts` and `sitemap.xml.ts` the endpoints.
  `src/scripts/rows.ts` works the row buttons from `paging.ts`, and
  `src/scripts/pictures.ts` brings in the pictures of the **late rows**
  (every row after the second, `LATE_ROWS_FROM` in `Row.astro`): a late
  card's `<picture>` holds its addresses in `data-` attributes and the
  ordinary picture sits beside it in a `<noscript>`, and an
  IntersectionObserver on each late row (`MARGIN`, 300px) moves them into
  `srcset` and `src`; it also checks each frame's `data-waiting` with
  `colour.ts` and sets `--waiting` through the CSSOM, and marks a picture
  `data-arrived` when it loads or fails. `src/scripts/drag.ts` lets a mouse drag a strip from `dragging.ts` (touch and pen are left to the browser). `src/scripts/moving.ts` reads the links' places at each
  move and the gamepad (only while one is connected), and focuses, from
  `moving.ts`; its first button opens a link's new window with
  `window.open`, and goes there in this one if the browser refuses. `src/scripts/surprise.ts` works the header's Surprise me
  button (in `Base.astro`, `hidden` until script shows it, and only
  where two or more cards have a link): it picks with `chance.ts`, never
  the card focus came from nor the last pick, and focuses its link. It is
  the one place the generator is made and (with the next) the clock is
  read. `src/scripts/preview.ts` plays a card's previews (below). All six
  are imported by the one script block in
  `index.astro`. **Previews:** an entry's `previews` are drawn by
  `Previews.astro` as a `.previews` layer in the card's frame (a card
  with previews gets a `div.frame`; `aria-hidden`, empty alt, WebP at
  480 and 800, addresses in `data-preview-src(set)`, which `pictures.ts`
  does not take). `preview.ts` starts a pass on a mouse (`pointerType`
  mouse, `(hover: hover) and (pointer: fine)`) entering the card or
  `:focus-visible` on its link; it moves the addresses to `src` after the
  600ms pause, once, marks one preview `data-showing` a frame at a time,
  and does nothing for reduced motion, Save-Data, touch or a card whose own
  picture has not arrived. The same `Previews.astro` writes a `.cue` bar
  (a `.segment` for the card's picture and one a preview; `aria-hidden`,
  `hidden`), which `preview.ts` shows only where the previews could play
  and marks the lit segment `data-lit` (the first at rest). **The feature by the day:** with a list, `Feature.astro`
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

**To list, unlist or move a site:** edit `src/content/catalogue.json`. A
new site also needs its `entries/<id>.yaml` and its picture in
`pictures/`. **To give a site previews:** put one to four WebP files, 1280
wide, in `src/content/pictures/previews/` (named `<id>-1.webp` and so on)
and list them in order under `previews:` in its YAML; a fifth or a missing
file stops the build. Run `npm run check`. The look and weight baselines move when
the page does, and are then written again on purpose (`look:update`,
`weight:update`).

There is no persisted shape. What has been given out is an address: the
site's own, each row's anchor and each entry's id. They are kept, and
name a thing by what it is.

## Model features

- **Something the user sees:** `Card.astro`, held by `tests/e2e/page.spec.ts`
  (what a card draws and links) and `keyboard.spec.ts` (its ring and
  target). Each spec counts what it reached.
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
it finds there. The page is the same on
every load except for chance: `window.ooerflixSeed`, a number set by
`addInitScript` before the page's scripts run, seeds Surprise me
(`surprise.spec.ts`); anything but a safe integer is ignored and the
clock's reading is used (`page.clock.setFixedTime` holds that). It is the
only way chance is handed in. `moving.spec.ts` stands a gamepad in with
`addInitScript` (`navigator.getGamepads` returns what the test sets on
`window.__pad`: standard mapping, 17 buttons, 4 axes, and a count of
calls) and holds the clock with `page.clock.install` then `pauseAt`. Each
`runFor(16)` is one frame, since Playwright steps `requestAnimationFrame`,
`performance.now` and `Date` together, so the 400ms and 150ms are stepped.

**The clock.** With a list of features the page shows a different
feature each day, so every spec takes `test` from `tests/clock.ts` and
never from `@playwright/test` (`fixture-used.test.ts` fails for one that
does). Its auto fixture holds `Date` at noon on day 0 (1970-01-01 UTC,
which is the first candidate whatever the list's length) in every context,
before any page script runs, with `setFixedTime`: timers and frames still
run. A test that makes a context of its own calls `holdClock(context)`; a
test for another day calls `page.clock.setFixedTime(noonOf(day))` before
`goto`. `moving.spec.ts` installs the stepped clock itself at time 0 (also
day 0), which replaces the held one, and `surprise.spec.ts` sets its own
time, which wins, since the later call does.

## Edge cases

Every new thing is taken through each of these that it can reach.

- With script and without it. Late pictures arrive by script when it is on
  and from the `<noscript>` when it is off; each must be whole, and a card
  has exactly one picture in the accessibility tree either way.
- A mouse, a touch screen and a pen: only a mouse drags a strip, and a
  press that does not move is a click.
- By keyboard alone: order, a visible focus ring, nothing trapped. With
  focus on a link in the grid, arrows move it and are the grid's even at
  an end; on a strip, a nav link, a button or with a modifier, they are
  the browser's.
- Surprise me: shown only with script and two or more linked cards; never
  the card focus came from, the last pick or an unlinked card; a pick in a
  late row loads that row.
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
- A card with previews: hovered or focused it plays once, after 600ms, in
  under 5s; leaving stops it; and with reduced motion, Save-Data, touch
  or its own picture not yet arrived it does nothing and fetches nothing;
  its bar of segments shows only where it could play, lit with the pass.
- A card hovered (mouse) and focused (Tab), and a tap on touch: the others
  in its row dim, nothing else does, text stays 7:1.
- An entry with an address and one without. A link inside the site and
  one that leaves it (new window). A row that overflows and one
  that fits. A long title, a long description.
- A picture slow to arrive or missing: the words still stand.
- The 404 page and the privacy page.

## Gates

| Gate                                | What it holds today                                  |
| ----------------------------------- | ---------------------------------------------------- |
| `npm run secrets`                   | nothing staged looks like a key                      |
| `prettier --check .`                | one formatter decides every file it should           |
| `npm run types`                     | no type error in `.astro` or `.ts`                   |
| `npm run lint`                      | type-aware mistakes in `.ts`                         |
| `tests/unit/tokens.test.ts`         | each colour token defined once, as the plan says     |
| `tests/unit/contrast.test.ts`       | listed pairs: text 7:1, edges and rings 3:1          |
| `tests/unit/schema.test.ts`         | an entry and the rows file refused by path or name   |
| `tests/unit/rows.test.ts`           | the page's model, refusals, the not listed           |
| `tests/unit/catalogue-file.test.ts` | the real catalogue.json and its site files           |
| `tests/unit/structure.test.ts`      | `src/catalogue` imports only `astro/zod`; no global  |
|                                     | random anywhere in `src/`                            |
| `tests/unit/chance.test.ts`         | the seeded run, pick's exclusions and fairness       |
| `tests/unit/colour.test.ts`         | the colour check: one spelling, nothing else passes  |
| `tests/unit/paging.test.ts`         | the paging rule, with a pixel of tolerance           |
| `tests/unit/preview.test.ts`        | the preview rule: pause, turns, end, under 5s        |
| `tests/unit/moving.test.ts`         | where a move lands, the pad's direction, the repeat  |
| `tests/unit/dragging.test.ts`       | the drag rule: threshold, direction, both ends       |
| `tests/unit/today.test.ts`          | the day's index: day 0, steps, wraps, UTC, refusals  |
| `tests/unit/fixture-used.test.ts`   | no spec takes `test` from `@playwright/test`         |
| `tests/unit/today-inline.test.ts`   | the inline script equals the rule, many dates        |
| `tests/unit/inline-script.test.ts`  | the policy's hash is the script file's, if listed    |
| `tests/unit/favicon.test.ts`        | the icon's colours equal the tokens'                 |
| `tests/unit/weight-judging.test.ts` | the weight rule: counts, both ways, budgets          |
| `tests/unit/headers-build.test.ts`  | the `_headers` step: union, hashes, what stops it    |
| `tests/e2e/page.spec.ts`            | the model drawn, pictures, links, head, 404, footer  |
| `tests/e2e/privacy.spec.ts`         | the privacy page: sections, links, 80-character line |
| `tests/e2e/rows.spec.ts`            | the row buttons, at both ends, and a fitting row     |
| `tests/e2e/drag.spec.ts`            | a mouse drag, no link followed; touch left alone     |
| `tests/e2e/late.spec.ts`            | late rows: unfetched, then fetched by scroll, link,  |
|                                     | Tab, print, no observer; markup holds no address     |
| `tests/e2e/keyboard.spec.ts`        | real Tab: order, ring, uncovered; 44px (card, link)  |
| `tests/e2e/moving.spec.ts`          | arrow keys through the grid; a stood-in pad, stepped |
| `tests/e2e/contrast.spec.ts`        | drawn text 7:1 (large 4.5:1), each Tab ring 3:1      |
| `tests/e2e/motion.spec.ts`          | every CSSOM rule with motion sits in no-preference   |
| `tests/e2e/axe.spec.ts`             | axe, WCAG 2.0-2.2 and best practice, no violation    |
| `tests/e2e/policy.spec.ts`          | the meta policy's script-src has no unsafe-*         |
| `tests/e2e/header-policy.spec.ts`   | `_headers`: all hashes in; pages run under it        |
| `tests/e2e/today.spec.ts`           | the day's feature: four places, one picture fetched, |
|                                     | no module, UTC, script off, arrows, clean console    |
| `tests/e2e/reflow.spec.ts`          | each side of every layout step, 320 to 1440, spaced  |
| `tests/e2e/nojs.spec.ts`            | the page whole with script off                       |
| `tests/e2e/waiting.spec.ts`         | waiting frames: colour, arrival, ease, bad colour    |
| `tests/e2e/surprise.spec.ts`        | Surprise me: seeded picks, what it leaves out        |
| `tests/e2e/preview.spec.ts`         | a pass and its bar, stepped; where they must not run |
| `tests/e2e/lights.spec.ts`          | a hovered or focused card dims its row's pictures    |
| `tests/e2e/origin.spec.ts`          | own origin only, clean console; nothing stored       |
| `tests/e2e/windows.spec.ts`         | outside links: target, rel, name, icon; one new page |
| `tests/look/look.spec.ts`           | eleven pictures of the built site, as written        |
| `tests/gates/weight.spec.ts`        | requests and bytes by kind, at 1440 and 390          |
| `scripts/links.mjs`                 | no card's address is gone (network; not in check)    |
| `scripts/headers.mjs`               | a live address sends the whole policy (not in check) |

Where the figures are kept, never here. The look's baselines are the
pictures in `tests/look/baselines/` and its tolerance and the wobble
measured for it are `TOLERANCE` in `tests/look/look.spec.ts`. The weight's
baseline and its budgets are `gates/weight.json`; its tolerance (0, bytes
held exactly, with the evidence) is `TOLERANCE` in
`tests/gates/weight.spec.ts`. The budgets there are agreed figures, set
by the owner on 2026-11-22. The privacy page's words are the owner's, and
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

- **No fuzzer or saved shape,** and time is stepped only for the gamepad.
  A static page has no use for them. The catalogue's refusals at build are
  to stand in for "what comes from outside is checked". **Chance is seeded
  in one place**: Surprise me, from `window.ooerflixSeed` or the clock, and
  held by the same seed giving the same picks. Nothing else on the page is
  random. A fresh visit with no seed is different each time, and no pick is
  remembered between visits (nothing is stored). Focus moved by script
  after a mouse press is ringed through `focus({ focusVisible: true })`,
  which Chromium honours and Safari and Firefox are not seen to.
- **A keyboard cannot reach an unlinked card,** so its previews (Snappy's)
  are seen by mouse alone. Save-Data and touch are stood in (the page's
  `navigator.connection` made to say so; a touch context and a dispatched
  `pointerenter`), not real; no real phone has been tried. A preview that
  arrives after its turn has begun shows for what is left of it.
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

## How a change lands

- **Merge style:** a merge commit.
- **What an agent may do without asking:** commit locally. Pushing,
  opening a PR, merging and tagging are each asked for, each time. These
  are the kit's defaults, taken until the owner says otherwise.
- **Stale after:** 30 days.
- The remote is `https://github.com/onion2k/flix.git`. Netlify builds
  `main`, so a push there is a public deploy.
