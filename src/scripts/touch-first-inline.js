// Puts the cards a phone can play first in a row, before the row is first
// drawn. It is a classic script that only defines flixTouchFirst: Row.astro
// writes it once, before the first row, and after each row's strip writes the
// one-line call in touch-first-call.js, so that the page carries this text
// once and not once a row (written whole in all eight rows it was 15 KB of
// the page and put the page over its weight budget). Each is allowed by the
// content policy by the hash of its file's text (src/build/inline-script.ts,
// read by astro.config.mjs and by the page, so that a hash and its text cannot
// drift), and neither depends on the page's module, which may be slow or never
// come. The call's own script element is document.currentScript while the
// function runs, so the strip is the element before it. It does something
// only where the device points with nothing fine (a touch screen with no
// mouse, trackpad or stylus: any-pointer coarse and not fine). There it moves
// the strip's cards, those marked data-touch first, each group keeping its
// order, which is the rule of src/catalogue/fitting.ts's touchFirst said a
// second time (a classic script has no modules).
// tests/unit/touch-first.test.ts holds this equal to the rule over many
// rows. Without it a touch screen would be sent past the cards it cannot play
// to reach those it can, or the move would wait for the module and be seen.
function flixTouchFirst() {
  var strip =
    document.currentScript && document.currentScript.previousElementSibling;
  if (!strip || !strip.matches || !strip.matches('ul.strip')) return;
  if (typeof matchMedia !== 'function') return;
  if (!matchMedia('(any-pointer: coarse)').matches) return;
  if (matchMedia('(any-pointer: fine)').matches) return;
  var cards = Array.prototype.slice.call(strip.children);
  var touch = [];
  var other = [];
  for (var at = 0; at < cards.length; at += 1) {
    (cards[at].hasAttribute('data-touch') ? touch : other).push(cards[at]);
  }
  var order = touch.concat(other);
  for (var place = 0; place < order.length; place += 1) {
    strip.appendChild(order[place]);
  }
}
