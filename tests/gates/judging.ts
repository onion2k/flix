// How the page-weight gate judges: figures in, differences out, and no
// browser anywhere in it. It is apart from the measuring so that the rule
// (counts held exactly, bytes held to a tolerance, a drop failing as surely
// as a rise, a budget a measurement may not pass) has unit tests of its own
// that hand it figures on both sides of each line. Run only whole, a
// judgement that let a change through would look the same as one that passed.

export const KINDS = [
  'document',
  'script',
  'stylesheet',
  'font',
  'image',
  'media',
  'cardLoop',
  'other',
] as const;
export type Kind = (typeof KINDS)[number];

/** The text kinds, which the preview sends uncompressed, are also gzipped. */
export const TEXT_KINDS: readonly Kind[] = ['document', 'script', 'stylesheet'];

export interface Figures {
  count: number;
  bytes: number;
  /** Present for the text kinds only. */
  gzip?: number;
}

export type Weight = Record<Kind, Figures>;

export interface Budgets {
  /** Document, script, stylesheet (gzipped) and fonts: no pictures. */
  pageWithFontsNoPicturesBytes: number;
  /** Every picture the first screen at a desk's width asks for. */
  firstScreenPicturesDeskBytes: number;
  /**
   * The moving hero's loop, which arrives after the page has loaded and is a
   * budget of its own: it is neither a picture nor part of the page's text.
   */
  heroLoopBytes: number;
  /**
   * Each card's loop, held one at a time: one card plays at a time, and a card
   * loop is asked for only once the reader has settled on a card.
   */
  cardLoopBytes: number;
}

/**
 * What a response is, from the browser's own word for it and its path. A loop
 * is media either way; the build names a hero loop <id>.hero.<hash>.webm and a
 * card's <id>.<hash>.webm, so a hero loop is "media", as it has always been
 * counted, and a card's is "cardLoop", apart from it.
 */
export function kindOf(resourceType: string, path: string): Kind {
  if (resourceType === 'media')
    return /\.hero\.[\w-]+\.webm$/.test(path) ? 'media' : 'cardLoop';
  return (KINDS as readonly string[]).includes(resourceType)
    ? (resourceType as Kind)
    : 'other';
}

/** Compressed bytes of the page without its pictures. */
export function pageWithoutPictures(weight: Weight): number {
  let total = 0;
  for (const kind of KINDS) {
    if (kind === 'image' || kind === 'media' || kind === 'cardLoop') continue;
    total += weight[kind].gzip ?? weight[kind].bytes;
  }
  return total;
}

/**
 * What differs from the baseline, in words. Counts must be equal; a figure in
 * bytes may move by `tolerance` of the baseline (0 where the build is the
 * same bytes every time). A drop is a difference as much as a rise, so that
 * it is looked at and the baseline written again on purpose.
 */
export function judge(
  baseline: Weight,
  measured: Weight,
  tolerance: number,
): string[] {
  const found: string[] = [];
  for (const kind of KINDS) {
    // A baseline written before a kind was counted does not have it.
    const was = baseline[kind] as Figures | undefined;
    const now = measured[kind];
    if (was === undefined) {
      found.push(`${kind} has no baseline`);
      continue;
    }
    if (now.count !== was.count)
      found.push(
        `${kind} count ${now.count > was.count ? 'rose' : 'fell'}: ${was.count} to ${now.count}`,
      );
    for (const field of ['bytes', 'gzip'] as const) {
      const before = was[field];
      const after = now[field];
      if (before === undefined && after === undefined) continue;
      if (before === undefined || after === undefined) {
        found.push(`${kind} ${field} is present in only one of them`);
        continue;
      }
      const change = before === 0 ? (after === 0 ? 0 : 1) : after / before - 1;
      if (Math.abs(change) > tolerance)
        found.push(
          `${kind} ${field} ${change > 0 ? 'rose' : 'fell'}: ${before} to ${after}`,
        );
    }
  }
  return found;
}

/**
 * Each budget a measurement is over, said plainly. A desk's width is held to
 * all four; a phone's is held to the loops' alone, since the page and picture
 * budgets are the owner's figures for a desk's first screen. `cardLoops` is the
 * size of each card loop the measurement saw, each held to the card loop's
 * budget on its own.
 */
export function overBudget(
  weight: Weight,
  budgets: Budgets,
  scope: 'desk' | 'phone' = 'desk',
  cardLoops: readonly number[] = [],
): string[] {
  const found: string[] = [];
  if (scope === 'desk') {
    const page = pageWithoutPictures(weight);
    if (page > budgets.pageWithFontsNoPicturesBytes)
      found.push(
        `page with fonts and no pictures is ${page} bytes compressed, over its ${budgets.pageWithFontsNoPicturesBytes}`,
      );
    if (weight.image.bytes > budgets.firstScreenPicturesDeskBytes)
      found.push(
        `first-screen pictures at a desk's width are ${weight.image.bytes} bytes, over their ${budgets.firstScreenPicturesDeskBytes}`,
      );
  }
  if (weight.media.bytes > budgets.heroLoopBytes)
    found.push(
      `the hero loop is ${weight.media.bytes} bytes, over its ${budgets.heroLoopBytes}`,
    );
  for (const bytes of cardLoops)
    if (bytes > budgets.cardLoopBytes)
      found.push(
        `a card loop is ${bytes} bytes, over its ${budgets.cardLoopBytes}`,
      );
  return found;
}
