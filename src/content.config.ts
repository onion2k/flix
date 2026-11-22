// Tells Astro where the catalogue's files are and which schema each must meet:
// an entry a file under src/content/entries, and the catalogue in src/content/catalogue.json.
// Without it Astro would not load them, and nothing would stop an entry with a
// mistyped field or a picture that is not there from reaching the page. The
// schemas are the catalogue's own; only the picture is Astro's, so that it is
// checked to exist and arrives with its size.
import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { entryShape, catalogueShape } from './catalogue/schema';

const entries = defineCollection({
  loader: glob({ pattern: '*.yaml', base: './src/content/entries' }),
  schema: ({ image }) => entryShape(image()),
});

// The catalogue file is one document, not a list of records, so it is read as
// the single entry of a glob (its id is "catalogue") and not through the file
// loader, which makes each top-level key a record of its own.
const catalogue = defineCollection({
  loader: glob({ pattern: 'catalogue.json', base: './src/content' }),
  schema: catalogueShape,
});

export const collections = { entries, catalogue };
