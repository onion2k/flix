// Holds buildPage to spec 1 and 2 (order, the kind-and-state line, a link only
// where there is an address), to the names of the two buttons that flip every
// card (said once here, as drafts the owner will edit), and to the refusals of spec 8 that the schemas
// cannot make because they look across files: a row naming a site that has no
// file, a feature naming nothing, an id said twice. A site that has a file and
// is in no row is not a refusal: it is returned as not listed, and the build
// says so. Each refusal is read for the file and the id in its message, since
// the build prints that message and it is all the person has to go on.
import { describe, expect, it } from 'vitest';
import {
  buildPage,
  CatalogueError,
  NEW_WINDOW,
  FINISHES,
} from '../../src/catalogue/rows';
import type { Entry } from '../../src/catalogue/rows';
import type { CatalogueFile, Kind } from '../../src/catalogue/schema';
import type { Need } from '../../src/catalogue/fitting';

// The picture is passed through untouched, so the test uses an object it can
// compare by identity: the module must not look inside it.
function entry(
  id: string,
  withUrl: boolean,
  kind: Kind = 'game',
  needs?: Need[],
) {
  // A linked entry must say what it needs, so a helper's default is nothing.
  const said = needs ?? (withUrl ? [] : undefined);
  return {
    id,
    title: `Title of ${id}`,
    kind,
    description: `About ${id}.`,
    picture: { src: `/${id}.png` },
    pictureAlt: `A picture of ${id}.`,
    ...(withUrl ? { url: `https://${id}.example.com` } : {}),
    ...(said === undefined ? {} : { needs: said }),
  } satisfies Entry<{ src: string }>;
}

const entries = [
  entry('alpha', true),
  entry('beta', true),
  entry('gamma', false),
  entry('delta', false, 'toy'),
];

const config: CatalogueFile = {
  feature: 'beta',
  rows: [
    { id: 'play-now', title: 'Play now', sites: ['beta', 'alpha'] },
    { id: 'workshop', title: 'In the workshop', sites: ['gamma', 'delta'] },
  ],
};

