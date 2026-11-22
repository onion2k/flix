// The one way a loop is encoded, for the recorder (record.mjs) and for a hero
// loop cut from a take that was kept (hero-from-take.mjs): VP9, silent, 25
// frames a second, six seconds from a start, at a width, tried at falling
// quality until it fits the limit for that width. It is a module of its own so
// that a hero loop made later from an approved take is made with exactly the
// settings the card loop was, and not with a copy that could drift. Without it
// the approved loop could not be had again at hero size without a new take.
import { execFileSync } from 'node:child_process';
import { statSync } from 'node:fs';

const FFMPEG = process.env.FFMPEG ?? '/opt/homebrew/bin/ffmpeg';
export const SECONDS = 6;
// The measured settings: about 200 KB at 640 wide and 355 KB at 960.
export const CARD_WIDTH = 640;
export const HERO_WIDTH = 960;

// The most a loop may weigh: the hero's is the plan's own budget, the card's
// is a ceiling a little above the measured 200-240 KB. A busy picture that
// goes over is encoded again at a lower quality, so it is never trimmed by hand.
const LIMITS = { [CARD_WIDTH]: 300000, [HERO_WIDTH]: 450000 };
const CRFS = [46, 50, 54, 58, 62];

export function encode(src, start, width, crop, dest) {
  for (const crf of CRFS) {
    encodeAt(src, start, width, crop, dest, crf);
    if (statSync(dest).size <= LIMITS[width]) return crf;
  }
  throw new Error(
    `${dest} is over ${LIMITS[width]} bytes even at crf ${CRFS.at(-1)}`,
  );
}

function encodeAt(src, start, width, crop, dest, crf) {
  // A game that does not fill a 16:9 window is cut to the part worth seeing,
  // never stretched: the crop keeps the shape.
  let cut = '';
  if (crop) {
    const [x, y, w, h] = crop;
    if (Math.abs(w * 9 - h * 16) > 16)
      throw new Error(`crop ${crop} is not 16:9`);
    cut = `crop=${w}:${h}:${x}:${y},`;
  }
  execFileSync(
    FFMPEG,
    [
      '-loglevel',
      'error',
      '-y',
      '-ss',
      String(start),
      '-t',
      String(SECONDS),
      '-i',
      src,
      '-an',
      '-vf',
      `${cut}scale=${width}:-2,fps=25`,
      '-c:v',
      'libvpx-vp9',
      '-b:v',
      '0',
      '-crf',
      String(crf),
      '-row-mt',
      '1',
      '-deadline',
      'good',
      dest,
    ],
    { stdio: 'inherit' },
  );
}
