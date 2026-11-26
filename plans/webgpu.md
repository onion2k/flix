# WebGPU: say so on a card where this browser can't run its site

State: agreed 2026-11-26; built 2026-11-26 (parts 1 to 5). Decisions 1 and 2 taken as recommended; decision 3: the page was 69,004 of 69,000 bytes, and the owner raised the budget to 70,000 (2026-11-26).

## Context

Some of the linked sites are built on WebGPU, with no fallback. In a browser
that lacks it they show "WebGPU is not available in this browser" or "WebGPU:
no adapter", or, in Chess's case, hang on "Compiling the shaders…" for good. A
visitor leaving flix for one of those in such a browser gets nothing.

The needs feature, landed today, covers input devices, not the browser. This
spec adds the browser: each entry can say it requires WebGPU. The page checks
the visitor's own browser, and where WebGPU is missing it says so on exactly
those cards, and on the feature panel when the day's feature is one of them,
before the visitor leaves. Play is never taken away.

## Where it stands now (measured 2026-11-26)

- **Eight sites need WebGPU, not seven.** In their own code and run in a
  browser without an adapter: Artshape, Chess, Chopdrop, Coinpush, Heist,
  Nuclear Fishin', Ooergolf and Pushminer. All use the same engine and the
  same error messages. Chess was missed by the survey, and without WebGPU it
  hangs on its loading screen rather than showing an error. Codex Squadron,
  Coinpusher, Fruit Machine and Quack Attack mention WebGPU but draw with
  WebGL, and they ran without an adapter.
- **Two of the three feature candidates need WebGPU** (Ooergolf and
  Pushminer). Aquaclysm doesn't.
