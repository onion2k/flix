// Holds the catalogue's two schemas (an entry, and the one JSON file that says
// which sites are listed, in which rows) to what spec 8 says the build
// refuses: an unknown field, a missing one, a url that is not https, and an
// empty row.
// Each case reads the issue's path or the name it carries, not just that
// parsing failed, because a refusal that does not say where is no use to the
// person reading the build's output. The picture field is a plain string here:
// the schema is given its picture, and never learns what one is.
import { describe, expect, it } from 'vitest';
import { z } from 'astro/zod';
import { entryShape, catalogueShape } from '../../src/catalogue/schema';

const shape = entryShape(z.string().min(1));

const goodEntry = {
  title: 'Nuclear Fishin',
  kind: 'game',
  description: 'A calm, cosy fishing game.',
  picture: '../pictures/nuclear-fishin.png',
  pictureAlt: 'A green lake below a dark rock face.',
  url: 'https://fish.ooer.com',
};

const goodCatalogue = {
  feature: 'nuclear-fishin',
  rows: [
    { id: 'play-now', title: 'Play now', sites: ['nuclear-fishin'] },
    { id: 'in-the-workshop', title: 'In the workshop', sites: ['ooergolf'] },
  ],
};

interface Refusal {
  path: string;
  code: string;
  message: string;
  keys?: string[];
}

// What a parse refused, as plain data: the path joined with dots, so that a
// test names where it expects the fault and no more.
function refusals(schema: z.ZodType, value: unknown): Refusal[] {
  const result = schema.safeParse(value);
  if (result.success) return [];
  return result.error.issues.map((issue) => ({
    path: issue.path.join('.'),
    code: issue.code,
    message: issue.message,
    ...('keys' in issue ? { keys: issue.keys } : {}),
  }));
}

function without(value: Record<string, unknown>, field: string): object {
  const copy: Record<string, unknown> = { ...value };
  delete copy[field];
  return copy;
}

describe('entryShape', () => {
  it('passes a good entry, with a url and without one', () => {
    expect(refusals(shape, goodEntry)).toEqual([]);
    expect(refusals(shape, without(goodEntry, 'url'))).toEqual([]);
  });

  it('accepts the toy kind too', () => {
    expect(refusals(shape, { ...goodEntry, kind: 'toy' })).toEqual([]);
  });

  it('refuses an unknown field, naming it', () => {
    const found = refusals(shape, { ...goodEntry, colour: 'red' });
    expect(found).toHaveLength(1);
    expect(found[0]?.code).toBe('unrecognized_keys');
    expect(found[0]?.keys).toEqual(['colour']);
    expect(found[0]?.message).toContain('colour');
  });

  for (const field of [
    'title',
    'kind',
    'description',
    'picture',
    'pictureAlt',
  ]) {
    it(`refuses an entry with no ${field}, at ${field}`, () => {
      const found = refusals(shape, without(goodEntry, field));
      expect(found.map((f) => f.path)).toEqual([field]);
    });
  }

  it('refuses a kind that is neither game nor toy, at kind', () => {
    const found = refusals(shape, { ...goodEntry, kind: 'film' });
    expect(found.map((f) => f.path)).toEqual(['kind']);
  });

  it('refuses an http:// url, at url', () => {
    const found = refusals(shape, {
      ...goodEntry,
      url: 'http://fish.ooer.com',
    });
    expect(found.map((f) => f.path)).toEqual(['url']);
  });

  it('refuses a url that is not one, at url', () => {
    const found = refusals(shape, { ...goodEntry, url: 'fish.ooer.com' });
    expect(found.map((f) => f.path)).toEqual(['url']);
  });

  for (const field of ['title', 'description', 'pictureAlt']) {
    it(`refuses an empty ${field}, at ${field}`, () => {
      const found = refusals(shape, { ...goodEntry, [field]: '' });
      expect(found.map((f) => f.path)).toEqual([field]);
    });
  }

  it('refuses an empty picture, at picture, by the schema it was given', () => {
    const found = refusals(shape, { ...goodEntry, picture: '' });
    expect(found.map((f) => f.path)).toEqual(['picture']);
  });
});