function refusal(
  entriesIn: Entry<unknown>[],
  rows: CatalogueFile,
): CatalogueError {
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
    const page = buildPage(entries, config);
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
    expect(buildPage(entries, config).feature.id).toBe('beta');
  });

  it('gives a card with an address its link, its name and "Play now"', () => {
    const card = buildPage(entries, config).rows[0]?.cards[1];
    expect(card).toEqual({
      id: 'alpha',
      title: 'Title of alpha',
      kind: 'game',
      description: 'About alpha.',
      picture: { src: '/alpha.png' },
      pictureAlt: 'A picture of alpha.',
      label: 'Game · Play now',
      best: false,
      finish: 'reverse',
      aboutName: 'About Title of alpha',
      closeName: 'Close Title of alpha',
      href: 'https://alpha.example.com',
      linkText: 'Play Title of alpha',
      linkName: 'Play Title of alpha (opens in a new window)',
      needs: [],
      needsWords: 'Plays on a phone or a computer.',
      fitsTouch: true,
    });
  });

  it('names the two buttons that flip every card, linked or not, from its title', () => {
    const page = buildPage(entries, config);
    const cards = page.rows.flatMap((row) => row.cards);
    expect(cards.length).toBe(4);
    for (const card of [...cards, page.feature]) {
      expect(card.aboutName, card.id).toBe(`About ${card.title}`);
      expect(card.closeName, card.id).toBe(`Close ${card.title}`);
    }
    // Both kinds were reached: a card with a link and a card with none.
    expect(cards.some((card) => card.href === undefined)).toBe(true);
    expect(cards.some((card) => card.href !== undefined)).toBe(true);
  });

  it('carries needs, its words and whether it fits touch on a linked card', () => {
    const wanting = [
      entry('keys', true, 'game', ['mouse', 'keyboard']),
      entry('free', true),
      entry('pad', true, 'toy', ['gamepad']),
    ];
    const page = buildPage(wanting, {
      feature: 'keys',
      features: ['pad'],
      rows: [{ id: 'all', title: 'All', sites: ['keys', 'free', 'pad'] }],
    });
    const [keys, free, pad] = page.rows[0]?.cards ?? [];
    expect(keys?.needs).toEqual(['mouse', 'keyboard']);
    expect(keys?.needsWords).toBe('Needs a keyboard and a mouse.');
    expect(keys?.fitsTouch).toBe(false);
    expect(free?.needs).toEqual([]);
    expect(free?.needsWords).toBe('Plays on a phone or a computer.');
    expect(free?.fitsTouch).toBe(true);
    expect(pad?.needsWords).toBe('Needs a gamepad.');
    expect(pad?.fitsTouch).toBe(false);
    // The feature and every candidate say it too.
    expect(page.feature.needsWords).toBe('Needs a keyboard and a mouse.');
    expect(page.candidates.map((card) => card.needsWords)).toEqual([
      'Needs a keyboard and a mouse.',
      'Needs a gamepad.',
    ]);
  });

  it('lets an entry with no address leave needs out, and keeps them if it has them', () => {
    const page = buildPage(
      [entry('shop', false), entry('bench', false, 'tool', ['keyboard'])],
      {
        feature: 'shop',
        rows: [{ id: 'w', title: 'W', sites: ['shop', 'bench'] }],
      },
    );
    const [shop, bench] = page.rows[0]?.cards ?? [];
    expect(shop).toBeDefined();
    expect(shop && 'needs' in shop).toBe(false);
    expect(shop && 'needsWords' in shop).toBe(false);
    expect(shop && 'fitsTouch' in shop).toBe(false);
    expect(bench?.needs).toEqual(['keyboard']);
    expect(bench?.needsWords).toBe('Needs a keyboard.');
    expect(bench?.fitsTouch).toBe(false);
  });

  it('refuses a linked entry that says no needs, naming its file and id, in a row, as the feature and as a candidate', () => {
    const bare: Entry<{ src: string }> = {
      ...entry('bare', true),
      needs: undefined,
    };
    const ok = entry('ok', true);
    const inRow = refusal([bare, ok], {
      feature: 'ok',
      rows: [{ id: 'r', title: 'R', sites: ['bare'] }],
    });
    expect(inRow.message).toContain('src/content/entries/bare.yaml');
    expect(inRow.message).toContain('"bare"');
    expect(inRow.message).toContain('needs');
    const asFeature = refusal([bare, ok], {
      feature: 'bare',
      rows: [{ id: 'r', title: 'R', sites: ['ok'] }],
    });
    expect(asFeature.message).toContain('src/content/entries/bare.yaml');
    const asCandidate = refusal([bare, ok], {
      feature: 'ok',
      features: ['bare'],
      rows: [{ id: 'r', title: 'R', sites: ['ok'] }],
    });
    expect(asCandidate.message).toContain('src/content/entries/bare.yaml');
  });

  it('says in one constant that a link opens in a new window, and ends a card’s name with it', () => {
    expect(NEW_WINDOW).toBe('(opens in a new window)');
    const card = buildPage(entries, config).rows[0]?.cards[1];
    expect(card?.linkName?.endsWith(` ${NEW_WINDOW}`)).toBe(true);
  });

  it('says "Tool" in a tool’s label, linked, in the workshop and a top pick', () => {
    const tools = [entry('use', true, 'tool'), entry('bench', false, 'tool')];
    const page = buildPage(tools, {
      feature: 'use',
      best: ['bench'],
      rows: [{ id: 'tools', title: 'Tools', sites: ['use', 'bench'] }],
    });
    expect(page.feature.label).toBe('Tool · Play now');
    expect(page.rows[0]?.cards.map((card) => card.label)).toEqual([
      'Tool · Play now',
      'Tool · Top pick',
    ]);
    const unpicked = buildPage(tools, {
      feature: 'use',
      rows: [{ id: 'tools', title: 'Tools', sites: ['bench'] }],
    });
    expect(unpicked.rows[0]?.cards[0]?.label).toBe('Tool · In the workshop');
  });

  it('gives a card without an address no link and "In the workshop"', () => {
    const card = buildPage(entries, config).rows[1]?.cards[1];
    expect(card?.label).toBe('Toy · In the workshop');
    expect(card).not.toHaveProperty('href');
    expect(card).not.toHaveProperty('linkName');
    expect(card).not.toHaveProperty('linkText');
  });

  it("passes an entry's loop through as written, and gives a card none where it has none", () => {
    const page = buildPage(
      [
        { ...entry('alpha', true), loop: '../loops/alpha.webm' },
        ...entries.slice(1),
      ],
      config,
    );
    expect(page.rows[0]?.cards[1]?.loop).toBe('../loops/alpha.webm');
    expect(page.rows[0]?.cards[0]).not.toHaveProperty('loop');
    expect(page.feature).not.toHaveProperty('loop');
  });

  it("passes an entry's hero loop through as written, and gives a card none where it has none", () => {
    const page = buildPage(
      [
        { ...entry('alpha', true), heroLoop: '../loops/alpha.hero.webm' },
        ...entries.slice(1),
      ],
      { ...config, feature: 'alpha' },
    );
    expect(page.feature.heroLoop).toBe('../loops/alpha.hero.webm');
    expect(page.candidates[0]?.heroLoop).toBe('../loops/alpha.hero.webm');
    expect(page.rows[0]?.cards[0]).not.toHaveProperty('heroLoop');
  });

  it('passes the picture through untouched, the same object', () => {
    const page = buildPage(entries, config);
    expect(page.rows[0]?.cards[1]?.picture).toBe(entries[0]?.picture);
  });

  it('draws an entry in two rows in both, and the feature too', () => {
    const rows: CatalogueFile = {
      feature: 'alpha',
      rows: [
        { id: 'one', title: 'One', sites: ['alpha', 'beta', 'gamma'] },
        { id: 'two', title: 'Two', sites: ['alpha', 'delta'] },
      ],
    };
    const page = buildPage(entries, rows);
    expect(page.rows[0]?.cards[0]?.id).toBe('alpha');
    expect(page.rows[1]?.cards[0]?.id).toBe('alpha');
    expect(page.feature.id).toBe('alpha');
  });

  it('refuses a row naming a site that has no file', () => {
    const rows: CatalogueFile = {
      ...config,
      rows: [
        {
          id: 'play-now',
          title: 'Play now',
          sites: ['beta', 'alpha', 'no-such-entry'],
        },
        config.rows[1],
      ],
    };
    const message = refusal(entries, rows).message;
    expect(message).toContain('src/content/catalogue.json');
    expect(message).toContain('play-now');
    expect(message).toContain('no-such-entry');
  });

  it('returns a site that is in no row as not listed, and does not throw', () => {
    const rows: CatalogueFile = {
      ...config,
      rows: [
        { id: 'play-now', title: 'Play now', sites: ['beta', 'alpha'] },
        { id: 'workshop', title: 'In the workshop', sites: ['gamma'] },
      ],
    };
    const page = buildPage(entries, rows);
    expect(page.notListed).toEqual(['delta']);
    const drawn = page.rows.flatMap((row) => row.cards.map((card) => card.id));
    expect(drawn).not.toContain('delta');
  });

  it('counts the feature alone as listed', () => {
    const rows: CatalogueFile = {
      feature: 'beta',
      rows: [{ id: 'workshop', title: 'In the workshop', sites: ['gamma'] }],
    };
    expect(buildPage(entries, rows).notListed).toEqual(['alpha', 'delta']);
  });

  it('returns the not listed in a stable order, whatever order the files came in', () => {
    const rows: CatalogueFile = {
      feature: 'beta',
      rows: [{ id: 'one', title: 'One', sites: ['beta'] }],
    };
    const forward = buildPage(entries, rows).notListed;
    const backward = buildPage([...entries].reverse(), rows).notListed;
    expect(forward).toEqual(['alpha', 'delta', 'gamma']);
    expect(backward).toEqual(forward);
  });

  it('returns an empty list when every site is listed', () => {
    expect(buildPage(entries, config).notListed).toEqual([]);
  });

  it('refuses a feature that names a site that has no file, naming the file and the id', () => {
    const message = refusal(entries, {
      ...config,
      feature: 'nobody',
    }).message;
    expect(message).toContain('src/content/catalogue.json');
    expect(message).toContain('feature');
    expect(message).toContain('nobody');
  });

  it('refuses a row id said twice, naming the file and the id', () => {
    const rows: CatalogueFile = {
      ...config,
      rows: [
        { id: 'play-now', title: 'Play now', sites: ['beta', 'alpha'] },
        { id: 'play-now', title: 'Again', sites: ['gamma', 'delta'] },
      ],
    };
    const message = refusal(entries, rows).message;
    expect(message).toContain('src/content/catalogue.json');
    expect(message).toContain('play-now');
  });

  it('refuses a site said twice in one row, naming the file, row and id', () => {
    const rows: CatalogueFile = {
      ...config,
      rows: [
        {
          id: 'play-now',
          title: 'Play now',
          sites: ['beta', 'alpha', 'beta'],
        },
        config.rows[1],
      ],
    };
    const message = refusal(entries, rows).message;
    expect(message).toContain('src/content/catalogue.json');
    expect(message).toContain('play-now');
    expect(message).toContain('beta');
  });
});

