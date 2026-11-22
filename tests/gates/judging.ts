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
}

/** Compressed bytes of the page without its pictures. */
export function pageWithoutPictures(weight: Weight): number {
  let total = 0;
  for (const kind of KINDS) {
    if (kind === 'image' || kind === 'media') continue;
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
    const was = baseline[kind];
    const now = measured[kind];
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
 * all three; a phone's is held to the loop's alone, since the page and picture
 * budgets are the owner's figures for a desk's first screen.
 */
export function overBudget(
  weight: Weight,
  budgets: Budgets,
  scope: 'desk' | 'phone' = 'desk',
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
  return found;
}
