// Holds the real src/content/catalogue.json to its own schema and to the files
// beside it: every site it names (the feature and each row's) has a file in
// src/content/entries. The cross-file rules of buildPage are tested on small
// catalogues made in the test; this is the one test that reads the real one,
// so that a typo in the file the owner edits fails here, in `check:quick`,
// and not only at the build. It lists the folder as structure.test.ts lists
// its own, so that it needs no file-system module and no YAML parser, and it
// counts what it read so that an empty reading is a failure and not a pass.
import { describe, expect, it } from 'vitest';
import catalogueJson from '../../src/content/catalogue.json';
import { catalogueShape } from '../../src/catalogue/schema';

const files = import.meta.glob<string>('../../src/content/entries/*.yaml', {
  query: '?raw',
  import: 'default',
  eager: true,
});

/** The ids that have a file, from the file names. */
function fileIds(names: string[]): string[] {
  return names.map((name) => /([^/]+)\.yaml$/.exec(name)?.[1] ?? name).sort();
}

/** Every site a catalogue names: the feature, then each row's, in order. */
function named(catalogue: {
  feature: string;
  features?: string[];
  rows: { sites: string[] }[];
}) {
  return [
    catalogue.feature,
    ...(catalogue.features ?? []),
    ...catalogue.rows.flatMap((row) => row.sites),
  ];
}

/** The sites named that have no file, each with where it was named. */
function withoutFile(
  catalogue: {
    feature: string;
    features?: string[];
    rows: { id: string; sites: string[] }[];
  },
  ids: string[],
): string[] {
  const missing: string[] = [];
  if (!ids.includes(catalogue.feature))
    missing.push(`feature ${catalogue.feature}`);
  for (const site of catalogue.features ?? [])
    if (!ids.includes(site)) missing.push(`features ${site}`);
  for (const row of catalogue.rows)
    for (const site of row.sites)
      if (!ids.includes(site)) missing.push(`${row.id} ${site}`);
  return missing;
}

describe('src/content/catalogue.json', () => {
  const ids = fileIds(Object.keys(files));

  it('has site files to read, so that an empty folder is not a pass', () => {
    expect(ids.length).toBeGreaterThanOrEqual(19);
  });

  it('meets the schema', () => {
    const result = catalogueShape.safeParse(catalogueJson);
    expect(result.error?.issues ?? []).toEqual([]);
  });

  it('names sites, so that an empty reading is not a pass', () => {
    expect(named(catalogueJson).length).toBeGreaterThanOrEqual(19);
    expect(catalogueJson.rows.length).toBeGreaterThanOrEqual(4);
  });

  it('names no site that has no file', () => {
    expect(withoutFile(catalogueJson, ids)).toEqual([]);
  });

  it('has a list of features, so that reading none is not a pass', () => {
    // Part 6 of plans/effects.md sets three. If the owner empties the list
    // this is the one test to change, on purpose.
    expect(catalogueJson.features.length).toBeGreaterThanOrEqual(1);
    expect(catalogueJson.features).toEqual(
      expect.arrayContaining(['aquaclysm', 'ooergolf', 'chopdrop']),
    );
  });

  it('repeats none of the features, and none is the feature itself', () => {
    const all = [catalogueJson.feature, ...catalogueJson.features];
    expect(new Set(all).size).toBe(all.length);
  });

  it('is seen to refuse a site with no file (the check itself)', () => {
    const broken = {
      feature: 'nuclear-fishin',
      rows: [{ id: 'play-now', sites: ['nuclear-fishin', 'no-such-site'] }],
    };
    expect(withoutFile(broken, ids)).toEqual(['play-now no-such-site']);
    expect(withoutFile({ ...broken, feature: 'nobody' }, ids)).toContain(
      'feature nobody',
    );
    expect(withoutFile({ ...broken, features: ['nobody'] }, ids)).toContain(
      'features nobody',
    );
  });
});
