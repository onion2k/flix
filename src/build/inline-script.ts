// What the build does with the inline scripts: the one that picks the day's
// feature (src/scripts/today-inline.js) and the one that puts a touch screen's
// playable cards first in each row (src/scripts/touch-first-inline.js, called
// by src/scripts/touch-first-call.js after each row's strip). The
// page writes each file's text into the
// document, and astro.config.mjs allows it in the content policy by the hash of
// the same text, read from the same file here, so that the two cannot drift: an
// edit to the script moves both, and a hash of an old copy is not possible.
// Without this the policy would be loosened to 'unsafe-inline' to let the
// script run, or the page would carry a script the browser refuses.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

/** The text of an inline script file, exactly as the page writes it. */
function textOf(name: string): string {
  return readFileSync(new URL(`../scripts/${name}`, import.meta.url), 'utf8');
}

/** The text of the inline script that picks the day's feature. */
export function inlineScriptText(): string {
  return textOf('today-inline.js');
}

/**
 * A script's text with its leading comment lines taken off: what a reader of
 * the file needs and the page does not. Written whole, the touch-first
 * script's comment alone was about 550 of the page's compressed bytes, and the
 * page was 49 bytes over its budget.
 */
export function withoutLeadingComment(text: string): string {
  return text.replace(/^(?:[ \t]*\/\/[^\n]*\n)+/, '');
}

/**
 * The text of the inline script that defines the touch-first move, once a
 * page, as the page writes it: its code, without the comment at its head.
 */
export function touchFirstScriptText(): string {
  return withoutLeadingComment(textOf('touch-first-inline.js'));
}

/** The text of the one-line inline script after each row's strip that calls it. */
export function touchFirstCallText(): string {
  return textOf('touch-first-call.js');
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
