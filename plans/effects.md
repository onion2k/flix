# Effects, one at a time

State: building, part 5 of 7.

## Context

The site is built and its catalogue holds 19 sites. You asked what could
make it more interesting by progressive enhancement, and chose seven
effects: a preview on a card, house lights, arrow keys and a gamepad,
coloured waiting frames, drag to scroll, "Surprise me", and a feature that
changes by the day. Each is planned here and built one at a time, so that
each can be looked at, and stopped or changed, before the next.

Two things come first and are not parts: I check the `catalogue.json`
change the builder has just reported (commit `8aba2a7`) against the files,
and this plan is copied to `plans/effects.md`.

## What every part holds to

- **Nothing is lost without it.** With script off, with motion not asked
  for, or on a touch screen where an effect needs a mouse, the page is as
  it is today. Each part has a test of that.
- **Motion** is only inside the `prefers-reduced-motion: no-preference`
  block, which the motion gate holds. Text stays at 7:1 in every state.
- **A decision that can be a pure function** goes in `src/catalogue/`
  with a unit test, as `paging.ts` is. Time and chance are handed in, so
  a test holds the clock and the seed. Each script is a small module in
  `src/scripts/`, added to the one script block in `index.astro`.
- **Budgets.** The scripts are inlined, so the document grows. The page
  with its fonts is 47,007 bytes of its 60,000. My estimate is about
  5,000 more over all seven. A part that would pass a budget stops and
  comes to you. The weight and look baselines are written again, on
  purpose, by the parts that move them, and every picture is looked at.
- **How each part is built.** The `builder` agent, tests first, from
  `plans/effects.md`. I then run the full check, look at the pictures, put
  one fault of my own in to see a test catch it, and tick the box. It is
  committed locally. Pushing is asked for, not assumed.

## Parts

- [x] **1. House lights.** CSS only. While a linked card is hovered with
      a mouse or holds keyboard focus, the pictures of the other cards in
      its row dim. The words do not dim, so contrast holds. An unlinked
      card triggers nothing. The dim is a state and stays under reduced
      motion; only its ease is motion. **Not built:** the fade at a row's
      edge I described. A fade over a cut-off card takes its words under
      7:1, and the peeking card and the buttons already say there is
      more. **Files:** `tokens.css` (the dim, once), `site.css`.
      **Tests:** hover and Tab each dim the others and not the card, nor
      any other row; the drawn-contrast walk run in that state; a touch
      context does nothing on tap. The focused-card look picture is
      written again.
- [x] **2. Coloured waiting frames.** A late row's frame waits in its
      picture's own colour, not the flat panel, and the picture eases in
      when it lands. The colour is worked out at build from the picture
      and mixed toward the panel token so it stays in the look. It rides
      on the frame as a `data-` attribute, checked as a colour before it
      is used, since the content policy refuses style attributes.
      **Files:** `src/catalogue/colour.ts` (mix and check, pure),
      `Card.astro`, `src/scripts/pictures.ts`, `site.css`. **Dependency:**
      `sharp` 0.35.x, Astro's own image library, already installed and
      now used directly, declared in a commit of its own (Apache-2.0).
      **Keep, written down:** these colours are not tokens; they carry no
      words and no meaning. **Tests:** with the pictures held back, each
      late frame draws its own colour and they differ; after arrival the
      picture is fully shown; no ease under reduced motion. A look
      picture of the waiting row.
- [x] **3. Drag to scroll.** With a mouse, pressing on a row and moving
      more than a few pixels drags it; letting go lets it settle on a
      card. A drag does not follow the link under it, and a press without
      movement is a click as now. Touch and pen are left to the browser.
      **Files:** `src/catalogue/dragging.ts`, `src/scripts/drag.ts`,
      `site.css` (the grab cursor). **Tests:** a real mouse drag moves the
      strip and follows no link; a plain click still does; the row
      buttons and the keyboard are as they were.
