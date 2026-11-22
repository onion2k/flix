// How a card's loop gets its address. An entry writes the path of its loop
// relative to its own file (`../loops/chopdrop.webm`); the build gives every
// file under src/content/loops a hashed address of its own (under /_astro/, as
// it does a picture), and this finds the one for the path and refuses, naming
// the entry's file and the path, one that is not a .webm file or is not there.
// The files are handed in, so that the rule is tried in a unit test with made-up
// ones; src/build/loops.ts hands in the real ones. Without this a loop that was
// misspelt would build into a card asking for a file that is not there, and a
// hand-written address would never carry the hash that lets a file be cached
// for good.
import { posix } from 'node:path';

/** Where the loops are kept, as the build's glob names them (from the project's root). */
export const LOOPS_FOLDER = '/src/content/loops/';

/** The folder the entries' files are in, which their loop paths are relative to. */
const ENTRIES_FOLDER = '/src/content/entries/';

/** The built address of an entry's loop, or a thrown refusal naming where it is wrong. */
export function loopAddress(
  id: string,
  loop: string,
  files: Record<string, string>,
  field: 'loop' | 'heroLoop' = 'loop',
): string {
  const where = `src/content/entries/${id}.yaml: the ${field} "${loop}"`;
  if (!loop.endsWith('.webm')) throw new Error(`${where} is not a .webm file.`);
  const found = files[posix.join(ENTRIES_FOLDER, loop)];
  if (found === undefined)
    throw new Error(
      `${where} names no such file: loops are files in ${LOOPS_FOLDER.slice(1)}.`,
    );
  return found;
}

/** The address of each entry's loop, for the entries that have one. */
export function loopAddresses(
  entries: {
    id: string;
    loop?: string | undefined;
    heroLoop?: string | undefined;
  }[],
  files: Record<string, string>,
): Map<string, string> {
  const found = new Map<string, string>();
  for (const entry of entries)
    if (entry.loop !== undefined)
      found.set(entry.id, loopAddress(entry.id, entry.loop, files));
  return found;
}

/**
 * The address of each entry's hero loop, for the entries that have one, which
 * the moving hero plays. It is held to the same rule as a card's loop and a
 * refusal names the field, so that the person reading the build's output knows
 * which of the two to mend.
 */
export function heroLoopAddresses(
  entries: {
    id: string;
    loop?: string | undefined;
    heroLoop?: string | undefined;
  }[],
  files: Record<string, string>,
): Map<string, string> {
  const found = new Map<string, string>();
  for (const entry of entries)
    if (entry.heroLoop !== undefined)
      found.set(
        entry.id,
        loopAddress(entry.id, entry.heroLoop, files, 'heroLoop'),
      );
  return found;
}
