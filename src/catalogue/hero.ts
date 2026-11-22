// What the moving hero does, said as rules: when the page has loaded, whether
// the day's feature plays its loop by itself, offers it to a reader who asks,
// or leaves its still; and the words of the Pause button. They are here and not
// in the page's script so that each can be tried with every combination of
// what decides it. Without this the script would hold the rule, and a reader
// who asked for stillness or to spare data could be given a loop by a change
// to the page that no test of the rule would see.

/** What the hero does at load: play the loop, offer it on a button, or nothing. */
export type HeroStart = 'play' | 'offer' | 'still';

/**
 * Decides what the hero does. A feature with no loop, or a reader who asked
 * to spare data, has the still alone and no button. A reader who asked for
 * less motion has the still too, and a button that plays the loop if they ask.
 */
export function heroStart(facts: {
  hasLoop: boolean;
  reducedMotion: boolean;
  saveData: boolean;
}): HeroStart {
  if (!facts.hasLoop || facts.saveData) return 'still';
  return facts.reducedMotion ? 'offer' : 'play';
}

/**
 * The button's words, for a loop that plays (`playing`) or is held. They say
 * what pressing will do, and the accessible name begins with them (WCAG 2.5.3,
 * label in name) and names the video, since a page may be read by its
 * controls alone.
 */
export function pauseWords(
  title: string,
  playing: boolean,
): { words: 'Pause' | 'Play'; name: string } {
  const words = playing ? 'Pause' : 'Play';
  return { words, name: `${words} the ${title} video` };
}
