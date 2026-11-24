// Makes public/foil-ice.svg, the cracked-ice finish's tile (src/styles/site.css,
// the ice rules; tokens.css says how it is drawn): a jittered grid of
// triangles, each a grey of one of sixteen levels (0 to 255 in steps of 17, so
// that a light picking one grey lights a few shards at a time), drawn as one
// path a level. The grid's edge points are fixed, so the tile joins the
// next one. The seed is fixed, so it makes the same file every time.
// Run it from the project's root: node tools/foil-ice.mjs
import { writeFileSync } from 'node:fs';

const CELLS = 7;
const SIZE = 420;
let seed = 11;
const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

const jitter = [];
for (let j = 0; j <= CELLS; j++) {
  for (let i = 0; i <= CELLS; i++) {
    const inner = i > 0 && i < CELLS && j > 0 && j < CELLS;
    jitter.push(
      inner ? [(random() - 0.5) * 0.8, (random() - 0.5) * 0.8] : [0, 0],
    );
  }
}
const point = (i, j) => {
  const [a, b] = jitter[j * (CELLS + 1) + i];
  return [
    Math.round(((i + a) * SIZE) / CELLS),
    Math.round(((j + b) * SIZE) / CELLS),
  ];
};

const LEVELS = 16;
const levels = Array.from({ length: LEVELS }, () => []);
for (let j = 0; j < CELLS; j++) {
  for (let i = 0; i < CELLS; i++) {
    const a = point(i, j);
    const b = point(i + 1, j);
    const c = point(i + 1, j + 1);
    const d = point(i, j + 1);
    const triangles =
      random() < 0.5
        ? [
            [a, b, c],
            [a, c, d],
          ]
        : [
            [a, b, d],
            [b, c, d],
          ];
    for (const triangle of triangles) {
      levels[Math.floor(random() * LEVELS)].push(
        `M${triangle.map((q) => q.join(' ')).join('L')}Z`,
      );
    }
  }
}

const grey = (k) => {
  const hex = Math.round(k * 17)
    .toString(16)
    .padStart(2, '0');
  return `#${hex}${hex}${hex}`;
};
const comment =
  "<!-- The cracked-ice finish's tile (src/styles/site.css): triangles in sixteen greys, tiled, under an overlay of the card's base colour, and set against a uniform grey so that a few shards at a time catch the light. Made by tools/foil-ice.mjs. -->";
const paths = levels
  .map((level, k) =>
    level.length === 0 ? '' : `<path fill="${grey(k)}" d="${level.join('')}"/>`,
  )
  .join('');
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}">${comment}${paths}</svg>`;
writeFileSync('public/foil-ice.svg', svg);
console.log(`public/foil-ice.svg: ${svg.length} bytes`);