describe('buildPage, with a list of features', () => {
  const listed: CatalogueFile = { ...config, features: ['gamma', 'alpha'] };

  it('returns the candidates in order: the feature, then the list', () => {
    const page = buildPage(entries, listed);
    expect(page.candidates.map((card) => card.id)).toEqual([
      'beta',
      'gamma',
      'alpha',
    ]);
    expect(page.feature.id).toBe('beta');
  });

  it('returns the feature alone as the one candidate with no list, or an empty one', () => {
    expect(buildPage(entries, config).candidates.map((c) => c.id)).toEqual([
      'beta',
    ]);
    const empty = buildPage(entries, { ...config, features: [] });
    expect(empty.candidates.map((c) => c.id)).toEqual(['beta']);
  });

  it('draws a candidate as it draws a card: its words, and a link only with an address', () => {
    const page = buildPage(entries, listed);
    expect(page.candidates[1]?.label).toBe('Game · In the workshop');
    expect(page.candidates[1]).not.toHaveProperty('href');
    expect(page.candidates[2]?.href).toBe('https://alpha.example.com');
  });

  it('counts a site named only in features as listed', () => {
    const rows: CatalogueFile = {
      feature: 'beta',
      features: ['delta'],
      rows: [{ id: 'one', title: 'One', sites: ['alpha'] }],
    };
    expect(buildPage(entries, rows).notListed).toEqual(['gamma']);
  });

  it('refuses a feature in the list with no file, naming the file and the id', () => {
    const message = refusal(entries, {
      ...config,
      features: ['nobody'],
    }).message;
    expect(message).toContain('src/content/catalogue.json');
    expect(message).toContain('features');
    expect(message).toContain('nobody');
    expect(message).toContain('src/content/entries/nobody.yaml');
  });

  it('refuses an id said twice in the list, naming the file and the id', () => {
    const message = refusal(entries, {
      ...config,
      features: ['gamma', 'alpha', 'gamma'],
    }).message;
    expect(message).toContain('src/content/catalogue.json');
    expect(message).toContain('features');
    expect(message).toContain('gamma');
    expect(message).toContain('twice');
  });

  it('refuses the feature itself in the list, naming the file and the id', () => {
    const message = refusal(entries, {
      ...config,
      features: ['alpha', 'beta'],
    }).message;
    expect(message).toContain('src/content/catalogue.json');
    expect(message).toContain('beta');
    expect(message).toContain('"feature"');
  });
});

