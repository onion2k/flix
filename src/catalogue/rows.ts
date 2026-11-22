// Turns the entries and the catalogue file into the page's model: the feature,
// then each row with its cards, in the order written. It also checks what no
// single file can check alone (a row naming a site that has no file, an id said
// twice), and refuses by file and id, and it says which sites have a file and
// are listed nowhere, which is allowed and is how a site is left out. Without
// it the page would hold that logic, a broken catalogue would draw a gap or a
// blank card, the build would not stop, and a site left out by mistake would
// not be seen.
import type { CatalogueFile } from './schema';

const CATALOGUE_FILE = 'src/content/catalogue.json';

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
  /** Ids that have an entry file and are neither the feature nor in a row. */
  notListed: string[];
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
 * The page's model, and the sites left out of it. Throws a CatalogueError,
 * the first it finds, for a catalogue that does not hold together. Rows are checked in the order
 * written, so the first fault named is the first a person would reach.
 */
export function buildPage<Picture>(
  entries: Entry<Picture>[],
  config: CatalogueFile,
): Page<Picture> {
  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  const used = new Set<string>();
  const rowIds = new Set<string>();

  const rows = config.rows.map((row) => {
    if (rowIds.has(row.id)) {
      throw new CatalogueError(
        `${CATALOGUE_FILE}: the row id "${row.id}" is said twice, and a row id is an anchor that must be one place.`,
      );
    }
    rowIds.add(row.id);

    const inThisRow = new Set<string>();
    const cards = row.sites.map((id) => {
      const entry = byId.get(id);
      if (entry === undefined) {
        throw new CatalogueError(
          `${CATALOGUE_FILE}: the row "${row.id}" names the site "${id}", and there is no ${entryFile(id)}.`,
        );
      }
      if (inThisRow.has(id)) {
        throw new CatalogueError(
          `${CATALOGUE_FILE}: the row "${row.id}" names the site "${id}" twice.`,
        );
      }
      inThisRow.add(id);
      used.add(id);
      return cardOf(entry);
    });
    return { id: row.id, title: row.title, cards };
  });

  const feature = byId.get(config.feature);
  if (feature === undefined) {
    throw new CatalogueError(
      `${CATALOGUE_FILE}: the field "feature" names the site "${config.feature}", and there is no ${entryFile(config.feature)}.`,
    );
  }

  // A site with a file that no row names is left out on purpose or by
  // mistake, and the catalogue cannot tell which, so it reports and does not
  // refuse. The order is the ids', not the files', so that it is the same on
  // every machine.
  used.add(config.feature);
  const notListed = entries
    .map((entry) => entry.id)
    .filter((id) => !used.has(id))
    .sort();

  return { feature: cardOf(feature), rows, notListed };
}
