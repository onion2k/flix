// Holds the page-weight gate's judgement with figures handed to it on both
// sides of each line: a count that rises or falls, bytes over and under the
// tolerance, a drop as much as a rise, and the two budgets. The measuring is
// a browser's and is in tests/gates; this is only the rule.
import { describe, expect, it } from 'vitest';
import {
  judge,
  kindOf,
  overBudget,
  pageWithoutPictures,
  type Weight,
} from '../gates/judging';

const base: Weight = {
  document: { count: 1, bytes: 1000, gzip: 400 },
  script: { count: 1, bytes: 500, gzip: 200 },
  stylesheet: { count: 0, bytes: 0, gzip: 0 },
  font: { count: 3, bytes: 36000 },
  image: { count: 5, bytes: 100000 },
  media: { count: 1, bytes: 300000 },
  cardLoop: { count: 0, bytes: 0 },
  other: { count: 0, bytes: 0 },
};

function with_(
  kind: keyof Weight,
  change: Partial<Weight[typeof kind]>,
): Weight {
  return { ...base, [kind]: { ...base[kind], ...change } };
}

describe('judge', () => {
  it('finds nothing in a copy', () => {
    expect(judge(base, structuredClone(base), 0)).toEqual([]);
  });

  it('fails a count that rises and one that falls', () => {
    expect(judge(base, with_('image', { count: 6 }), 0.5)).toHaveLength(1);
    expect(judge(base, with_('font', { count: 2 }), 0.5)).toHaveLength(1);
  });

  it('holds bytes exactly when the tolerance is 0, up and down', () => {
    expect(judge(base, with_('image', { bytes: 100001 }), 0)).toHaveLength(1);
    expect(judge(base, with_('image', { bytes: 99999 }), 0)).toHaveLength(1);
  });

  it('lets bytes wobble inside the tolerance and fails them outside it', () => {
    expect(judge(base, with_('image', { bytes: 101000 }), 0.02)).toEqual([]);
    expect(judge(base, with_('image', { bytes: 99000 }), 0.02)).toEqual([]);
    expect(judge(base, with_('image', { bytes: 103000 }), 0.02)).toHaveLength(
      1,
    );
    expect(judge(base, with_('image', { bytes: 97000 }), 0.02)).toHaveLength(1);
  });

  it('says a kind the baseline does not have, and does not stop at it', () => {
    const older: Partial<Weight> = structuredClone(base);
    delete older.cardLoop;
    expect(judge(older as Weight, base, 0)).toEqual([
      'cardLoop has no baseline',
    ]);
  });

  it('holds the gzipped figure as well as the raw one', () => {
    expect(judge(base, with_('document', { gzip: 401 }), 0)).toEqual([
      'document gzip rose: 400 to 401',
    ]);
  });
});

describe('budgets', () => {
  it('adds the text kinds gzipped to the fonts, and leaves the pictures and the hero loop out', () => {
    expect(pageWithoutPictures(base)).toBe(400 + 200 + 0 + 36000);
  });

  it('names a budget that is passed, and nothing when none is', () => {
    const budgets = {
      pageWithFontsNoPicturesBytes: 36600,
      firstScreenPicturesDeskBytes: 100000,
      heroLoopBytes: 300000,
      cardLoopBytes: 250000,
    };
    expect(overBudget(base, budgets)).toEqual([]);
    expect(
      overBudget(base, { ...budgets, pageWithFontsNoPicturesBytes: 36599 }),
    ).toHaveLength(1);
    expect(
      overBudget(base, { ...budgets, firstScreenPicturesDeskBytes: 99999 }),
    ).toHaveLength(1);
  });

  it('holds the hero loop to its own budget, apart from the pictures', () => {
    const budgets = {
      pageWithFontsNoPicturesBytes: 36600,
      firstScreenPicturesDeskBytes: 100000,
      heroLoopBytes: 300000,
      cardLoopBytes: 250000,
    };
    expect(overBudget(base, { ...budgets, heroLoopBytes: 300000 })).toEqual([]);
    const over = overBudget(base, { ...budgets, heroLoopBytes: 299999 });
    expect(over).toHaveLength(1);
    expect(over[0]).toContain('hero loop');
    // A loop that fits in the pictures' budget does not count against it, and
    // a loop over the pictures' budget is not a picture over budget.
    expect(
      overBudget(base, { ...budgets, firstScreenPicturesDeskBytes: 299999 }),
    ).toHaveLength(0);
  });

  it('counts the hero loop out of the page without pictures', () => {
    expect(
      pageWithoutPictures({ ...base, media: { count: 1, bytes: 900000 } }),
    ).toBe(400 + 200 + 36000);
  });

  it('counts a card loop out of the page without pictures', () => {
    expect(
      pageWithoutPictures({ ...base, cardLoop: { count: 1, bytes: 200000 } }),
    ).toBe(400 + 200 + 36000);
  });
});

describe('card loops', () => {
  const budgets = {
    pageWithFontsNoPicturesBytes: 36600,
    firstScreenPicturesDeskBytes: 100000,
    heroLoopBytes: 300000,
    cardLoopBytes: 250000,
  };

  it('holds each card loop to its budget: under and at pass, over fails', () => {
    expect(overBudget(base, budgets, 'desk', [249999])).toEqual([]);
    expect(overBudget(base, budgets, 'desk', [250000])).toEqual([]);
    const over = overBudget(base, budgets, 'desk', [250001]);
    expect(over).toHaveLength(1);
    expect(over[0]).toContain('card loop');
    expect(over[0]).toContain('250001');
  });

  it('holds each one apart, not their sum, and names each one over', () => {
    expect(overBudget(base, budgets, 'desk', [200000, 200000])).toEqual([]);
    expect(
      overBudget(base, budgets, 'phone', [100, 260000, 250000, 300000]),
    ).toHaveLength(2);
  });

  it('holds the hero loop to its own budget and not a card loop’s, and the other way about', () => {
    // A hero loop of 300000 is over a card loop's 250000 and within its own.
    expect(overBudget(base, budgets, 'desk', [])).toEqual([]);
    // A card loop of 260000 is within the hero's 300000 and over its own.
    expect(overBudget(base, budgets, 'desk', [260000])).toHaveLength(1);
    const hero = overBudget(
      { ...base, media: { count: 1, bytes: 300001 } },
      budgets,
      'desk',
      [100],
    );
    expect(hero).toHaveLength(1);
    expect(hero[0]).toContain('hero loop');
  });
});

describe('kindOf', () => {
  const table = [
    ['media', '/_astro/aquaclysm.hero.CH4NDj64.webm', 'media'],
    ['media', '/_astro/ooergolf.hero.I2bcyXb3.webm', 'media'],
    ['media', '/_astro/aquaclysm.DsRHxV_o.webm', 'cardLoop'],
    ['media', '/_astro/codex-squadron.Bsb3KTL_.webm', 'cardLoop'],
    ['image', '/_astro/aquaclysm.hero.CH4NDj64.avif', 'image'],
    ['document', '/', 'document'],
    ['fetch', '/x', 'other'],
  ] as const;

  it('has its cases', () => {
    expect(table).toHaveLength(7);
  });

  for (const [type, path, kind] of table)
    it(`calls a ${type} at ${path} ${kind}`, () => {
      expect(kindOf(type, path)).toBe(kind);
    });
});