describe('buildPage, with a list of the best', () => {
  const shining: CatalogueFile = { ...config, best: ['alpha', 'delta'] };

  it('marks the best cards, and no other, wherever they are drawn in the rows', () => {
    const page = buildPage(entries, {
      ...shining,
      rows: [
        ...shining.rows,
        { id: 'again', title: 'Again', sites: ['alpha'] },
      ],
    });
    const cards = page.rows.flatMap((row) => row.cards);
    expect(cards.length).toBe(5);
    expect(cards.filter((card) => card.best).map((card) => card.id)).toEqual([
      'alpha',
      'delta',
      'alpha',
    ]);
    expect(cards.filter((card) => !card.best).length).toBe(2);
  });

  it('says so in a best card’s label, in words, so that the shine is not the only thing that says it', () => {
    const page = buildPage(entries, shining);
    const byId = new Map(
      page.rows.flatMap((row) => row.cards).map((card) => [card.id, card]),
    );
    expect(byId.get('alpha')?.label).toBe('Game · Top pick');
    expect(byId.get('delta')?.label).toBe('Toy · Top pick');
    expect(byId.get('beta')?.label).toBe('Game · Play now');
    expect(byId.get('gamma')?.label).toBe('Game · In the workshop');
  });

  it('leaves the feature and its candidates as they were: the shine is a row card’s', () => {
    const page = buildPage(entries, {
      ...shining,
      best: ['beta', 'alpha'],
      features: ['alpha'],
    });
    for (const card of page.candidates) {
      expect(card.best, card.id).toBe(false);
      expect(card.label, card.id).toBe('Game · Play now');
    }
    expect(page.rows[0]?.cards.map((card) => card.best)).toEqual([true, true]);
  });

  it('marks none with no list, or an empty one', () => {
    for (const each of [config, { ...config, best: [] }]) {
      const cards = buildPage(entries, each).rows.flatMap((row) => row.cards);
      expect(cards.length).toBe(4);
      expect(cards.filter((card) => card.best)).toEqual([]);
    }
  });

  it('refuses a best site with no file, naming the file and the id', () => {
    const message = refusal(entries, { ...config, best: ['nobody'] }).message;
    expect(message).toContain('src/content/catalogue.json');
    expect(message).toContain('"best"');
    expect(message).toContain('nobody');
    expect(message).toContain('src/content/entries/nobody.yaml');
  });

  it('refuses a best site said twice, naming the file and the id', () => {
    const message = refusal(entries, {
      ...config,
      best: ['alpha', 'delta', 'alpha'],
    }).message;
    expect(message).toContain('src/content/catalogue.json');
    expect(message).toContain('"best"');
    expect(message).toContain('alpha');
    expect(message).toContain('twice');
  });

  it('refuses a best site that is in no row, since it would shine nowhere, naming the file and the id', () => {
    const rows: CatalogueFile = {
      feature: 'beta',
      rows: [{ id: 'one', title: 'One', sites: ['alpha', 'beta'] }],
      best: ['alpha', 'gamma'],
    };
    const message = refusal(entries, rows).message;
    expect(message).toContain('src/content/catalogue.json');
    expect(message).toContain('"best"');
    expect(message).toContain('gamma');
    expect(message).toContain('in no row');
  });
});

