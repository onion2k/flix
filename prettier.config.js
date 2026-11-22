// What the formatter is told. Without this file the Astro plugin is not loaded
// and every .astro file fails the format check. Only choices that differ from
// Prettier's defaults are written here, each with its reason.
export default {
  plugins: ['prettier-plugin-astro'],
  // The owner's other sites are written with single quotes, and a file copied
  // between them should not change on the way.
  singleQuote: true,
  overrides: [{ files: '*.astro', options: { parser: 'astro' } }],
};
