// Says whether a piece of text is a colour the page may use: a hash and six
// lower-case hex digits, and nothing else. A late card's waiting colour is
// worked out at build and rides on its frame as a data- attribute, and the
// script that sets it as a custom property must not trust it, since the
// content policy refuses a style attribute and the attribute is text like any
// other from outside. Only this one spelling is allowed, which is the one the
// build writes, so a name, a url(), a function, white space or a semicolon
// that could carry a second declaration are all refused. Without it the
// script would set whatever the attribute held.

const COLOUR = /^#[0-9a-f]{6}$/;

/** The text as given if it is a colour, and null if it is anything else. */
export function asColour(text: string): string | null {
  return COLOUR.test(text) ? text : null;
}
