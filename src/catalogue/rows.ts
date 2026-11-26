// Turns the entries and the catalogue file into the page's model: the feature,
// then each row with its cards, in the order written, the best of them marked
// to shine. It also checks what no single file can check alone (a row naming a
// site that has no file, an id said twice, a best site in no row), and refuses
// by file and id, and it says which sites have a file and are listed nowhere,
// which is allowed and is how a site is left out. Without it the page would
// hold that logic, a broken catalogue would draw a gap or a
// blank card, the build would not stop, and a site left out by mistake would
// not be seen.
import { fitsTouch, needsWords } from './fitting';
import type { Need } from './fitting';
import type { Requirement } from './webgpu';
import type { CatalogueFile, Kind } from './schema';

/**
 * The finishes a card's foil may have, a decoration only: `holo` is a best
 * card's, `gold`, `galaxy` and `ice` are those a catalogue's `finishes` names,
 * and `reverse` is every other card's.
 */
export const FINISHES = ['holo', 'gold', 'galaxy', 'ice', 'reverse'] as const;
export type Finish = (typeof FINISHES)[number];

/** The finishes a catalogue file names lists for. */
const LISTED = ['gold', 'galaxy', 'ice'] as const;

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
  kind: Kind;
  description: string;
  picture: Picture;
  pictureAlt: string;
  loop?: string | undefined;
  heroLoop?: string | undefined;
  url?: string | undefined;
  needs?: Need[] | undefined;
  requires?: Requirement[] | undefined;
}

/** What one card draws. `href`, `linkText` and `linkName` exist only where there is a link. */
export interface Card<Picture> {
  id: string;
  title: string;
  kind: Kind;
  description: string;
  picture: Picture;
  pictureAlt: string;
  /** The entry's loop as written, a path relative to its file; absent where there is none. */
  loop?: string;
  /** The entry's hero loop as written, where it has one: what the day's feature plays. */
  heroLoop?: string;
  label: string;
  /** True for a row's card of one of the best sites, which shines; never for the feature. */
  best: boolean;
  /** How the card's foil is finished: holo for a best card, its list's name, else reverse. */
  finish: Finish;
  /** The name of the button that turns the card over to its back, on every card. */
  aboutName: string;
  /** The name of the button that turns it back to its front, on every card. */
  closeName: string;
  href?: string;
  /** What the link says to a sighted reader, where there is a link. */
  linkText?: string;
  /** What it is named to a screen reader: its text and the new window's words. */
  linkName?: string;
  /** What the site needs of a device, where the entry says (every linked one must). */
  needs?: Need[];
  /** The words that say it, from fitting.ts; present exactly when `needs` is. */
  needsWords?: string;
  /** Whether the site plays by touch (needs nothing); present exactly when `needs` is. */
  fitsTouch?: boolean;
  /**
   * What the site requires of the browser (webgpu.ts), present only when the
   * entry says something: a card that requires nothing carries no key, so the
   * page writes no attribute for it.
   */
  requires?: Requirement[];
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

const KIND_WORDS: Record<Kind, string> = {
  game: 'Game',
  toy: 'Toy',
  tool: 'Tool',
};

/**
 * What the label of a best card says after its kind, where another's says
 * whether it can be played: the words that say it shines, so that the foil is
 * not the only thing that does (colour and sheen never say a thing alone). A
 * draft, said here and nowhere else, for the owner to edit.
 */
const BEST_WORDS = 'Top pick';

function cardOf<Picture>(
  entry: Entry<Picture>,
  best = false,
  finish: Finish = 'reverse',
): Card<Picture> {
  const playable = entry.url !== undefined;
  // A card is a link out, and a visitor must be told what the site needs
  // before they leave, so a linked entry that does not say is refused.
  if (playable && entry.needs === undefined) {
    throw new CatalogueError(
      `${entryFile(entry.id)}: the site "${entry.id}" has a url and says no "needs", and a card must say what its site needs before a visitor is sent there (an empty list, needs: [], says it needs nothing).`,
    );
  }
  const state = best ? BEST_WORDS : playable ? 'Play now' : 'In the workshop';
  const card: Card<Picture> = {
    id: entry.id,
    title: entry.title,
    kind: entry.kind,
    description: entry.description,
    picture: entry.picture,
    pictureAlt: entry.pictureAlt,
    label: `${KIND_WORDS[entry.kind]} · ${state}`,
    best,
    finish: best ? 'holo' : finish,
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
  if (entry.needs !== undefined) {
    card.needs = entry.needs;
    card.needsWords = needsWords(entry.needs);
    card.fitsTouch = fitsTouch(entry.needs);
  }
  if (entry.requires !== undefined && entry.requires.length > 0) {
    card.requires = entry.requires;
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
  // Read before the rows are drawn, since each card is marked as it is made;
  // checked after them, below, since whether a best site is in a row needs
  // the rows.
  const best = new Set(config.best ?? []);
  const finishOf = new Map<string, Finish>();
  for (const name of LISTED) {
    for (const id of config.finishes?.[name] ?? []) finishOf.set(id, name);
  }
  const inRows = new Set<string>();

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
      inRows.add(id);
      return cardOf(entry, best.has(id), finishOf.get(id));
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

  // The best are checked in the order written. A best site in no row would
  // shine nowhere, and a field that is ignored looks as though it works, so
  // it is refused as a missing file is.
  const inBest = new Set<string>();
  for (const id of config.best ?? []) {
    if (!byId.has(id)) {
      throw new CatalogueError(
        `${CATALOGUE_FILE}: the field "best" names the site "${id}", and there is no ${entryFile(id)}.`,
      );
    }
    if (inBest.has(id)) {
      throw new CatalogueError(
        `${CATALOGUE_FILE}: the field "best" names the site "${id}" twice.`,
      );
    }
    if (!inRows.has(id)) {
      throw new CatalogueError(
        `${CATALOGUE_FILE}: the field "best" names the site "${id}", which is in no row, so it would shine nowhere.`,
      );
    }
    inBest.add(id);
  }

  // The finishes are checked after the best, list by list in the order gold,
  // galaxy, ice, and each in the order written: a missing file, then an id
  // already named (in this list or an earlier one), then one in no row, then
  // a best site (it is holo already), so that the fault named is the first a
  // person would reach, as for the best above.
  const inFinishes = new Set<string>();
  for (const name of LISTED) {
    const field = `finishes.${name}`;
    for (const id of config.finishes?.[name] ?? []) {
      if (!byId.has(id)) {
        throw new CatalogueError(
          `${CATALOGUE_FILE}: the field "${field}" names the site "${id}", and there is no ${entryFile(id)}.`,
        );
      }
      if (inFinishes.has(id)) {
        throw new CatalogueError(
          `${CATALOGUE_FILE}: the field "${field}" names the site "${id}" twice, and a card has one finish.`,
        );
      }
      if (!inRows.has(id)) {
        throw new CatalogueError(
          `${CATALOGUE_FILE}: the field "${field}" names the site "${id}", which is in no row, so it would shine nowhere.`,
        );
      }
      if (best.has(id)) {
        throw new CatalogueError(
          `${CATALOGUE_FILE}: the field "${field}" names the site "${id}", which is in "best" and is holo already.`,
        );
      }
      inFinishes.add(id);
    }
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