describe('catalogueShape', () => {
  it('passes a good catalogue file', () => {
    expect(refusals(catalogueShape, goodCatalogue)).toEqual([]);
  });

  it('refuses an unknown field in the file, naming it', () => {
    const found = refusals(catalogueShape, { ...goodCatalogue, banner: 'x' });
    expect(found[0]?.keys).toEqual(['banner']);
  });

  it('refuses an unknown field in a row, naming it and the row', () => {
    const rows = [{ ...goodCatalogue.rows[0], colour: 'red' }];
    const found = refusals(catalogueShape, { ...goodCatalogue, rows });
    expect(found[0]?.path).toBe('rows.0');
    expect(found[0]?.keys).toEqual(['colour']);
  });

  it('refuses a row that still says "entries" for its sites, naming both', () => {
    const { sites, ...rest } = goodCatalogue.rows[0] ?? { sites: [] };
    const row = { ...rest, entries: sites };
    const found = refusals(catalogueShape, { ...goodCatalogue, rows: [row] });
    expect(found.map((f) => f.path).sort()).toEqual(['rows.0', 'rows.0.sites']);
    expect(found.find((f) => f.path === 'rows.0')?.keys).toEqual(['entries']);
  });

  it('refuses a file that carries a $schema key, since none is allowed', () => {
    const found = refusals(catalogueShape, { ...goodCatalogue, $schema: 'x' });
    expect(found[0]?.keys).toEqual(['$schema']);
  });

  it('refuses a file with no feature, at feature', () => {
    const found = refusals(catalogueShape, without(goodCatalogue, 'feature'));
    expect(found.map((f) => f.path)).toEqual(['feature']);
  });

  it('passes a file with a list of features, an empty one, or none', () => {
    expect(
      refusals(catalogueShape, { ...goodCatalogue, features: ['ooergolf'] }),
    ).toEqual([]);
    expect(
      refusals(catalogueShape, { ...goodCatalogue, features: [] }),
    ).toEqual([]);
    expect(refusals(catalogueShape, goodCatalogue)).toEqual([]);
  });

  it('refuses features that is not a list of ids, at its place', () => {
    expect(
      refusals(catalogueShape, { ...goodCatalogue, features: 'ooergolf' }).map(
        (f) => f.path,
      ),
    ).toEqual(['features']);
    expect(
      refusals(catalogueShape, { ...goodCatalogue, features: ['a', ''] }).map(
        (f) => f.path,
      ),
    ).toEqual(['features.1']);
  });

  it('refuses a file with no rows, and one with an empty list of rows', () => {
    expect(
      refusals(catalogueShape, without(goodCatalogue, 'rows')).map(
        (f) => f.path,
      ),
    ).toEqual(['rows']);
    expect(
      refusals(catalogueShape, { ...goodCatalogue, rows: [] }).map(
        (f) => f.path,
      ),
    ).toEqual(['rows']);
  });

  for (const field of ['id', 'title', 'sites']) {
    it(`refuses a row with no ${field}, at rows.0.${field}`, () => {
      const row = without(goodCatalogue.rows[0], field);
      const found = refusals(catalogueShape, { ...goodCatalogue, rows: [row] });
      expect(found.map((f) => f.path)).toEqual([`rows.0.${field}`]);
    });
  }

  it('refuses an empty row, at its sites', () => {
    const row = { ...goodCatalogue.rows[0], sites: [] };
    const found = refusals(catalogueShape, { ...goodCatalogue, rows: [row] });
    expect(found.map((f) => f.path)).toEqual(['rows.0.sites']);
  });

  it('refuses an empty site id in a row, at its place in the row', () => {
    const row = { ...goodCatalogue.rows[0], sites: [''] };
    const found = refusals(catalogueShape, { ...goodCatalogue, rows: [row] });
    expect(found.map((f) => f.path)).toEqual(['rows.0.sites.0']);
  });

  for (const id of ['Play-now', 'play now', 'play_now', '', 'café']) {
    it(`refuses the row id ${JSON.stringify(id)}, at rows.0.id`, () => {
      const row = { ...goodCatalogue.rows[0], id };
      const found = refusals(catalogueShape, { ...goodCatalogue, rows: [row] });
      expect(found.map((f) => f.path)).toEqual(['rows.0.id']);
    });
  }

  it('accepts a row id of lower-case letters, digits and hyphens', () => {
    const row = { ...goodCatalogue.rows[0], id: 'top-10-games' };
    expect(refusals(catalogueShape, { ...goodCatalogue, rows: [row] })).toEqual(
      [],
    );
  });
});