- **WebGPU is in every major engine, but per device.**
  - Chrome desktop has it since 113; on Linux it's rolling out by GPU.
  - Chrome on Android has it since 121, on Android 12 or later with certain
    GPUs.
  - Safari 26 has it on macOS, iOS and iPadOS, so every iOS browser has it on
    iOS 26. Older iOS versions don't.
  - Firefox has it on Windows (141) and Apple-silicon Macs (145), and not on
    Android.
  - Sources: [gpuweb implementation status](https://github.com/gpuweb/gpuweb/wiki/Implementation-Status),
    [web.dev](https://web.dev/blog/webgpu-supported-major-browsers),
    [enterno.io, 2026](https://enterno.io/en/s/research-webgpu-adoption-browsers-2026).
  - So `navigator.gpu` being there isn't enough. Headless Chromium has it and
    gets no adapter. The page must ask for an adapter.
- **Weight:** the page without pictures is about 68,540 of its 69,000
  compressed bytes, so there's about 460 to spend.

## What

- **`requires`** in an entry's YAML is an optional list of browser features,
  with one allowed value so far, `webgpu`. It's written into the 8 entries.
  The card is marked `data-requires="webgpu"` in the markup. No words are in
  the markup, which keeps the page's weight down.
- **The check:** a new `src/scripts/webgpu.ts`, imported by `index.astro`'s
  script block. After the window's `load`, it asks
  `navigator.gpu.requestAdapter()` once. That's a question to the browser
  only: nothing is read from the adapter, sent anywhere or stored. The verdict
  comes from a pure rule in a new `src/catalogue/webgpu.ts`:
  - **lacks** when there's no `navigator.gpu`, the adapter is `null`, or the
    request fails;
  - **has** when an adapter comes back;
  - **unknown** when the request hasn't answered within 3 s.

  Only "lacks" changes the page.

- **Where it lacks WebGPU:** every card marked `webgpu` gets one line, made
  by the script from the words in `webgpu.ts`: **"Won't run in this browser:
  it needs WebGPU."** It goes on the card's front under its title (on every
  device), on its back and in a phone's sheet. The feature's panel gets it
  too when the day's feature is one of the eight. It's drawn in the ink on
  the tile and in the text colour on the panel. Play stays.
- **Where it has WebGPU, where the check is unknown, or with script off:**
  nothing changes.
- **No reordering.** The verdict comes after the page has drawn, so moving
  cards then would shift them under the reader.

## Acceptance criteria

1. The schema refuses a `requires` item other than `webgpu`, or one given
   twice, naming the file. The 8 entries say it, and no other entry does.
2. `webgpu.ts` gives lacks, has or unknown for every case: no API, a `null`
   adapter, a rejected request, an adapter, and a request still open at 3 s.
3. Where the browser lacks WebGPU, each of the 8 cards shows the line on its
   front and back, and no other card does. The feature panel shows it on
   Ooergolf's and Pushminer's days, and not on Aquaclysm's.
4. With an adapter, with a request still open at 3 s, and with script off, no
   line is drawn anywhere.
5. The line is 7:1 on its tile, against the darkest pixel at rest and at full
   shine, and it's in the accessibility tree once per visible face. The
   console stays clean and the content policy refuses nothing.
6. The request is made once per page load, and only after `load`.

## Edge cases (CLAUDE.md's checklist)

- **Script off:** nothing (it can't be known). **Late rows:** the line is
  added whether or not a card's picture has come. **Flip and sheet:** the
  back's line is in the flipped face, and the face turned away stays inert.
- **Touch:** the front can hold the needs line and this one. None of the 8
  needs more than touch, so no card shows both.
- **320px, larger text, 1.4.12 spacing:** a card with the line is taller, and
  each row stays level.
- **Reduced motion, forced colours:** text, nothing to do.
- **Each feature day:** covered above.
- **Not reachable:** the date, the gamepad, a missing picture.
- **Privacy:** the page now asks the browser one question about its device.
  The privacy page's words are yours. I'll leave them alone unless you want a
  sentence added (decision 2).

## Decisions (yours)

1. **The words.** I recommend "Won't run in this browser: it needs WebGPU."
   It tells a visitor who doesn't know the word what will happen, and names
   the cause for one who does. It's a draft, said once in `webgpu.ts`.
2. **The privacy page.** I recommend adding one sentence, which you'd edit:
   "The page asks your browser whether it can run WebGPU, so a card can say
   so; the answer is not kept or sent anywhere." The alternative is to leave
   the page as it is.
3. **The weight.** The estimate is about 300 to 450 compressed bytes: the
   module, 8 attributes and the CSS. That's at the edge of the 460 left. If
   the measurement goes over, I'd ask you to raise the budget to 70,000
   rather than cut something. The alternative is to find savings elsewhere
   first.

## Performance

One `requestAdapter()` after `load`. It's asynchronous, it never blocks the
first screen, and it's made once. `npm run weight` measures the bytes. The
module adds no request: it's bundled with the page's one script.

## Test plan

- **Unit:**
  - `webgpu.test.ts`: the rule, every case, and the words.
  - `schema.test`, `rows.test` (`requires` on the card) and
    `catalogue-file.test`.
- **The test default:** `tests/clock.ts`'s auto fixture stands in a WebGPU
  adapter for every spec, as most visitors' browsers have one. That keeps
  every existing spec and picture as they are, since headless Chromium itself
  has no adapter and would otherwise show the line everywhere.
- **End to end:** a new `webgpu.spec.ts` replaces the stand-in with each
  case, as `moving.spec`'s gamepad does: none, a `null` adapter, a rejection,
  an adapter, and a request left open, with the clock stepped past 3 s. It
  checks the lines on exactly the 8 cards, front, back and sheet, the panel
  on days 0, 1 and 2, script off, and that the request happens once and after
  `load`. `contrast.spec` measures the line on a tile at a desk (both shines,
  seven lights), plus axe with the lines, `header-policy` and `origin`.
- **Look:** one new picture of the first row at 1440 in a browser lacking
  WebGPU (Pushminer, Chopdrop, Chess and Ooergolf are in it).
- **Mutation:** flip the verdict, drop the timeout, and add the line where
  there's an adapter. The new tests must fail each time.
- **WebKit:** `webgpu.spec` run once in Playwright's WebKit, by hand.

## Parts

- [x] 1. `webgpu.ts`, the schema's `requires`, `rows.ts` (the card's mark)
      and the 8 entries. Check: unit tests, seen failing first; `npm run build`.
- [x] 2. The stand-in default in `tests/clock.ts`. Check: the existing
      e2e and look pass unchanged.
- [x] 3. `src/scripts/webgpu.ts` and the CSS for the line. Check:
      `webgpu.spec`, `contrast.spec`, axe.
- [x] 4. The privacy sentence, if decision 2 is yes. Check: `privacy.spec`.
- [x] 5. The pass: `npm run check`, mutation, the new look picture, weight
      (decision 3), WebKit by hand, CLAUDE.md and `plans/webgpu.md`. Then commit
      and push only if you ask.

## Critical files

`src/catalogue/webgpu.ts` (new), `schema.ts`, `rows.ts`;
`src/scripts/webgpu.ts` (new); `src/pages/index.astro` (one import);
`src/components/Card.astro` and `Feature.astro` (the mark);
`src/styles/site.css`; the 8 `src/content/entries/*.yaml`; `tests/clock.ts`;
the new and named specs; CLAUDE.md.

## Not verified, and said so

A real device without WebGPU (an Android phone without it, iOS below 26,
Firefox on Android). Those are stood in by the test. And whether
`requestAdapter()` on some real device takes longer than 3 s often enough to
matter. A slow answer says nothing, which is the safe side.
