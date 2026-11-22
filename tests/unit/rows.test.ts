// Holds buildPage to spec 1 and 2 (order, the kind-and-state line, a link only
// where there is an address) and to the refusals of spec 8 that the schemas
// cannot make because they look across files: a row naming an entry that is
// not there, an entry in no row, a feature naming nothing, an id said twice.
// Each refusal is read for the file and the id in its message, since the
// build prints that message and it is all the person has to go on.
import { describe, expect, it } from 'vitest';
import { buildPage, CatalogueError } from '../../src/catalogue/rows';
import type { Entry } from '../../src/catalogue/rows';
import type { RowsFile } from '../../src/catalogue/schema';

// The picture is passed through untouched, so the test uses an object it can
// compare by identity: the module must not look inside it.
function entry(id: string, withUrl: boolean, kind: 'game' | 'toy' = 'game') {
  return {
    id,
    title: `Title of ${id}`,
    kind,
    description: `About ${id}.`,
    picture: { src: `/${id}.png` },
    pictureAlt: `A picture of ${id}.`,
    ...(withUrl ? { url: `https://${id}.example.com` } : {}),
  } satisfies Entry<{ src: string }>;
}

const entries = [
  entry('alpha', true),
  entry('beta', true),
  entry('gamma', false),
  entry('delta', false, 'toy'),
];

const rowsFile: RowsFile = {
  feature: 'beta',
  rows: [
    { id: 'play-now', title: 'Play now', entries: ['beta', 'alpha'] },
    { id: 'workshop', title: 'In the workshop', entries: ['gamma', 'delta'] },
  ],
};

function refusal(entriesIn: Entry<unknown>[], rows: RowsFile): CatalogueError {
  try {
    buildPage(entriesIn, rows);
  } catch (error) {
    expect(error).toBeInstanceOf(CatalogueError);
    return error as CatalogueError;
  }
  throw new Error('buildPage did not refuse');
}

describe('buildPage', () => {
  it('keeps the rows and the cards in the order written', () => {
    const page = buildPage(entries, rowsFile);
    expect(page.rows.map((row) => row.id)).toEqual(['play-now', 'workshop']);
    expect(page.rows.map((row) => row.title)).toEqual([
      'Play now',
      'In the workshop',
    ]);
    expect(page.rows[0]?.cards.map((card) => card.id)).toEqual([
      'beta',
      'alpha',
    ]);
    expect(page.rows[1]?.cards.map((card) => card.id)).toEqual([
      'gamma',
      'delta',
    ]);
  });

  it('returns the feature as the card of the entry the file names', () => {
    expect(buildPage(entries, rowsFile).feature.id).toBe('beta');
  });

  it('gives a card with an address its link, its name and "Play now"', () => {
    const card = buildPage(entries, rowsFile).rows[0]?.cards[1];
    expect(card).toEqual({
      id: 'alpha',
      title: 'Title of alpha',
      kind: 'game',
      description: 'About alpha.',
      picture: { src: '/alpha.png' },
      pictureAlt: 'A picture of alpha.',
      label: 'Game · Play now',
      href: 'https://alpha.example.com',
      linkName: 'Play Title of alpha',
    });
  });

  it('gives a card without an address no link and "In the workshop"', () => {
    const card = buildPage(entries, rowsFile).rows[1]?.cards[1];
    expect(card?.label).toBe('Toy · In the workshop');
    expect(card).not.toHaveProperty('href');
    expect(card).not.toHaveProperty('linkName');
  });

  it('passes the picture through untouched, the same object', () => {
    const page = buildPage(entries, rowsFile);
    expect(page.rows[0]?.cards[1]?.picture).toBe(entries[0]?.picture);
  });

  it('draws an entry in two rows in both, and the feature too', () => {
    const rows: RowsFile = {
      feature: 'alpha',
      rows: [
        { id: 'one', title: 'One', entries: ['alpha', 'beta', 'gamma'] },
        { id: 'two', title: 'Two', entries: ['alpha', 'delta'] },
      ],
    };
    const page = buildPage(entries, rows);
    expect(page.rows[0]?.cards[0]?.id).toBe('alpha');
    expect(page.rows[1]?.cards[0]?.id).toBe('alpha');
    expect(page.feature.id).toBe('alpha');
  });

  it('refuses a row naming an entry that does not exist', () => {
    const rows: RowsFile = {
      ...rowsFile,
      rows: [
        {
          id: 'play-now',
          title: 'Play now',
          entries: ['beta', 'alpha', 'no-such-entry'],
        },
        rowsFile.rows[1],
      ],
    };
    const message = refusal(entries, rows).message;
    expect(message).toContain('src/content/rows.yaml');
    expect(message).toContain('play-now');
    expect(message).toContain('no-such-entry');
  });

  it('refuses an entry that is in no row, naming its file and id', () => {
    const rows: RowsFile = {
      ...rowsFile,
      rows: [
        { id: 'play-now', title: 'Play now', entries: ['beta', 'alpha'] },
        { id: 'workshop', title: 'In the workshop', entries: ['gamma'] },
      ],
    };
    const message = refusal(entries, rows).message;
    expect(message).toContain('src/content/entries/delta.yaml');
    expect(message).toContain('delta');
  });

  it('refuses a feature that names no entry, naming the file and the id', () => {
    const message = refusal(entries, {
      ...rowsFile,
      feature: 'nobody',
    }).message;
    expect(message).toContain('src/content/rows.yaml');
    expect(message).toContain('feature');
    expect(message).toContain('nobody');
  });

  it('refuses a row id said twice, naming the file and the id', () => {
    const rows: RowsFile = {
      ...rowsFile,
      rows: [
        { id: 'play-now', title: 'Play now', entries: ['beta', 'alpha'] },
        { id: 'play-now', title: 'Again', entries: ['gamma', 'delta'] },
      ],
    };
    const message = refusal(entries, rows).message;
    expect(message).toContain('src/content/rows.yaml');
    expect(message).toContain('play-now');
  });

  it('refuses an entry said twice in one row, naming the file, row and id', () => {
    const rows: RowsFile = {
      ...rowsFile,
      rows: [
        {
          id: 'play-now',
          title: 'Play now',
          entries: ['beta', 'alpha', 'beta'],
        },
        rowsFile.rows[1],
      ],
    };
    const message = refusal(entries, rows).message;
    expect(message).toContain('src/content/rows.yaml');
    expect(message).toContain('play-now');
    expect(message).toContain('beta');
  });
});
