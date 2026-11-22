// Holds the moving hero's rule, which is the catalogue's and not the page's:
// what the hero does when the page has loaded (play its loop, offer it, or
// leave the still) from the three things that decide it (the entry has a hero
// loop, the reader asked for less motion, the reader asked to spare data), and
// the words of the Pause button, which say the one thing it will do next and
// name the video. Each case is a row of a table that is counted, so that an
// empty table cannot pass. Without this a reader who asked for stillness could
// be given a loop, or a button could say Pause of a video that is not playing.
import { describe, expect, it } from 'vitest';
import { heroStart, pauseWords } from '../../src/catalogue/hero';

describe('heroStart', () => {
  const table = [
    // hasLoop, reducedMotion, saveData, answer
    [true, false, false, 'play'],
    [true, true, false, 'offer'],
    [true, false, true, 'still'],
    [true, true, true, 'still'],
    [false, false, false, 'still'],
    [false, true, false, 'still'],
    [false, false, true, 'still'],
    [false, true, true, 'still'],
  ] as const;

  it('covers every combination of the three, once', () => {
    expect(table).toHaveLength(8);
    expect(new Set(table.map((row) => row.slice(0, 3).join())).size).toBe(8);
  });

  for (const [hasLoop, reducedMotion, saveData, answer] of table) {
    it(`with a loop ${hasLoop}, reduced motion ${reducedMotion} and Save-Data ${saveData}: ${answer}`, () => {
      expect(heroStart({ hasLoop, reducedMotion, saveData })).toBe(answer);
    });
  }
});

describe('pauseWords', () => {
  it('says Pause while the loop plays, and Play while it is held, naming the video', () => {
    expect(pauseWords('Aquaclysm', true)).toEqual({
      words: 'Pause',
      name: 'Pause the Aquaclysm video',
    });
    expect(pauseWords('Aquaclysm', false)).toEqual({
      words: 'Play',
      name: 'Play the Aquaclysm video',
    });
  });

  it('has the visible words at the start of the name (WCAG 2.5.3)', () => {
    for (const playing of [true, false]) {
      const { words, name } = pauseWords('Ooergolf', playing);
      expect(name.startsWith(words)).toBe(true);
    }
  });
});
