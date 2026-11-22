# Ooerflix: the first site

State: building, part 1 of 6.

## Context

A new static website to showcase the games and toys you build: a featured
entry at the top, then rows of large cards (picture, kind, title,
description), each row scrolling sideways. The folder
`/Users/christopherneale/projects/ooerflix` is empty and not a git repo.
It deploys from `main` on Netlify, so it is static files and nothing else.

Agreed, from the mocks and your answers:

- **Look:** Marquee. Dark green-black ground, condensed capital titles,
  marigold accent, no words over pictures. One theme, dark, written down
  as a keep: the pictures are the colour. `forced-colors` is honoured.
- **A card links straight to its game** where the project has a live
  address. One without is shown, says "In the workshop", and is no link.
- **Stack:** Astro, static, as ooer.com (`~/projects/hooer`) is.
- **Address:** `https://flix.ooer.com`.
- **Git only, no kit.** Held to `~/projects/guardrails/GUARDRAILS.md` and
  `~/.claude/rules/websites.md` all the same.
- **Commits:** local, on `main`, a dependency each and a part each.
- **Pushing:** `main` goes to `https://github.com/onion2k/flix.git`, the
  repo you made, once the pass of part 6 is green and not before, on
  your word of 2026-11-22. Nothing else is pushed.
- **Deploy:** a `netlify.toml` only. Netlify builds `main`; linking it,
  and DNS, are yours.
- **Chess and coinpusher pictures:** screenshot of the live page,
  headless. One that does not draw is left out and reported.

## The spec

True when this is done. Each is a test, written before its part.

