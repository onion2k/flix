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
    npm run check        the quick check, then a build
    npm run format       the formatter, writing

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
  `astro/zod`. `schema.ts` holds the shape of an entry and of the rows
  file, and `rows.ts` builds the page's model from them and refuses a
  catalogue that does not hold together, naming file and id. _`paging.ts`
  is not built yet: part 4._
- `src/content/` is where the content lives: an entry a file, its
  picture, and the rows in their order. `src/content.config.ts` tells
  Astro where each is and which of the catalogue's schemas it must meet.
- `src/layouts/`, `src/pages/`, `src/components/` and `src/scripts/` are
  **the page**. They draw what the catalogue returns and work nothing
  out. Today there is `Base.astro` and an `index.astro` holding the
  wordmark, which also builds the catalogue so that a broken one stops
  the build.
- `src/styles/tokens.css` says every colour, size and font once.
  `src/styles/site.css` reads them and holds no value of its own.
- `astro.config.mjs` holds the site's address, the fonts and the content
  policy. `netlify.toml` holds the build and the headers a file cannot
  carry, `frame-ancestors` among them.
- `tests/unit/` is vitest. `tests/e2e/` and `tests/look/` are Playwright,
  against the built site under `npm run preview`.
- `plans/` holds each plan, with its state line and its boxes.

There is no persisted shape. What has been given out is an address: the
site's own, each row's anchor and each entry's id. They are kept, and
name a thing by what it is.

## Model features

- **Something the user sees:** none yet. Part 4's `Card.astro`, with its
  test in `tests/e2e/`, is to be the one to copy.
- **The thing's logic:** `tests/unit/rows.test.ts`. It builds a small
  catalogue in the test, reads each refusal's message for the file and
  the id, and was mutation-checked by hand for each rule.
- **A tool that measures:** `tests/unit/tokens.test.ts`. It reads the
  file as the build does, counts what it reached so that reading nothing
  is a failure, and was seen to fail with a token removed and with one
  said twice.

## The test API

A unit test imports from `src/catalogue/` and from `tokens.css` as text.
An end-to-end test opens the built site through Playwright's `baseURL`
(`playwright.config.ts`), on port 4390, which is this project's own so
that a test never meets a dev server on 4321. It never reuses a server
it finds there. There is no scene to set and no time to step: the page is
the same on every load.

## Edge cases

Every new thing is taken through each of these that it can reach.

- With script and without it.
- By keyboard alone: order, a visible focus ring, nothing trapped.
- A desk's width, a phone's (390px), 320px, and 640px standing in for
  200% zoom. WCAG 1.4.12 text spacing.
- `prefers-reduced-motion`: motion exists only inside a `no-preference`
  block.
- `forced-colors`.
- An entry with an address and one without. A row that overflows and one
  that fits. A long title, a long description.
- A picture slow to arrive or missing: the words still stand.
- The 404 page.

## Gates

| Gate                           | What it holds today                                |
| ------------------------------ | -------------------------------------------------- |
| `npm run secrets`              | nothing staged looks like a key                    |
| `prettier --check .`           | one formatter decides every file it should         |
| `npm run types`                | no type error in `.astro` or `.ts`                 |
| `npm run lint`                 | type-aware mistakes in `.ts`                       |
| `tests/unit/tokens.test.ts`    | each colour token defined once, as the plan says   |
| `tests/unit/schema.test.ts`    | an entry and the rows file refused by path or name |
| `tests/unit/rows.test.ts`      | the page's model, and the cross-file refusals      |
| `tests/unit/structure.test.ts` | `src/catalogue` imports nothing but `astro/zod`    |

No gate has a baseline or a tolerance yet. Contrast, motion, the audit,
the pictures and page weight arrive in part 5, each with its figures in
`gates/` or beside its test.

## Done, here

The nine points of the definition of done, as this project has them.

1. Acceptance criteria are tests: `tests/unit/` for the catalogue,
   `tests/e2e/` for the page.
2. The edge cases above.
3. `npm run check`.
4. End to end is Playwright against the built site, working each control
   as a user does: a real Tab, a real click.
5. There is no fuzzer. See below.
6. Performance is page weight, once its gate exists.
7. Looked at headless, at a desk's width, a phone's and 320px.
8. A new test is seen to fail with its fault put back.
9. What was not verified is said.

## What is not held

- **No seed, stepped time, fuzzer, determinism or saved shape.** A static
  page has none of them. The catalogue's refusals at build are to stand
  in for "what comes from outside is checked".
- **Headers as served.** `netlify.toml` is not read by anything here. The
  headers are read from the live address once it exists.
- **The Playwright config has run no test.** There are no specs yet.
- **The secret scan reaches only what is staged,** so run by hand outside
  a commit it scans nothing and passes. The history is not scanned.
- **The real content is held by the build alone.** No unit test loads
  `src/content/`: it is YAML, and parsing it here would need a
  dependency the project does not have. A refusal there is seen as a
  failed `npm run build`, not as a failed test.
- **No audit, licence or unused-dependency check.**
- **One browser, Chromium, on one machine.** Firefox, Safari and a real
  phone are not looked at. A screen reader is a person's to try.
- **Node.** This machine runs 23.4.0, which vitest 5.1.1 does not list
  and on which npm 10.9.2 needed `--legacy-peer-deps` to install it.
  Netlify builds on 22. Neither has been seen to matter.
- **The fonts have no metric-matched fallback** (`optimizedFallbacks` is
  off, since the build fails with it on), so text may shift as they
  arrive.
- **No mutation gate.** Mutations are by hand, and reported.

## How a change lands

- **Merge style:** a merge commit.
- **What an agent may do without asking:** commit locally. Pushing,
  opening a PR, merging and tagging are each asked for, each time. These
  are the kit's defaults, taken until the owner says otherwise.
- **Stale after:** 30 days.
- The remote is `https://github.com/onion2k/flix.git`. Netlify builds
  `main`, so a push there is a public deploy.
