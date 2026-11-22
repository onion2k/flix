// Reads the colour a picture waits in, for the build alone. A late card's
// frame waits in that colour, mixed with the panel's, until its picture
// arrives (see Card.astro), so the colour has to be worked out where the file
// is, which is here and never in the page. It lives outside src/catalogue,
// which stays free of Node and of sharp, and it is the one place sharp is
// used: sharp makes a small copy of the picture and hands its pixels to the
// catalogue's own rule, which decides the colour and is tested without a
// file. sharp's own "dominant" colour was used first and was wrong for this:
// it is the fullest cell of a coarse grid, which is the picture's ground,
// black or white, and not what the picture is of. Nothing here has chance or
// time in it, so the same file gives the same colour on every build, which
// the weight gate needs since it holds the document's bytes exactly. Without
// this a late frame would wait in the flat panel colour.
import sharp from 'sharp';
import { waitingColour } from '../catalogue/colour';

// The small copy's size. It is enough to carry the picture's colours and few
// enough pixels that one bright speck cannot decide the answer. The pictures
// are 16:9 or close to it, and the copy is stretched to fit, since only its
// colours are read and not its shapes.
const WIDTH = 32;
const HEIGHT = 18;

/** The colour the picture in this file waits in, as #rrggbb. */
export async function pictureColour(file: string): Promise<string> {
  const pixels = await sharp(file)
    .resize(WIDTH, HEIGHT, { fit: 'fill' })
    .removeAlpha()
    .toColourspace('srgb')
    .raw()
    .toBuffer();
  if (pixels.length !== WIDTH * HEIGHT * 3)
    throw new Error(
      `${file}: sharp gave ${pixels.length} bytes for a ${WIDTH} by ${HEIGHT} copy`,
    );
  return waitingColour(new Uint8Array(pixels));
}
