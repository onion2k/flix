# Before it goes public

State: building, part 2 of 4.

## Context

Preflight, run in the pass of `plans/first-site.md`, left four things owed
before the site is public: a privacy statement (a blocker in its list), a
footer, a stated licence, and page-weight budgets that were still
estimates. The owner said to do them on 2026-11-22, and chose:

- **Licence:** code MIT; words and pictures CC BY 4.0, as ooer.com splits
  them, the pictures included. The name on it is "Chris (onion2k)".
- **Budgets:** the figures recommended from the measurements: the page
  with its fonts and no pictures at most 60 000 bytes compressed, and
  first-screen pictures at a desk's width at most 150 000 bytes.

The privacy page's words are drafted from ooer.com's own
(`~/projects/hooer/src/pages/privacy.astro`), changed only where this site
differs, and are the owner's to edit.

## The spec

1. Every page ends in a footer, the page's `contentinfo`, holding: a link
   "Privacy" to `/privacy/`; the line "Words and pictures CC BY 4.0, code
   MIT", each licence a link with `rel="license"` to
   `https://creativecommons.org/licenses/by/4.0/` and
   `https://opensource.org/license/mit`; and a link "Source" to
   `https://github.com/onion2k/flix`.
2. `/privacy/` is a page in the same look, in the sitemap, with a canonical
   link, the wordmark linking home, one `h1` ("Privacy") and the words
   below, in lines no longer than 80 characters (WCAG 1.4.8).
3. What the page claims is held by a test: after the home page is loaded,
   scrolled and a row worked, there is no cookie and nothing in
   `localStorage` or `sessionStorage`.
4. Every gate that reads the home page and the 404 reads the privacy page
   too: contrast as drawn, motion, axe, the content policy, reflow, the
   keyboard walk and target sizes, and the look, at 1440 and 390.
5. `LICENCE` at the root says the same split as the footer, and
   `package.json` points to it.
6. The weight gate fails a page over either budget, and the budgets file
   says they are agreed, by whom and when.

## The privacy page's words

Lead, under the `h1`:

> No analytics, no trackers, no cookies. The longer version follows,
> because the short one is the part everybody claims.

**What this site collects**

> Nothing. There is no analytics script, no tag manager, no pixel, no
> embedded video or font calling home, and no advertising. Every asset the
> page loads, its styles, its one script, its two typefaces and its
> pictures, comes from this domain. That is not a claim you have to take
> on trust: the content policy this site sends refuses anything from
> anywhere else, so a third-party request would not merely be absent, it
> would be blocked.
>
> There is no account to make, no newsletter to join and no form. Nothing
> on the site asks you for anything.

**What your browser keeps**

> Nothing. The site sets no cookie and stores nothing in your browser:
> there is no setting to remember.

**What the host sees**

> This is a static site on [Netlify](https://www.netlify.com/), and a
> server that answers a request necessarily sees the request: your IP
> address, the page asked for, the time, and the user agent string your
> browser sends. That is a web server log. It is not something this site
> switches on, and it is not something a site can switch off: it is the
> shape of the protocol. Netlify's own
> [privacy policy](https://www.netlify.com/privacy/) covers what it does
> with that.
>
> Nothing in this site's own code reads, forwards, joins or stores any of
> it, and no log is exported anywhere.

**Where the cards go**

> A card that says Play now is a link to the game itself, and the game is
> another site with a host of its own, which sees your request to it just
> as this site's host sees a request here. Some of the games are served
> from GitHub Pages, and GitHub's
> [privacy statement](https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement)
> covers those. What a game keeps in your browser is for the game to say:
> this page speaks only for this site.

**Getting in touch**

> There is no contact form and no mailing list, which is the same as
> saying there is no address here to give away. If something needs saying,
> the [issue tracker](https://github.com/onion2k/flix/issues) is read.

Foot of the page:

> Last reviewed **22 November 2026**. If this page ever stops being true,
> that is a bug, and the tracker above is where it goes.

Each outside address above answered 200 on 2026-11-22.

## Parts

- [x] **1. The licence.** `LICENCE`, and a `license` field in
      `package.json` pointing to it. Written in this session.
- [ ] **2. The footer and the privacy page.** Tests first, in the
      existing specs, seen red: the footer on all three pages, the privacy
      page's structure and links, line length, and the storage claim of
      spec 3. Then `src/components/Footer.astro` in `Base.astro`,
      `src/pages/privacy.astro`, its place in the sitemap, and the styles
      in `site.css` from tokens alone. Every gate of spec 4 takes the page
      in. **Out:** an accessibility statement, print styles, any other
      link or words. **Proved by:** the full check green; the look
      baselines written again, since a footer moves every one, each opened
      and looked at; the weight baseline written again for the same
      reason.
- [ ] **3. The budgets.** `gates/weight.json` holds 60 000 and 150 000 as
      agreed figures. **Proved by:** the gate seen failing with a budget
      set under the measurement, then green.
- [ ] **4. The pass.** Full check, preflight against the built site, the
      links, pictures looked at, and the report.

## Out of scope

Pushing, which is asked for when this is done. An accessibility statement
and print styles, which preflight also names and the owner has not asked
for. Anything in the catalogue.
