// Where the unit tests are. Without this Vitest would also pick up the
// Playwright specs under tests/e2e and tests/look and fail on them, since
// those need a browser and a built site.
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/unit/**/*.test.ts'],
    // Vitest swaps every stylesheet for an empty string unless told otherwise,
    // and the tokens test needs the text of tokens.css to read.
    css: { include: [/tokens\.css/] },
  },
});
