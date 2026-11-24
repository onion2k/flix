// Makes public/foil-sparkle.svg, the finishes' sparkles (src/styles/site.css,
// the tile's ::before; tokens.css says how it is drawn): soft round points of
// three sizes on transparent, the larger ones with a four-pointed glint, in a
// tile that joins the next (a point near an edge is drawn again across it).
// The card's tile shows them only through narrow bands of light that sweep as
// the pointer moves, so each point lights and fades. The seed is fixed, so it
// makes the same file every time.
// Run it from the project's root: node tools/foil-sparkle.mjs
import { writeFileSync } from 'node:fs';

const SIZE = 320;
const POINTS = 85;
let seed = 5;
const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const round = (n) => Math.round(n * 10) / 10;

const points = [];
for (let k = 0; k < POINTS; k += 1) {
  const radius = random() < 0.18 ? 3.4 : random() < 0.5 ? 2.2 : 1.4;
  points.push([
    Math.round(random() * SIZE),
    Math.round(random() * SIZE),
    radius,
    radius > 2,
  ]);
}

const draw = ([x, y, radius, glint]) =>
  `<circle cx="${x}" cy="${y}" r="${round(radius * 1.8)}" fill="url(#p)"/>` +
  (glint
    ? `<path d="M${round(x - radius * 4)} ${y}H${round(x + radius * 4)}M${x} ${round(y - radius * 4)}V${round(y + radius * 4)}"/>`
    : '');

let body = '';
for (const point of points) {
  for (const dx of [-SIZE, 0, SIZE]) {
    for (const dy of [-SIZE, 0, SIZE]) {
      const x = point[0] + dx;
      const y = point[1] + dy;
      if (x > -12 && x < SIZE + 12 && y > -12 && y < SIZE + 12)
        body += draw([x, y, point[2], point[3]]);
    }
  }
}

const comment =
  "<!-- The finishes' sparkles (src/styles/site.css): soft points of three sizes, the larger with a glint, on transparent, tiled; seen through bands of light that sweep with the pointer. Made by tools/foil-sparkle.mjs. -->";
const svg =
  `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}">${comment}` +
  `<radialGradient id="p"><stop offset="0" stop-color="#fff"/><stop offset=".35" stop-color="#fff" stop-opacity=".9"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>` +
  `<style>path{fill:none;stroke:#fff;stroke-width:.7;stroke-opacity:.8}</style>${body}</svg>`;
writeFileSync('public/foil-sparkle.svg', svg);
console.log(`public/foil-sparkle.svg: ${svg.length} bytes`);
