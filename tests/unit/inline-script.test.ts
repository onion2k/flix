// Holds what the build does with the inline script (src/scripts/today-inline.js):
// the hash it writes into the content policy is the SHA-256 of that file's
// text, in the form a policy takes it, and the same file is what the config and
// the page both read, so that the two cannot drift. It also holds that a hash
// is made only where a list of features is set, so that a catalogue with none
// has the policy it had before. Without this, an edit to the script would leave
// the policy hashing the old one, and the browser would refuse the new.
import { describe, expect, it } from 'vitest';
import config from '../../astro.config.mjs';
import catalogueJson from '../../src/content/catalogue.json';
import {
  hasFeatures,
  inlineScriptText,
  scriptHash,
} from '../../src/build/inline-script';

const files = import.meta.glob<string>('../../src/scripts/today-inline.js', {
  query: '?raw',
  import: 'default',
  eager: true,
});

describe('scriptHash', () => {
  it('is sha256- and the base64 of the digest, as a policy writes it', () => {
    // The digest of "abc" is a published test vector.
    expect(scriptHash('abc')).toBe(
      'sha256-ungWv48Bz+pBQUDeXa4iI7ADYaOWF3qctBD/YfIAFa0=',
    );
  });

  it('changes with one character', () => {
    expect(scriptHash('a')).not.toBe(scriptHash('b'));
  });
});

describe('inlineScriptText', () => {
  it('is the text of the file the page and the test read, whole', () => {
    const [raw] = Object.values(files);
    expect(raw?.length).toBeGreaterThan(100);
    expect(inlineScriptText()).toBe(raw);
  });
});

describe('hasFeatures', () => {
  it('is true for a list with something in it only', () => {
    expect(hasFeatures({ features: ['a'] })).toBe(true);
    expect(hasFeatures({ features: [] })).toBe(false);
    expect(hasFeatures({})).toBe(false);
  });
});

describe('the config', () => {
  it('allows the inline script by the hash of its file where features are set, and by none where they are not', () => {
    const hashes = config.security?.csp;
    const directive =
      typeof hashes === 'object' ? hashes.scriptDirective?.hashes : undefined;
    expect(directive).toEqual(
      hasFeatures(catalogueJson) ? [scriptHash(inlineScriptText())] : undefined,
    );
  });
});
