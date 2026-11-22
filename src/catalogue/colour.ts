// Two things about the colour a late card's frame waits in: what that colour
// is, worked out from the pixels of its picture (waitingColour, below), and
// whether a piece of text is a colour the page may use at all: a hash and six
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

/**
 * How light a waiting colour is, as HSL has lightness, whatever the picture.
 * A picture of a white page and one of a black cave must both wait inside the
 * site's dark look, so the picture gives the hue and how strong it is, and
 * this gives how light. It is dark enough that, mixed with the panel, a frame
 * is plainly not a picture, and light enough that its hue can be told.
 */
export const WAITING_LIGHTNESS = 0.3;

/** The most a waiting colour may be saturated, so that none is a neon slab. */
const MOST_SATURATED = 0.55;

/**
 * The colour a picture waits in, from the pixels of a small copy of it, three
 * bytes each, red then green then blue. The hue is that of the picture's most
 * saturated pixels: each pixel counts by the square of how far apart its
 * brightest and darkest channels are, so a purple toy on a black ground comes
 * out purple and a grey picture stays grey. The plain commonest colour was
 * tried first and gave the ground every time, black or white. There is no
 * chance and no time in it: the same pixels give the same colour.
 */
export function waitingColour(pixels: Uint8Array): string {
  if (pixels.length === 0) throw new Error('the picture has no pixels');
  if (pixels.length % 3 !== 0)
    throw new Error('the picture is not three bytes a pixel');
  let red = 0;
  let green = 0;
  let blue = 0;
  let weights = 0;
  for (let at = 0; at < pixels.length; at += 3) {
    const r = pixels[at] ?? 0;
    const g = pixels[at + 1] ?? 0;
    const b = pixels[at + 2] ?? 0;
    const spread = Math.max(r, g, b) - Math.min(r, g, b);
    // One is added so that a picture with no colour at all still has a
    // weight, and comes out as the grey it is.
    const weight = spread * spread + 1;
    red += r * weight;
    green += g * weight;
    blue += b * weight;
    weights += weight;
  }
  const [hue, saturation] = hueAndSaturation(
    red / weights / 255,
    green / weights / 255,
    blue / weights / 255,
  );
  return hex(
    fromHsl(hue, Math.min(saturation, MOST_SATURATED), WAITING_LIGHTNESS),
  );
}

/** Hue in turns (0 to 1) and saturation (0 to 1), as HSL has them. */
function hueAndSaturation(r: number, g: number, b: number): [number, number] {
  const most = Math.max(r, g, b);
  const least = Math.min(r, g, b);
  const spread = most - least;
  if (spread === 0) return [0, 0];
  const lightness = (most + least) / 2;
  const saturation = spread / (1 - Math.abs(2 * lightness - 1));
  let sixths: number;
  if (most === r) sixths = ((g - b) / spread + 6) % 6;
  else if (most === g) sixths = (b - r) / spread + 2;
  else sixths = (r - g) / spread + 4;
  return [sixths / 6, saturation];
}

/** Red, green and blue (0 to 1) of an HSL colour. */
function fromHsl(
  hue: number,
  saturation: number,
  lightness: number,
): [number, number, number] {
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const sixths = hue * 6;
  const second = chroma * (1 - Math.abs((sixths % 2) - 1));
  const base = lightness - chroma / 2;
  const sector = Math.floor(sixths) % 6;
  const parts: [number, number, number][] = [
    [chroma, second, 0],
    [second, chroma, 0],
    [0, chroma, second],
    [0, second, chroma],
    [second, 0, chroma],
    [chroma, 0, second],
  ];
  const [r, g, b] = parts[sector] ?? [0, 0, 0];
  return [r + base, g + base, b + base];
}

/** A hash and six lower-case hex digits, the one spelling asColour allows. */
function hex(colour: [number, number, number]): string {
  return `#${colour
    .map((channel) =>
      Math.round(Math.min(1, Math.max(0, channel)) * 255)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`;
}
