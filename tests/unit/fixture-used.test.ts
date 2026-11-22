// Holds that every Playwright spec takes its `test` from tests/clock.ts and
// none from @playwright/test directly. With a list of features set, the page
// is a different one each day, so a spec that did not hold the clock would
// pass today and fail tomorrow, and nothing would say why. The specs are read
// as text with import.meta.glob, so that this needs no file-system module, and
// the files are counted so that reading none is a failure and not a pass.
import { describe, expect, it } from 'vitest';

const specs = import.meta.glob<string>('../**/*.spec.ts', {
  query: '?raw',
  import: 'default',
  eager: true,
});

/** Every import from @playwright/test that brings in `test` by name. */
const DIRECT =
  /import\s*(?:type\s*)?\{[^}]*\btest\b[^}]*\}\s*from\s*['"]@playwright\/test['"]/;

/** The files, by name, whose source takes `test` from Playwright itself. */
function takingTestDirectly(sources: Record<string, string>): string[] {
  return Object.entries(sources)
    .filter(([, source]) => DIRECT.test(source))
    .map(([name]) => name)
    .sort();
}

describe('the specs and the held clock', () => {
  it('reads the specs, so that an empty reading is not a pass', () => {
    expect(Object.keys(specs).length).toBeGreaterThanOrEqual(19);
  });

  it('has no spec that takes test from @playwright/test', () => {
    expect(takingTestDirectly(specs)).toEqual([]);
  });

  it('is seen to find one that does (the check itself)', () => {
    const bad = `import { expect, test, type Page } from '@playwright/test';`;
    const multi = `import {\n  expect,\n  test,\n} from "@playwright/test";`;
    const good = `import { expect } from '@playwright/test';\nimport { test } from '../clock';`;
    expect(takingTestDirectly({ bad, multi, good })).toEqual(['bad', 'multi']);
  });
});
