// Turns the entries and the rows file into the page's model: the feature, then
// each row with its cards, in the order written. It also checks what no single
// file can check alone (a row naming an entry that is not there, an entry in
// no row), and refuses by file and id. Without it the page would hold that
// logic, a broken catalogue would draw a gap or a blank card, and the build
// would not stop.
import type { RowsFile } from './schema';

const ROWS_FILE = 'src/content/rows.yaml';

function entryFile(id: string): string {
  return `src/content/entries/${id}.yaml`;
}

/** A refusal of the catalogue, whose message names the file and the id. */
export class CatalogueError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CatalogueError';
  }
}

/** An entry as parsed by the schema, with its id (the file's name) added. */
export interface Entry<Picture> {
  id: string;
  title: string;
  kind: 'game' | 'toy';
  description: string;
  picture: Picture;
  pictureAlt: string;
  url?: string | undefined;
}

/** What one card draws. `href` and `linkName` exist only where there is a link. */
export interface Card<Picture> {
  id: string;
  title: string;
  kind: 'game' | 'toy';
  description: string;
  picture: Picture;
  pictureAlt: string;
  label: string;
  href?: string;
  linkName?: string;
}

export interface Page<Picture> {
  feature: Card<Picture>;
  rows: { id: string; title: string; cards: Card<Picture>[] }[];
}

const KIND_WORDS = { game: 'Game', toy: 'Toy' } as const;

function cardOf<Picture>(entry: Entry<Picture>): Card<Picture> {
  const playable = entry.url !== undefined;
  const card: Card<Picture> = {
    id: entry.id,
    title: entry.title,
    kind: entry.kind,
    description: entry.description,
    picture: entry.picture,
    pictureAlt: entry.pictureAlt,
    label: `${KIND_WORDS[entry.kind]} · ${playable ? 'Play now' : 'In the workshop'}`,
  };
  if (entry.url !== undefined) {
    card.href = entry.url;
    card.linkName = `Play ${entry.title}`;
  }
  return card;
}

/**
 * The page's model. Throws a CatalogueError, the first it finds, for a
 * catalogue that does not hold together. Rows are checked in the order
 * written, so the first fault named is the first a person would reach.
 */
export function buildPage<Picture>(
  entries: Entry<Picture>[],
  rowsFile: RowsFile,
): Page<Picture> {
  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  const used = new Set<string>();
  const rowIds = new Set<string>();

  const rows = rowsFile.rows.map((row) => {
    if (rowIds.has(row.id)) {
      throw new CatalogueError(
        `${ROWS_FILE}: the row id "${row.id}" is said twice, and a row id is an anchor that must be one place.`,
      );
    }
    rowIds.add(row.id);

    const inThisRow = new Set<string>();
    const cards = row.entries.map((id) => {
      const entry = byId.get(id);
      if (entry === undefined) {
        throw new CatalogueError(
          `${ROWS_FILE}: the row "${row.id}" names the entry "${id}", and there is no ${entryFile(id)}.`,
        );
      }
      if (inThisRow.has(id)) {
        throw new CatalogueError(
          `${ROWS_FILE}: the row "${row.id}" names the entry "${id}" twice.`,
        );
      }
      inThisRow.add(id);
      used.add(id);
      return cardOf(entry);
    });
    return { id: row.id, title: row.title, cards };
  });

  const feature = byId.get(rowsFile.feature);
  if (feature === undefined) {
    throw new CatalogueError(
      `${ROWS_FILE}: the field "feature" names the entry "${rowsFile.feature}", and there is no ${entryFile(rowsFile.feature)}.`,
    );
  }

  for (const entry of entries) {
    if (!used.has(entry.id)) {
      throw new CatalogueError(
        `${entryFile(entry.id)}: the entry "${entry.id}" is in no row of ${ROWS_FILE}.`,
      );
    }
  }

  return { feature: cardOf(feature), rows };
}
