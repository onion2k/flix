// What the build does with the inline script that picks the day's feature
// (src/scripts/today-inline.js). The page writes that file's text into the
// document, and astro.config.mjs allows it in the content policy by the hash of
// the same text, read from the same file here, so that the two cannot drift: an
// edit to the script moves both, and a hash of an old copy is not possible.
// Without this the policy would be loosened to 'unsafe-inline' to let the
// script run, or the page would carry a script the browser refuses.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

/** The text of the inline script, exactly as the page writes it. */
export function inlineScriptText(): string {
  return readFileSync(
    new URL('../scripts/today-inline.js', import.meta.url),
    'utf8',
  );
}

/** A policy's name for a script's text: sha256-, then the digest in base64. */
export function scriptHash(text: string): `sha256-${string}` {
  return `sha256-${createHash('sha256').update(text, 'utf8').digest('base64')}`;
}

/**
 * Whether a catalogue file sets a list of features. Only then is there an
 * inline script on the page, and so only then a hash in the policy.
 */
export function hasFeatures(catalogue: { features?: string[] }): boolean {
  return (catalogue.features ?? []).length > 0;
}
