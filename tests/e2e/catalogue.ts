// Reads the row and entry ids out of src/content/rows.yaml so that the specs
// can say what the page ought to hold without copying it. The file has a
// rigid shape (the schema refuses any other), so a regular expression over
// its lines is enough and the project needs no YAML parser. Without it each
// spec would hard-code the catalogue and go stale the first time a row was
// added.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export interface RowFile {
  id: string;
  title: string;
  entries: string[];
}

export interface RowsFile {
  feature: string;
  rows: RowFile[];
}

/** Takes a YAML scalar's quotes off, if it has them. */
function unquote(text: string): string {
  return text.trim().replace(/^(['"])(.*)\1$/, '$2');
}

export function readRows(): RowsFile {
  const text = readFileSync(
    resolve(import.meta.dirname, '../../src/content/rows.yaml'),
    'utf8',
  );
  let feature = '';
  const rows: RowFile[] = [];
  for (const line of text.split('\n')) {
    const featureLine = /^feature:\s*(\S+)/.exec(line);
    const idLine = /^ {2}- id:\s*(\S+)/.exec(line);
    const titleLine = /^ {4}title:\s*(.+)$/.exec(line);
    const entryLine = /^ {6}- ([a-z0-9-]+)\s*$/.exec(line);
    const current = rows[rows.length - 1];
    if (featureLine?.[1] !== undefined) feature = featureLine[1];
    else if (idLine?.[1] !== undefined)
      rows.push({ id: idLine[1], title: '', entries: [] });
    else if (titleLine?.[1] !== undefined && current !== undefined)
      current.title = unquote(titleLine[1]);
    else if (entryLine?.[1] !== undefined && current !== undefined)
      current.entries.push(entryLine[1]);
  }
  return { feature, rows };
}

/** The four label lines the model can make. */
export const LABELS = [
  'Game · Play now',
  'Game · In the workshop',
  'Toy · Play now',
  'Toy · In the workshop',
];