- [x] **4. Arrow keys and a gamepad.** With focus on a card's link or
      the feature's button: Left and Right move to the next linked card
      in the row, Up and Down to the nearest in the row above or below,
      Home and End to the row's ends. Tab is unchanged, and arrows on the
      strip itself still scroll it. With a gamepad connected, the d-pad
      and left stick do the same, repeating when held, and the first
      button follows the focused link. It polls only while a gamepad is
      connected. **Files:** `src/catalogue/moving.ts` (where a move
      lands; when a held direction repeats, with time handed in),
      `src/scripts/moving.ts`. **Tests:** real key presses through every
      row, ring shown and card in view; a stubbed gamepad with the clock
      stepped. **Not verified by me:** a real controller, which is yours
      to try, and is said so in `CLAUDE.md`.
- [ ] **5. Surprise me.** A button with those words at the end of the
      header's row links, hidden in the markup and shown by script. It
      picks a playable card, never the one focused and never the same
      twice running, scrolls to it and focuses it. It follows no link.
      **Chance** comes from one seeded source in
      `src/catalogue/chance.ts`, seeded from the clock at the one place
      things are wired, and from a test's own seed through the test API.
      **Tests:** the same seed gives the same picks; every playable site
      comes up over many picks; no button with script off; target size,
      contrast and axe. The home look pictures are written again.
- [ ] **6. A feature that changes by the day.** `catalogue.json` gains
      an optional `features` list of site ids. With none, nothing
      changes. With some, the day's feature is taken in turn from
      `feature` then `features`, by the date. `feature` is still what
      shows with script off and what the social card uses. Each
      candidate is in the page, all but one hidden, and only the day's
      picture is fetched: a small inline script straight after them
      fills it before the page is first drawn. **Cost, said plainly:**
      with a list set, the big picture is found by that script and not
      by the browser's own look-ahead, so it may start a moment later.
      **Files:** `schema.ts` and `rows.ts` (the list, refused by name
      when it names no file or repeats), `src/catalogue/today.ts`,
      `Feature.astro`, `index.astro`. **Tests:** three fixed dates give
      three features, one shown and one fetched each; script off gives
      the default; every other spec, the look and the weight gate hold
      the clock so that they see the same page every day. **The first
      list is yours:** I will start with Aquaclysm, Ooergolf and Chopdrop
      unless you say otherwise.
- [ ] **7. A preview on a card.** A site's file may name up to four more
      pictures under `previews`. On a card that has some, a mouse hover
      or keyboard focus shows them in turn after a short pause, one pass
      of under five seconds (WCAG 2.2.2), then rests on the card's own
      picture; leaving returns to it at once. Stills, not video: the
      projects already hold them, and video would mean driving each game
      to record it. Nothing is fetched until the first hover or focus.
      Not with reduced motion, not with Save-Data on, not by touch. The
      preview is decoration, so the card's alt words stand. **First
      set,** from stills already in the projects, three each, every one
      looked at: Nuclear Fishin', Aquaclysm, Ooergolf, Pushminer,
      Chopdrop, Snappy, and two for Coinpush. The other twelve have none
      until you supply them. They are stored as WebP at 1280 wide: 21
      more PNGs would add about 20 MB to the repo. **Files:** `schema.ts`,
      `src/catalogue/preview.ts` (what shows when, with time handed in),
      `Card.astro`, `src/scripts/preview.ts`, `site.css`. **Tests:** no
      preview is requested at load; with the clock stepped, hover and
      focus each run the pass and end on the still; leaving stops it;
      reduced motion, Save-Data and touch each do nothing and fetch
      nothing; a fifth preview or a missing file stops the build by
      name. A look picture mid-pass with the clock held.

The order is cheapest first, so that something lands quickly and the
largest comes when the pieces it leans on are in. Say if you would rather
have the preview first.

## Verification

- After each part: `npm run check` (unit, build, end to end, look,
  weight), `npm run links` where addresses changed, and the pictures
  opened and looked at. Your dev server at `http://localhost:4321` shows
  each part as it lands.
- After the last: `/ooer-design:polish` over the look and
  `/ooer-design:preflight` against the built site, then the report.

## Out of scope

The three that change what the site promises ("Recently played", playing
in place, sound). Video previews. The other 29 subdomains. Pushing.