1. The home page draws the feature, then each row in the order written,
   each row a strip of cards in the order written. A card shows its
   picture, a line saying kind and state ("Game · Play now", "Toy · In
   the workshop"), its title and its description.
2. An entry with a `url` is one link named "Play <title>", covering the
   whole card. An entry without is no link.
3. Without script a row scrolls sideways by touch, trackpad and keyboard,
   and snaps to cards. With script, a row that overflows gains Previous
   and Next buttons that move it a page and are disabled, in word and in
   look, at its ends. A row that fits gets none.
4. By keyboard alone: a skip link, then every link in reading order, each
   scrolled into view, with a focus ring at 3:1 or better. Every target
   is 44px or more.
5. No animation, transition or smooth scroll exists outside a
   `prefers-reduced-motion: no-preference` block.
6. At 320px wide, at 640px (200% zoom of 1280, as aiooer's audit does
   it) and with WCAG 1.4.12 text spacing, nothing is clipped and the page
   does not scroll sideways. Below 340px a row stacks down the page, so
   that no content needs scrolling two ways (1.4.10).
7. Every text pairing is 7:1 or better and every control edge and focus
   ring 3:1, from the tokens and again from the page as drawn.
8. The build refuses, naming file and field: an unknown field, a missing
   one, a `url` that is not https, a row naming an entry that does not
   exist, an entry in no row, an empty row, a feature naming no entry.
9. Pictures carry their size, come in a modern format at several widths,
   and load lazily below the first row. Each has alt words of its own.
10. The page asks nothing of any other origin. Fonts are self-hosted.
11. A 404 page in the same look, `robots.txt`, a sitemap, a canonical
    link and a social card, all from the one `site` address.

## Layout

- `src/catalogue/` is **the thing**, with no Astro in it and nothing
  imported from the page: `schema.ts` (an entry and the rows file, parsed
  from unknown, refused by name), `rows.ts` (entries and rows in; the
  page's model out: feature, rows, cards, each a link or not),
  `paging.ts` (scroll position in; whether Previous and Next are live and
  where each goes, out).
- `src/content/entries/<id>.yaml`, one a game or toy: `title`, `kind`
  (`game` or `toy`), `description`, `picture`, `pictureAlt`, optional
  `url`. The id is the file's name, and once published is not reused.
- `src/content/pictures/<id>.<ext>`, copied in from the projects.
- `src/content/rows.yaml`: `feature: <id>`, then rows in order, each
  `id`, `title` and its `entries` in order. A row's id is its anchor.
- `src/layouts/Base.astro`, `src/pages/{index,404}.astro`,
  `src/pages/{robots.txt,sitemap.xml}.ts`,
  `src/components/{Feature,Row,Card}.astro`: **the page**. They draw what
  `rows.ts` returns and work nothing out.
- `src/scripts/rows.ts`: the one script. Adds the buttons, calls
  `paging.ts`.
- `src/styles/tokens.css`: every colour, size and font, once.
  `src/styles/site.css` reads them.
- `tests/unit/` (vitest), `tests/e2e/` and `tests/look/` (Playwright,
  against the built site under `astro preview` on port 4390),
  `scripts/` for gates, `gates/` for budgets and baselines,
  `plans/first-site.md`, `CLAUDE.md`.

Tokens, from the mock you chose: ground `#0c1311`, panel `#18251f`, text
`#f4f1e8`, accent `#ffb81c`, picture edge `#2c3d35`. Display Big Shoulders
Display 800, capitals; body Atkinson Hyperlegible 400 and 700 (both OFL).
Body 1.0625rem on 1.5; feature title 4.5rem, 3rem on a phone; row title
2.25rem; card title 1.75rem; gutter 3rem, 1rem on a phone. The mock's
all-caps tracked kind label is a tell `ooer-design` lists, so it becomes
the plain kind-and-state line of spec 1.

## The first catalogue

Drafted from each project's own README or `package.json`, word for word.
You edit it. Alt words are mine, from looking at each picture.

| Row             | Entry           | Address                     | Picture from                           |
| --------------- | --------------- | --------------------------- | -------------------------------------- |
| feature         | Nuclear Fishin' | fish.ooer.com               | ooerfish/smoke/screens/splash-sick.png |
| Play now        | Nuclear Fishin' | (as above)                  | (as above)                             |
| Play now        | Aquaclysm       | aqua.ooer.com               | water/art/title.webp                   |
| Play now        | Coinpush        | onion2k.github.io/coinpush/ | coinpush/smoke/screens/machine.png     |
| Play now        | Chess           | onion2k.github.io/chess/    | live screenshot                        |
| Play now        | coinpusher      | coins.ooer.com              | live screenshot                        |
| In the workshop | Ooergolf        | none written                | ooergolf/smoke/screens/dog-leg.png     |
| In the workshop | Pushminer       | none written                | pushminer/smoke/screens/deep-hall.png  |
| In the workshop | Chopdrop        | none written                | chopdrop/smoke/screens/arena.png       |
| In the workshop | Snappy          | none written                | snappy/smoke/screens/meadow.png        |
| In the workshop | ooerrace        | none written                | ooerrace/docs/vehicles.png             |

Left out until you say: those with no usable picture (PETZ-9000, heist,
Fractal Viewer, Demoscene Demo, Bearing), Propshop (portrait cover only),
and the older versions and scaffolds. Every toy found lacks a picture, so
there is no Toys row yet. Site name "ooerflix" and the description line
"Games and toys to play in a browser" are drafts for you to edit.

## Dependencies

Each in a commit of its own, pinned exact (`save-exact`), versions and
licences looked up today.

| Package                                              | For                                                                                    |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------- |
| astro 7.4.13 (MIT), with sharp                       | The build: static HTML, no script unless added, pictures resized, fonts self-hosted.   |
| typescript 6.0.x, @astrojs/check 0.9.12              | Types in `.ts` and `.astro`. Not TypeScript 7: typescript-eslint asks for under 6.1.   |
| prettier 3.10.1, prettier-plugin-astro 1.1.2         | The formatter.                                                                         |
| eslint 10.15.0, typescript-eslint 8.73.0             | Type-aware lint over `.ts`. `.astro` files are held by `astro check` instead.          |
| vitest 5.1.1                                         | Unit tests of `src/catalogue` and the tokens.                                          |
| @playwright/test 1.65.1, @axe-core/playwright 4.14.0 | End to end, pictures and the audit. May download a Chromium. axe is MPL-2.0, dev only. |

Astro's names here (`fonts`, `security.csp`, content collections,
`<Image>`) are from hooer's working config. The builder reads the Astro 7
docs before using each, and says where they differ.

## Parts

Built in order by the `builder` agent on sonnet, one at a time, tests
first, from `plans/first-site.md`. Parts 2 and 6 are done in this
session. Each part is checked here against its files before the next.

- [ ] **1. Repo and scaffold.** `git init -b main`; copy this plan to
      `plans/first-site.md` and the two Marquee mock pictures beside it.
      `package.json` (`dev`, `build`, `preview`, `format`, `types`,
      `lint`, `test:unit`, `check:quick`, `check`, and `prepare` setting
      `core.hooksPath`), `.npmrc`, `.gitignore`, `astro.config.mjs`
      (`site`, fonts, CSP as hooer's less Pagefind and trusted-types
      policies it does not need, stylesheets inlined), `tsconfig.json`,
      `eslint.config.js`, prettier config, `vitest.config.ts`,
      `playwright.config.ts`, `.githooks/pre-commit`, `netlify.toml`
      (hooer's header set, `frame-ancestors 'none'` as a header policy,
      Node 22, publish `dist`), `tokens.css`, a `Base.astro` and an index
      holding the wordmark alone. **Out:** content, components, gates.
      **Proved by:** `npm run check:quick` green in under 30s; the hook
      seen to refuse a badly formatted file; `npm run build` writing
      `dist/index.html` on this machine's Node 23.4.
- [ ] **2. The project file.** `CLAUDE.md` through `/project-file`, from
      what part 1 made: Commands, Layout, Model features, Test API, Edge
      cases, Gates, Done here, What is not held, How a change lands
      (merge commit, nothing pushed without asking, stale after 30 days:
      the kit's defaults until you say otherwise). Updated as parts land.
- [ ] **3. The catalogue.** `src/catalogue/{schema,rows}.ts` with
      `tests/unit/{schema,rows,structure}.test.ts` first (spec 1, 2, 8;
      and that `src/catalogue` imports nothing of the page); the entries,
      `rows.yaml` and pictures of the table above; live screenshots of
      Chess and coinpusher at 1280x800. **Out:** any markup. **Proved
      by:** unit tests seen red then green; each refusal of spec 8 seen
      by breaking a real entry and building.
- [ ] **4. The page.** `tests/e2e/{page,rows,keyboard,reflow,nojs,
      origin}.spec.ts` first (spec 1 to 4, 6, 9 to 11), then
      `paging.ts` with its unit test, the components, `site.css`,
      `rows.ts`, the 404, `robots.txt`, sitemap, head tags and a plain
      favicon. **Out:** baselines, budgets. **Proved by:** e2e seen red
      then green against the built site; Tab pressed for real; the no
      script run in a context with JavaScript off.
- [ ] **5. The gates.** Each seen failing on a fault put in on purpose,
      then green: `tests/unit/contrast.test.ts` (pairs listed, read from
      `tokens.css`; spec 7) and contrast of drawn text in the keyboard
      walk; `tests/e2e/motion.spec.ts` (every rule of the built CSS, and
      how many it read; spec 5); `tests/e2e/axe.spec.ts` (WCAG 2.0 to 2.2
      A, AA, AAA and best practice, at 1440 and 390, violations fail,
      incompletes listed); `tests/look/` pictures of the home page at
      1440, 390 and 320 and of the 404, each looked at; `scripts/
      weight.mjs` with `gates/weight.json`; `scripts/links.mjs` (a `url`
      that is gone fails; needs the network, so outside `check`).
      **Proved by:** the fault and the failure for each, in the report.
- [ ] **6. The pass.** Full check; `/ooer-design:polish` over the look;
      `/ooer-design:preflight` against the local preview for what it can
      settle; pictures looked at, at a desk's width, a phone's and 320;
      new tests mutation-checked; the report, point by point.

## Verification

- `npm run check:quick`: format, types, lint, unit. The pre-commit hook.
- `npm run check`: the quick check, a build, then e2e, motion, axe and
  the pictures against the built site, then the weight gate.
- `npm run dev` and open `http://localhost:4321` to see it.
- Budgets are measured before they are agreed. My estimates, to be
  replaced by measurements put to you in part 5: the page with fonts and
  no pictures under 80 KB compressed; first-screen pictures at a desk's
  width under 250 KB.

## What will not be held, and is said in `CLAUDE.md`

- No seed, stepped time, fuzzer, determinism or saved shape: a static
  page has none. The catalogue's refusals stand in for "what comes from
  outside is checked".
- Headers as Netlify serves them: read from `https://flix.ooer.com` once
  it is live, not before. Locally only the CSP in the built page is read.
- One browser (Chromium) on one machine. Firefox, Safari and a real
  phone are not looked at. A screen reader is a person's to try.
- 200% zoom is stood in for by a 640px window.
- No mutation gate: mutations are by hand, and reported.

## Out of scope, named for after

A GitHub repo, pushing, linking Netlify and DNS. A privacy page and a
licence, which preflight asks for before the site goes public. A page for
each game, search, a light theme, and entries with no picture.
