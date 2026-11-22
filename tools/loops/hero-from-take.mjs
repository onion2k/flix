// Makes a game's hero loop (960 wide) from the raw take the recorder kept in
// out/work/<id>/, at the second its approved card loop starts, so that the hero
// is the loop the owner approved at the larger size and needs no new approval.
//
//   node tools/loops/hero-from-take.mjs <site id> <start second>
//
// The start was not kept for Pushminer; it was found by matching the card
// loop's first three frames against the take's, which they equal at 15.6 s.
// Nothing is recorded and no site is visited. Without this a game whose hero
// loop was missed when its card loop was approved would need a new take.
import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { recipes } from './recipes.mjs';
import { encode, HERO_WIDTH } from './encode.mjs';

const out = join(dirname(fileURLToPath(import.meta.url)), 'out');
const [id, start] = process.argv.slice(2);
if (!recipes[id] || !(Number(start) >= 0))
  throw new Error('usage: hero-from-take.mjs <site id> <start second>');
const dir = join(out, 'work', id);
const take = readdirSync(dir).find((name) => name.endsWith('.webm'));
if (take === undefined) throw new Error(`no kept take in ${dir}`);
const dest = join(out, `${id}.hero.webm`);
const crf = encode(
  join(dir, take),
  Number(start),
  HERO_WIDTH,
  recipes[id].crop,
  dest,
);
console.log(`${dest} made from ${take} at ${start}s, crf ${crf}`);
