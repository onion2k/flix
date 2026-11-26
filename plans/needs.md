# Needs: say what each site needs, and put what a phone can play first

State: agreed 2026-11-26; built and landed 2026-11-26 (parts 1 to 6). The owner chose touch-friendly cards first on a phone, and Claude's survey of the live sites for the needs.

## Context

Flix is only a gateway. Every card is a link out, and nothing is played on the
site. Its worst failure is sending a visitor somewhere their device can't play.
For example, a phone tapping Pushminer gets "drive WASD". Each entry will say
what it needs. The card says so in words before anyone leaves. On a touch-only
device the card says it on its front, and each row puts the cards that play by
touch first (the owner's choice, 2026-11-26).

## What

- **`needs`** in each entry's YAML: a list drawn from `keyboard`, `mouse` and
  `gamepad`, each one required. An empty list `[]` means the site plays by
  touch, mouse or keys alike. A site with a `url` must say `needs` (the build
  refuses it otherwise, naming the file). A site in the workshop (no url) may
  leave it out.
- **Words** (drafts, said once in the catalogue): `[]` → "Plays on a phone or
  a computer." `[keyboard]` → "Needs a keyboard." `[keyboard, mouse]` →
  "Needs a keyboard and a mouse." `[gamepad]` → "Needs a gamepad."
- **Every device:** the back of the card, a phone's sheet and the feature's
  panel show the line.
- **A touch-only device** (`any-pointer: coarse` and not `any-pointer: fine`):
  a card with needs also shows the line on its front, under the title. This is
  CSS alone, so it holds with script off too. Each row is reordered, keeping
  your order within each group, so the cards that play by touch come first.
  The reorder is done by a classic inline script after each row's strip, before
  the row is first drawn, the same way `today-inline.js` picks the day's
  feature. A phone or tablet with a mouse, a desk, and script off all keep the
  order in `catalogue.json`.
- **Where it stands now:** `catalogue.json` sets the order for every device.
  No card says what it needs. A static reading of the 40 live sites' scripts
  can't tell either: every site listens for keys and pointer events. 8 sites
  (disco, imgsvg, light, mccree, ooer-art, pixel-heart, pong, snowfall) have
  no viewport meta tag, so a phone draws them zoomed out as desktop pages.

## Acceptance criteria

1. The schema refuses a `needs` item other than the three, and any item listed
   twice, naming the file. The build refuses a linked entry with no `needs`,
   naming the file and the id.
2. Every card's back, the phone sheet and the feature panel say the card's
   needs words, on every device.
3. On a touch-only device, a card with needs shows the words on its front. A
   card with `[]` shows nothing there. At a desk, no front shows the words.
4. On a touch-only device, every row's cards that play by touch come first,
   each group keeping the catalogue's order, and this is already so before
   the page's module runs. A desk, a phone with a mouse, and script off keep
   the catalogue's order.
5. The inline script equals `touchFirst()` over many orders (a unit test, as
   `today-inline.test.ts`). It runs under the content policy by its hash, in
   the meta tag and in `_headers`. The console stays clean.
6. Every needs line on a tile is 7:1 against its darkest pixel, at rest and
   at full shine.
7. All 42 entries say `needs`, drafted by Claude from trying each live site
   (see Part 1). CLAUDE.md marks them as drafts for you to correct.

## Edge cases (the checklist in CLAUDE.md)

- **Script on or off:** the words and the front line are in the markup and
  drawn by CSS. With script off a touch device still shows the front line, but
  the order stays the catalogue's. That's held by `nojs.spec`.
- **Late rows:** the reorder moves `li`s before any picture is brought in, so
  `pictures.ts` doesn't mind. **The first row's 4 eager pictures** keep their
  `loading` from the build. On touch the cards moved forward may be lazy ones,
  so they load as they near the window. I'll say so, not hide it.
- **Arrows, paging, trim, flip, keyboard and gamepad moves:** each reads the
  DOM and the boxes when used, so a reordered row is just a row. I'll run
  them on touch after the reorder.
- **Phone sheet:** it gains one line, and its height cap holds (it scrolls).
  The 1.4.12 text-spacing spec is run again with the line in.
- **Phone width with a mouse:** no front line and no reorder.
- **Text 125% and 150%, 320px:** cards with the line are taller, and each row
  stays level. `phone.spec` covers it.
- **Forced colours and reduced motion:** the line is text and has no motion.
- **A card with no url:** no needs, no line.
- **The day's feature:** the panel says its needs words. Nothing in the
  feature is reordered.
- **Not reachable:** gamepad input on the page and the date. No site is
  expected to need a gamepad, but the word stays for one that does.

## Performance

About 42 short lines and 8 identical inline scripts, each around 600 bytes,
which compress to near nothing as repeats. I estimate under 1 KB compressed,
against the 69,000 budget for the page without pictures. `npm run weight`
measures it, and the baseline is written again on purpose. The reorder costs
one `matchMedia` and a few DOM moves per row, once, before the first draw.

## Test plan

- **Unit:** a new `src/catalogue/fitting.ts` (`NEEDS`, `fitsTouch`,
  `needsWords`, `touchFirst`, a stable partition) and `fitting.test.ts`.
  Plus `schema.test`, `rows.test` (`needs` and its words on the card, and the
  refusal), `catalogue-file.test`, `inline-script.test` (two scripts, two
  hashes) and a new `touch-first-inline.test.ts` (the script against the rule
  under `runInNewContext`, as `today-inline.test.ts` does).
- **End to end:** a new `tests/e2e/needs.spec.ts`. It reads the words on every
  card's back at a desk and in a phone sheet. On a touch phone it checks the
  front line, the order, and that the order holds with the module blocked by a
  route. It checks the curated order at a desk, on a phone with a mouse, and
  with script off. `contrast.spec` gets the line in each finish's words, plus
  axe at the phone, `header-policy` (the new hash, a clean console) and
  `nojs`. Every spec counts what it reached.
- **Pictures:** the look baselines move, because phone cards gain a line and
  change order. They're written again on purpose with `look:update`, and I
  read each one.
- **Mutation:** take the script's call out, take a word out, and swap the
  partition's stability. The new tests must fail each time.
- **No fuzzer** (CLAUDE.md: none here).

## Parts (built in this order; each box is ticked as its check passes)

- [x] 1. **Needs drafted for all 42 sites.** Each live site is opened headless
      at a phone's size with touch and at a desk's. Its own instructions are read
      and a tap is tried. The results form a table with the evidence for each
      verdict, and I spot-check five by hand. Check: the table, kept in the plan.
- [x] 2. **`fitting.ts`, the schema and `rows.ts`:** `needs` on the entry and
      card, the words, and the refusal. Check: the unit tests above, seen failing
      first.
- [x] 3. **The entries:** `needs` written into all 42 YAML files. Check:
      `npm run build`, and `catalogue-file.test`.
- [x] 4. **The words drawn:** the card's back, the front line under the
      touch-only query, the panel, and the styles from tokens. Check: `needs.spec`
      (words, front line), `contrast.spec`, `nojs.spec`.
- [x] 5. **Touch-first:** `touch-first-inline.js` after each strip, its hash
      in `astro.config.mjs` by `inline-script.ts`, and `data-touch` on each card.
      Check: `touch-first-inline.test`, `needs.spec` (order, module blocked),
      `header-policy.spec`.
- [x] 6. **The pass:** `npm run check`, mutation, look and weight written again
      on purpose, the pictures read at a desk, a phone and 320px. CLAUDE.md is
      updated: layout, words, edge cases, gates, and the drafts and what's not
      held. Then commit and push to `main` (you asked for it).

## Critical files

`src/catalogue/schema.ts`, `src/catalogue/rows.ts`, new
`src/catalogue/fitting.ts`; `src/components/Card.astro`, `Row.astro`,
`FeatureWords.astro`; new `src/scripts/touch-first-inline.js`;
`src/build/inline-script.ts`, `astro.config.mjs`; `src/styles/site.css`
(`tokens.css` only if a new size is needed);
`src/content/entries/*.yaml`; the tests above; CLAUDE.md.

## Not verified, and said so

A real phone or tablet. `any-pointer` on hybrids such as a Surface or an iPad
with a trackpad. Whether a bluetooth keyboard on a phone changes anything (it
doesn't: the device is still touch-only, so the line shows and is only
advice; Play is never taken away). The needs themselves are my judgement from
trying each site, until you correct them.

## What changed while building

- **The page went over its weight budget, and was made cheaper rather than
  the budget moved.** Written whole after each of the eight rows, the inline
  script with its comment was about 15 KB of the page, 1,982 bytes
  compressed, which put the page without pictures at 69,985 against 69,000.
  The function is now defined once, before the first row and with its
  leading comment taken off, and each row carries a one-line call
  (`touch-first-call.js`). The document grew 536 compressed bytes in all.
- **The survey found that only three of the 40 linked sites need more than
  touch,** so on a phone only the Arcade and Tools rows change order.
- **A look picture was added** (the Arcade row's end on a touch phone), since
  every other phone picture is a narrow window with a mouse and draws neither
  the front lines nor the order.
- **The front line's contrast is measured on touch** (`contrast.spec.ts`),
  added after the build, since the desk test cannot see the line.

## Mutations seen failing

The row's call taken out (two order tests in `needs.spec`); the front line in
the accent (the touch contrast test); the front line shown at a desk (the
desk and phone-with-a-mouse tests); a word of `needsWords` changed (three unit
tests); `touchFirst` made unstable (three unit tests); `-webkit-` and others
as in the unit files. Each was put back and the suite passed again.

## The survey (2026-11-26)

Each linked site opened headless at 1440 by 900 and as an iPhone 15 with
touch in Chromium (WebGPU switched on where a site needed it), its own words
read, and taps and drags tried; the three that need more were confirmed in
their code by Claude.

| id                 | needs      | sure   | evidence                                       |
| ------------------ | ---------- | ------ | ---------------------------------------------- |
| advent-calendar    | []         | high   | a tap opened a door                            |
| ai-field-guide     | []         | high   | a page to read, with buttons                   |
| aquaclysm          | []         | medium | on-screen ◀ ▶ ▲ on a phone; asks for landscape |
| artshape           | []         | medium | gallery and editor; needs WebGPU               |
| autograph          | []         | medium | a touch drag on a knob changed the drawing     |
| bg                 | []         | medium | a tap changed the gradient                     |
| book-worm          | []         | high   | "Start dragging tiles!"; a touch drag worked   |
| chess              | []         | low    | moves by tap not seen; small in portrait       |
| chopdrop           | []         | high   | a phone gets a joystick and buttons            |
| codex-squadron     | []         | medium | its code: "Drag or touch to move"              |
| coinpush           | []         | high   | "tap or space drop a coin"                     |
| coinpusher         | []         | medium | taps and drags moved coins and the view        |
| copper             | [mouse]    | high   | its canvas listens for mouse events alone      |
| decks              | []         | medium | a link box and buttons                         |
| disco              | []         | medium | nothing to press                               |
| emoji-layer        | []         | high   | buttons                                        |
| fh4-tracker        | []         | high   | a table with checkboxes                        |
| fruit-machine      | []         | medium | pointer events on SPIN; small on a phone       |
| heist              | []         | medium | selects and an input; needs WebGPU             |
| imgsvg             | []         | high   | buttons; no viewport tag                       |
| light              | []         | medium | nothing to press; no viewport tag              |
| mandala            | []         | high   | an input and a drawing                         |
| mccree             | []         | high   | taps fired shots                               |
| nuclear-fishin     | []         | high   | "press Cast"; drag to look                     |
| ooer-art           | []         | medium | a menu of pieces                               |
| ooergolf           | []         | high   | a phone layout; taps answered                  |
| petz-9000          | []         | medium | on-screen buttons on a phone                   |
| pixel-heart        | []         | medium | nothing to press; no viewport tag              |
| pong               | [keyboard] | high   | its bat moves on arrow keys alone              |
| propshop           | []         | medium | a Start button; not played past it             |
| pushminer          | []         | high   | a phone swaps in touch controls                |
| quack-attack       | []         | high   | "Tap to Start", dials and Fire                 |
| release-flow-model | []         | high   | selects, buttons, tabs                         |
| scratchy           | [mouse]    | high   | it listens for mouse events alone              |
| smash              | []         | high   | one button                                     |
| snowfall           | []         | medium | nothing to press; no viewport tag              |
| spiro              | []         | high   | "Show Controls" on a phone                     |
| synthboard         | []         | medium | a tap lit a pad                                |
| tiny-slots         | []         | high   | buttons                                        |
| typo               | []         | high   | sliders, selects, buttons                      |
