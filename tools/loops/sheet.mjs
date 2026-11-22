// Makes the two things the owner looks at to approve the loops: a contact
// sheet (three frames of each card loop, with the site's name) and one video
// of every card loop in turn with its name burnt into a corner. Without them
// the owner would have to open seventeen files one by one. They are made from
// what is in out/, so remaking one loop refreshes both.
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const FONT = '/System/Library/Fonts/Helvetica.ttc';
const FRAME = { width: 400, height: 225 };
const LABEL_HEIGHT = 30;
const GAP = 10;
const COLUMNS = 2;

// The site's own name, as its entry file says it, so the sheet names a game
// as the site does.
function nameOf(root, id) {
  const text = readFileSync(
    join(root, 'src/content/entries', `${id}.yaml`),
    'utf8',
  );
  const match = /^title:\s*(.+)$/m.exec(text);
  return match ? match[1].replace(/^["']|["']$/g, '') : id;
}

export async function makeSheet({ out, recipes, ffmpeg, root }) {
  const sharp = createRequire(join(root, 'package.json'))('sharp');
  const ids = Object.keys(recipes).filter((id) =>
    existsSync(join(out, `${id}.card.webm`)),
  );
  if (!ids.length) return;
  const frames = join(out, 'work', 'frames');
  mkdirSync(frames, { recursive: true });

  // Start, middle and end: 0.1 s in, so as not to take a blank first frame,
  // and 5.8 s, so as not to run off the end.
  const times = [0.1, 3, 5.8];
  const cellWidth = FRAME.width * 3;
  const cellHeight = FRAME.height + LABEL_HEIGHT;
  const cells = [];
  for (const [index, id] of ids.entries()) {
    const name = nameOf(root, id);
    const strip = [];
    for (const [i, t] of times.entries()) {
      const png = join(frames, `${id}-${i}.png`);
      execFileSync(ffmpeg, [
        '-loglevel',
        'error',
        '-y',
        '-ss',
        String(t),
        '-i',
        join(out, `${id}.card.webm`),
        '-frames:v',
        '1',
        '-vf',
        `scale=${FRAME.width}:${FRAME.height}`,
        png,
      ]);
      strip.push({ input: png, left: i * FRAME.width, top: LABEL_HEIGHT });
    }
    const safe = name.replace(/&/g, '&amp;').replace(/</g, '&lt;');
    strip.unshift({
      input: Buffer.from(
        `<svg xmlns="http://www.w3.org/2000/svg" width="${cellWidth}" height="${LABEL_HEIGHT}">` +
          `<rect width="100%" height="100%" fill="#111"/>` +
          `<text x="8" y="21" font-family="Helvetica, Arial, sans-serif" font-size="18" fill="#fff">${safe} (${id})</text></svg>`,
      ),
      left: 0,
      top: 0,
    });
    const cell = await sharp({
      create: {
        width: cellWidth,
        height: cellHeight,
        channels: 3,
        background: '#000',
      },
    })
      .composite(strip)
      .png()
      .toBuffer();
    cells.push({
      input: cell,
      left: (index % COLUMNS) * (cellWidth + GAP),
      top: Math.floor(index / COLUMNS) * (cellHeight + GAP),
    });
  }
  const rows = Math.ceil(ids.length / COLUMNS);
  await sharp({
    create: {
      width: COLUMNS * cellWidth + (COLUMNS - 1) * GAP,
      height: rows * (cellHeight + GAP),
      channels: 3,
      background: '#444',
    },
  })
    .composite(cells)
    .png()
    .toFile(join(out, 'sheet.png'));

  // The video: every loop scaled to one size, its name in a box at the lower
  // left, joined end to end. H.264 so that any viewer plays it.
  const inputs = ids.flatMap((id) => ['-i', join(out, `${id}.card.webm`)]);
  const chains = ids.map((id, i) => {
    const text = nameOf(root, id).replace(/[:'\\%]/g, '');
    return (
      `[${i}:v]scale=640:360,setsar=1,drawtext=fontfile=${FONT}:text='${text}':` +
      `x=12:y=h-th-12:fontsize=26:fontcolor=white:box=1:boxcolor=black@0.7:boxborderw=8[v${i}]`
    );
  });
  const joined = `${ids.map((_, i) => `[v${i}]`).join('')}concat=n=${ids.length}:v=1:a=0[out]`;
  execFileSync(ffmpeg, [
    '-loglevel',
    'error',
    '-y',
    ...inputs,
    '-filter_complex',
    `${chains.join(';')};${joined}`,
    '-map',
    '[out]',
    '-c:v',
    'libx264',
    '-pix_fmt',
    'yuv420p',
    '-crf',
    '23',
    join(out, 'all.mp4'),
  ]);
}