describe('buildPage, with finishes', () => {
  const cardsOf = (page: ReturnType<typeof buildPage>) =>
    new Map(
      page.rows.flatMap((row) => row.cards).map((card) => [card.id, card]),
    );

  it('names the five finishes, once each', () => {
    expect([...FINISHES]).toEqual(['holo', 'gold', 'galaxy', 'ice', 'reverse']);
  });

  it('gives a best card holo, a listed card its list, and every other card reverse', () => {
    const page = buildPage(entries, {
      ...config,
      best: ['alpha'],
      finishes: { gold: ['beta'], galaxy: ['gamma'] },
    });
    const byId = cardsOf(page);
    expect(byId.get('alpha')?.finish).toBe('holo');
    expect(byId.get('beta')?.finish).toBe('gold');
    expect(byId.get('gamma')?.finish).toBe('galaxy');
    expect(byId.get('delta')?.finish).toBe('reverse');
    expect(byId.size).toBe(4);
  });

  it('reaches ice too, and leaves a best card’s words as they were', () => {
    const page = buildPage(entries, {
      ...config,
      best: ['alpha'],
      finishes: { ice: ['delta'] },
    });
    const byId = cardsOf(page);
    expect(byId.get('delta')?.finish).toBe('ice');
    expect(byId.get('delta')?.label).toBe('Toy · In the workshop');
    expect(byId.get('delta')?.best).toBe(false);
    expect(byId.get('alpha')?.label).toBe('Game · Top pick');
  });

  it('gives every non-best card reverse with finishes absent, empty, or with empty lists', () => {
    for (const each of [
      config,
      { ...config, finishes: {} },
      { ...config, finishes: { gold: [], galaxy: [], ice: [] } },
    ]) {
      const cards = buildPage(entries, each).rows.flatMap((row) => row.cards);
      expect(cards.length).toBe(4);
      expect(cards.map((card) => card.finish)).toEqual([
        'reverse',
        'reverse',
        'reverse',
        'reverse',
      ]);
    }
  });

  it('gives the feature and its candidates reverse, since a finish is a row card’s', () => {
    const page = buildPage(entries, {
      ...config,
      features: ['alpha'],
      finishes: { gold: ['alpha'] },
    });
    for (const card of page.candidates) expect(card.finish).toBe('reverse');
  });

  it('refuses a finish site with no file, naming the file, the field and the id', () => {
    const message = refusal(entries, {
      ...config,
      finishes: { gold: ['nobody'] },
    }).message;
    expect(message).toContain('src/content/catalogue.json');
    expect(message).toContain('"finishes.gold"');
    expect(message).toContain('nobody');
    expect(message).toContain('src/content/entries/nobody.yaml');
  });

  it('refuses an id said twice in one list, naming the file, the field and the id', () => {
    const message = refusal(entries, {
      ...config,
      finishes: { ice: ['alpha', 'delta', 'alpha'] },
    }).message;
    expect(message).toContain('src/content/catalogue.json');
    expect(message).toContain('"finishes.ice"');
    expect(message).toContain('alpha');
    expect(message).toContain('twice');
  });

  it('refuses an id said in two lists, naming the file, the second field and the id', () => {
    const message = refusal(entries, {
      ...config,
      finishes: { gold: ['alpha'], galaxy: ['alpha'] },
    }).message;
    expect(message).toContain('src/content/catalogue.json');
    expect(message).toContain('"finishes.galaxy"');
    expect(message).toContain('alpha');
    expect(message).toContain('twice');
  });

  it('refuses an id in no row, since it would shine nowhere, naming the file, the field and the id', () => {
    const message = refusal(entries, {
      feature: 'beta',
      rows: [{ id: 'one', title: 'One', sites: ['alpha', 'beta'] }],
      finishes: { galaxy: ['gamma'] },
    }).message;
    expect(message).toContain('src/content/catalogue.json');
    expect(message).toContain('"finishes.galaxy"');
    expect(message).toContain('gamma');
    expect(message).toContain('in no row');
    expect(message).toContain('shine nowhere');
  });

  it('refuses a best site named in a list, since it is holo already, naming the file, the field and the id', () => {
    const message = refusal(entries, {
      ...config,
      best: ['alpha'],
      finishes: { gold: ['alpha'] },
    }).message;
    expect(message).toContain('src/content/catalogue.json');
    expect(message).toContain('"finishes.gold"');
    expect(message).toContain('alpha');
    expect(message).toContain('"best"');
    expect(message).toContain('holo');
  });
});
