// The loop files the build knows, each with the address the build gives it: a
// hashed file under /_astro/, as a picture has, never a path written by hand.
// Vite finds them with the glob below (`?url` asks for the address and not the
// file's bytes, so nothing is inlined) and src/build/loop-address.ts turns an
// entry's path into one of them. Without it a card would have no way to name
// its loop that the build could check.
import { heroLoopAddresses, loopAddress, loopAddresses } from './loop-address';

const files = import.meta.glob<string>('/src/content/loops/*.webm', {
  query: '?url',
  import: 'default',
  eager: true,
});

/** The built address of an entry's loop, refusing a path that finds no file. */
export function loopFor(id: string, loop: string): string {
  return loopAddress(id, loop, files);
}

/** The built address of an entry's hero loop, refusing a path that finds no file. */
export function heroLoopFor(id: string, heroLoop: string): string {
  return loopAddress(id, heroLoop, files, 'heroLoop');
}

/**
 * Every listed or unlisted entry's loop, checked, so that a bad one stops the
 * build even where its card is not drawn.
 */
export function checkLoops(
  entries: {
    id: string;
    loop?: string | undefined;
    heroLoop?: string | undefined;
  }[],
): Map<string, string> {
  heroLoopAddresses(entries, files);
  return loopAddresses(entries, files);
}
