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
    npm run build        the site, as files in dist/
    npm run preview      the built site, at http://localhost:4390
    npm run check:quick  the pre-commit hook: see below
    npm run test:e2e     Playwright, tests/e2e, against the built site:
                         the page, contrast as drawn, motion, axe, policy
    npm run look         the eight pictures, tests/look, against baselines
    npm run look:update  writes them again, for a change meant to move them
    npm run weight       page weight, tests/gates, against gates/weight.json
    npm run weight:update  writes that baseline again, on purpose
    npm run check        the quick check, a build, e2e, look, weight (~20s)
    npm run format       the formatter, writing

Two gates need the network and so are not in `check`; run them before a
publish, with a build made:

    npm run links        every https address a card links to is alive (a
                         gone one fails; others are listed as unverified)
    npm run headers -- <address>   the live address sends a CSP with
                         frame-ancestors, HSTS, nosniff, a referrer policy
                         and X-Frame-Options (the local preview sends none)
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
  where each goes. `colour.ts` says whether text is a colour the page may
  use (`#` and six lower-case hex digits, nothing else).
- `src/build/` is build-time code that is not the thing: `dominant-colour.ts`
  reads a picture file's dominant colour with `sharp` (Node, so not in
  `src/catalogue/`). `Card.astro` writes it on a late card's frame as
  `data-waiting`.
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
  Source); `index.astro`, `404.astro` and `privacy.astro` are the pages, `Feature`, `Row` and
  `Card` the parts, `robots.txt.ts` and `sitemap.xml.ts` the endpoints.
  `src/scripts/rows.ts` works the row buttons from `paging.ts`, and
  `src/scripts/pictures.ts` brings in the pictures of the **late rows**
  (every row after the second, `LATE_ROWS_FROM` in `Row.astro`): a late
  card's `<picture>` holds its addresses in `data-` attributes and the
  ordinary picture sits beside it in a `<noscript>`, and an
  IntersectionObserver on each late row (`MARGIN`, 300px) moves them into
  `srcset` and `src`; it also checks each frame's `data-waiting` with
  `colour.ts` and sets `--waiting` through the CSSOM, and marks a picture
  `data-arrived` when it loads or fails. Both are imported by the one script block in
  `index.astro`. Building the catalogue in
  `index.astro` is also what stops the build on a broken one.
- `src/styles/tokens.css` says every colour, size and font once.
  `src/styles/site.css` reads them and holds no value of its own.
- `astro.config.mjs` holds the site's address, the fonts and the content
  policy. `netlify.toml` holds the build and the headers a file cannot
  carry, `frame-ancestors` among them.
- `tests/unit/` is vitest. `tests/e2e/`, `tests/look/` and `tests/gates/`
  are Playwright (three projects), against the built site under
  `npm run preview`. `gates/` holds the weight baseline and its budgets,
  `scripts/` the two gates that need the network.
- `plans/` holds each plan, with its state line and its boxes.

**To list, unlist or move a site:** edit `src/content/catalogue.json`. A
new site also needs its `entries/<id>.yaml` and its picture in
`pictures/`. Run `npm run check`. The look and weight baselines move when
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
it finds there. There is no scene to set and no time to step: the page is
the same on every load.

## Edge cases

Every new thing is taken through each of these that it can reach.

- With script and without it. Late pictures arrive by script when it is on
  and from the `<noscript>` when it is off; each must be whole, and a card
  has exactly one picture in the accessibility tree either way.
- By keyboard alone: order, a visible focus ring, nothing trapped.
- A desk's width, a phone's (390px), 320px, 640px standing in for 200%
  zoom, and each side of every step in `site.css`: a fault can sit
  between two widths that both pass. WCAG 1.4.12 text spacing.
- `prefers-reduced-motion`: motion exists only inside a `no-preference`
  block.
- `forced-colors`.
- A card hovered (mouse) and focused (Tab), and a tap on touch: the others
  in its row dim, nothing else does, text stays 7:1.
