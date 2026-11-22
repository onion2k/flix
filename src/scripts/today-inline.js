// Picks the day's feature before the page is first drawn. It is a classic
// script written into the page straight after the feature's candidates (see
// Feature.astro), allowed by the content policy by the hash of this file's text
// (src/build/inline-script.ts, read by astro.config.mjs and by the page, so
// that the hash and the text cannot drift), and it depends on nothing else: not
// on the page's module, which may be slow or never come. It reads the clock
// once, works out the index with the rule of src/catalogue/today.ts (whole
// days since 1970-01-01 UTC, modulo the number of candidates, which it counts
// from the page), shows that candidate and hides the others, and moves the
// day's picture's addresses into srcset and src, so that only that picture is
// fetched. tests/unit/today-inline.test.ts holds this equal to the rule over
// many dates. Where the clock is not a number it leaves the first shown.
// Without it a page with a list would show its first candidate always, or
// would fetch every candidate's picture.
(function () {
  var sections = document.querySelectorAll('section.feature[data-place]');
  var count = sections.length;
  if (count < 1) return;
  var day = Math.floor(Date.now() / 86400000);
  var at = isFinite(day) ? ((day % count) + count) % count : 0;
  for (var place = 0; place < count; place += 1) {
    sections[place].hidden = place !== at;
  }
  var shown = sections[at];
  var sources = shown.querySelectorAll('source[data-srcset]');
  for (var each = 0; each < sources.length; each += 1) {
    sources[each].setAttribute(
      'srcset',
      sources[each].getAttribute('data-srcset'),
    );
    sources[each].removeAttribute('data-srcset');
  }
  var image = shown.querySelector('img[data-src]');
  if (image) {
    image.setAttribute('fetchpriority', 'high');
    image.setAttribute('srcset', image.getAttribute('data-srcset'));
    image.setAttribute('src', image.getAttribute('data-src'));
    image.removeAttribute('data-srcset');
    image.removeAttribute('data-src');
  }
})();
