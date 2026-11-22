// Lint for the TypeScript: mistakes the compiler lets through, found with the
// type information (a promise not awaited, a condition that cannot be false).
// Without it those pass the quick check in silence. .astro files are left to
// `astro check`, which holds their types, so they are not named here.
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';

export default defineConfig(
  // What a build or a test run writes is not this checkout's code.
  {
    ignores: [
      'dist',
      '.astro',
      'node_modules',
      'test-results',
      'playwright-report',
    ],
  },
  {
    files: ['**/*.ts'],
    extends: [tseslint.configs.recommendedTypeChecked],
    languageOptions: { parserOptions: { projectService: true } },
  },
);
