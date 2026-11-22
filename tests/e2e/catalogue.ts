// Reads the row and site ids out of src/content/catalogue.json so that the
// specs can say what the page ought to hold without copying it. Without it
// each spec would hard-code the catalogue and go stale the first time a row
// was added.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export interface RowFile {
  id: string;
  title: string;
  entries: string[];
}

export interface RowsFile {
  feature: string;
  /** More sites the feature may be, after `feature`, in order. */
  features: string[];
  rows: RowFile[];
}

/** The file as written: a row's list is called "sites". */
interface CatalogueJson {
  feature: string;
  features?: string[];
  rows: { id: string; title: string; sites: string[] }[];
}

export function readRows(): RowsFile {
  const text = readFileSync(
    resolve(import.meta.dirname, '../../src/content/catalogue.json'),
    'utf8',
  );
  const parsed = JSON.parse(text) as CatalogueJson;
  // The specs say "entries" of what a row holds, and the page still draws
  // entries, so the name is kept here and not changed in every spec.
  return {
    feature: parsed.feature,
    features: parsed.features ?? [],
    rows: parsed.rows.map((row) => ({
      id: row.id,
      title: row.title,
      entries: row.sites,
    })),
  };
}

/** The four label lines the model can make. */
export const LABELS = [
  'Game · Play now',
  'Game · In the workshop',
  'Toy · Play now',
  'Toy · In the workshop',
];

/** The sites the day's feature is taken from, in order: `feature`, then `features`. */
export function candidatesOf(catalogue: RowsFile): string[] {
  return [catalogue.feature, ...catalogue.features];
}