- An entry with an address and one without. A row that overflows and one
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
| `tests/unit/structure.test.ts`      | `src/catalogue` imports nothing but `astro/zod`      |
| `tests/unit/colour.test.ts`         | the colour check: one spelling, nothing else passes  |
| `tests/unit/paging.test.ts`         | the paging rule, with a pixel of tolerance           |
| `tests/unit/favicon.test.ts`        | the icon's colours equal the tokens'                 |
| `tests/unit/weight-judging.test.ts` | the weight rule: counts, both ways, budgets          |
| `tests/e2e/page.spec.ts`            | the model drawn, pictures, links, head, 404, footer  |
| `tests/e2e/privacy.spec.ts`         | the privacy page: sections, links, 80-character line |
| `tests/e2e/rows.spec.ts`            | the row buttons, at both ends, and a fitting row     |
| `tests/e2e/late.spec.ts`            | late rows: unfetched, then fetched by scroll, link,  |
|                                     | Tab, print, no observer; markup holds no address     |
| `tests/e2e/keyboard.spec.ts`        | real Tab: order, ring, uncovered; 44px (card, link)  |
| `tests/e2e/contrast.spec.ts`        | drawn text 7:1 (large 4.5:1), each Tab ring 3:1      |
| `tests/e2e/motion.spec.ts`          | every CSSOM rule with motion sits in no-preference   |
| `tests/e2e/axe.spec.ts`             | axe, WCAG 2.0-2.2 and best practice, no violation    |
| `tests/e2e/policy.spec.ts`          | the meta policy's script-src has no unsafe-*         |
| `tests/e2e/reflow.spec.ts`          | each side of every layout step, 320 to 1440, spaced  |
| `tests/e2e/nojs.spec.ts`            | the page whole with script off                       |
| `tests/e2e/waiting.spec.ts`         | waiting frames: colour, arrival, ease, bad colour    |
| `tests/e2e/lights.spec.ts`          | a hovered or focused card dims its row's pictures    |
| `tests/e2e/origin.spec.ts`          | own origin only, clean console; nothing stored       |
| `tests/look/look.spec.ts`           | eight pictures of the built site, as written         |
| `tests/gates/weight.spec.ts`        | requests and bytes by kind, at 1440 and 390          |
| `scripts/links.mjs`                 | no card's address is gone (network; not in check)    |
| `scripts/headers.mjs`               | a live address sends the five headers (not in check) |

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

- **No seed, stepped time, fuzzer, determinism or saved shape.** A static
  page has none of them. The catalogue's refusals at build are to stand
  in for "what comes from outside is checked".
- **Headers as served.** `netlify.toml` is not read by anything here. The
  headers are read from the live address once it exists.
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
  holds that case. The waiting colour is `sharp`'s coarse dominant
  (a few dozen values a channel, often a picture's background), and no
  test reads it against the picture, only the look picture shows it. `loading="lazy"` alone does not wait (Chromium fetched
  rows 2000px down), so the weight gate is what holds the waiting, by
  count and by the budget. It measures the home page alone and times no
  load or interaction.
- **The look is one machine's.** Its baselines are this Mac's Chromium,
  drawn in software (`--disable-gpu`: the GPU path drew a picture two ways)
  and were looked at by one person, once. Another GPU or font stack would
  draw them a little differently. Nothing holds the 640 or forced-colors
  pictures.
- **House lights need `:has()`.** A browser without it shows no dimming,
  which is the page as it was, and has no fallback. Nothing holds a real
  touch device: the tap test is Chromium's mobile emulation, and no row of
  the catalogue mixes linked and unlinked cards, so that test makes one in
  the page.
- **Contrast of a hovered card's edge** (accent over a picture) is held
  by no gate, since no token says what is under it.
- **axe's incompletes** are attached to its report, counted and not
  failed; they are not read by anything.
- **One browser, Chromium, on one machine.** Firefox, Safari and a real
  phone are not looked at. A screen reader is a person's to try.
- **Node.** This machine runs 23.4.0, which vitest 5.1.1 does not list
  and on which npm 10.9.2 needed `--legacy-peer-deps` to install it.
  Netlify builds on 22. Neither has been seen to matter.
- **The fonts have no metric-matched fallback** (`optimizedFallbacks` is
  off, since the build fails with it on), so text may shift as they
  arrive.
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
