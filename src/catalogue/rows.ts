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
  loop?: string | undefined;
  heroLoop?: string | undefined;
  url?: string | undefined;
}

/** What one card draws. `href`, `linkText` and `linkName` exist only where there is a link. */
export interface Card<Picture> {
  id: string;
  title: string;
  kind: 'game' | 'toy';
  description: string;
  picture: Picture;
  pictureAlt: string;
  /** The entry's loop as written, a path relative to its file; absent where there is none. */
  loop?: string;
  /** The entry's hero loop as written, where it has one: what the day's feature plays. */
  heroLoop?: string;
  label: string;
  /** The name of the button that turns the card over to its back, on every card. */
  aboutName: string;
  /** The name of the button that turns it back to its front, on every card. */
  closeName: string;
  href?: string;
  /** What the link says to a sighted reader, where there is a link. */
  linkText?: string;
  /** What it is named to a screen reader: its text and the new window's words. */
  linkName?: string;
}

export interface Page<Picture> {
  /** What shows with script off and what the social card uses. */
  feature: Card<Picture>;
  /**
   * The sites the feature may be, in the order the day's pick takes them: the
   * feature first, then each of the list. One when there is no list.
   */
  candidates: Card<Picture>[];
  rows: { id: string; title: string; cards: Card<Picture>[] }[];
  /** Ids that have an entry file and are neither the feature nor in a row. */
  notListed: string[];
}

/**
 * What every link that leaves the site says before it is followed, in brackets
 * at the end of its name (WCAG 3.2.5, technique G201). A card's name is made
 * with it here, and the page's other links read it from here, so that the
 * words are said once and cannot differ from link to link.
 */
export const NEW_WINDOW = '(opens in a new window)';

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
    // The words of the two buttons that flip a card, said here and nowhere
    // else, since they are drafts the owner will edit: every card flips,
    // whether or not it has a link.
    aboutName: `About ${entry.title}`,
    closeName: `Close ${entry.title}`,
  };
  if (entry.loop !== undefined) card.loop = entry.loop;
  if (entry.heroLoop !== undefined) card.heroLoop = entry.heroLoop;
  if (entry.url !== undefined) {
    card.href = entry.url;
    card.linkText = `Play ${entry.title}`;
    card.linkName = `${card.linkText} ${NEW_WINDOW}`;
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

  // The list is checked in the order written, so that the first fault named
  // is the first a person would reach. The feature is already the first
  // candidate, so it may not be named again, and a day's pick is one site.
  const first = cardOf(feature);
  const candidates = [first];
  const inList = new Set<string>();
  for (const id of config.features ?? []) {
    const entry = byId.get(id);
    if (entry === undefined) {
      throw new CatalogueError(
        `${CATALOGUE_FILE}: the field "features" names the site "${id}", and there is no ${entryFile(id)}.`,
      );
    }
    if (id === config.feature) {
      throw new CatalogueError(
        `${CATALOGUE_FILE}: the field "features" names the site "${id}", which is already the "feature" and comes first without being named again.`,
      );
    }
    if (inList.has(id)) {
      throw new CatalogueError(
        `${CATALOGUE_FILE}: the field "features" names the site "${id}" twice.`,
      );
    }
    inList.add(id);
    used.add(id);
    candidates.push(cardOf(entry));
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

  return { feature: first, candidates, rows, notListed };
}
