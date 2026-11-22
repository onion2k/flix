// Reads the dominant colour of a picture file, for the build alone. A late
// card's frame waits in that colour, mixed with the panel's, until its picture
// arrives (see Card.astro), so the colour has to be worked out where the file
// is, which is here and never in the page. It lives outside src/catalogue,
// which stays free of Node and of sharp, and it is the one place sharp is
// used. sharp's own answer is taken as it is: it counts the pixels in a coarse
// grid of colours and returns the middle of the fullest cell, with no chance
// or time in it, so the same file gives the same colour on every build, which
// the weight gate needs since it holds the document's bytes exactly. Without
// it a late frame would wait in the flat panel colour.
import sharp from 'sharp';

/** The picture's dominant colour as a hash and six lower-case hex digits. */
export async function dominantColour(file: string): Promise<string> {
  const { dominant } = await sharp(file).stats();
  const digits = [dominant.r, dominant.g, dominant.b].map((channel) => {
    if (!Number.isInteger(channel) || channel < 0 || channel > 255)
      throw new Error(`${file}: sharp gave a channel of ${channel}`);
    return channel.toString(16).padStart(2, '0');
  });
  return `#${digits.join('')}`;
}
