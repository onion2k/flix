// Holds how a card's loop gets its address: the path an entry writes, relative
// to its own file, is found among the loop files the build knows (each with the
// hashed address the build made for it) and answered with that address, and a
// path that names no such file, or a file that is not .webm, is refused with a
// message that names the entry's file and the path, so that the person reading
// the build's output knows where to look. The files are handed in as made-up
// data, so no build is needed. Without it a loop that was misspelt would build
// into a card whose video asked for a file that is not there, and nothing would
// stop it before a visitor hovered.
import { describe, expect, it } from 'vitest';
import {
  LOOPS_FOLDER,
  loopAddress,
  loopAddresses,
} from '../../src/build/loop-address';

const files = {
  '/src/content/loops/alpha.webm': '/_astro/alpha.abc123.webm',
  '/src/content/loops/beta.webm': '/_astro/beta.def456.webm',
};

describe('loopAddress', () => {
  it('answers a path relative to the entry file with the built address', () => {
    expect(loopAddress('alpha', '../loops/alpha.webm', files)).toBe(
      '/_astro/alpha.abc123.webm',
    );
    expect(loopAddress('beta', '../loops/beta.webm', files)).toBe(
      '/_astro/beta.def456.webm',
    );
  });

  it('never answers the path that was written', () => {
    const found = loopAddress('alpha', '../loops/alpha.webm', files);
    expect(found).not.toContain('..');
    expect(found).not.toContain('src/content');
  });

  it('refuses a file that is not there, naming the entry file and the path', () => {
    expect(() => loopAddress('gamma', '../loops/gamma.webm', files)).toThrow(
      /src\/content\/entries\/gamma\.yaml.*\.\.\/loops\/gamma\.webm.*no such file/,
    );
  });

  it('refuses a path that climbs out of the loops folder to a file that exists elsewhere', () => {
    expect(() =>
      loopAddress('alpha', '../pictures/../loops/../x.webm', files),
    ).toThrow(/alpha\.yaml/);
  });

  it('refuses a file that is not .webm, even if the build knows it', () => {
    expect(() =>
      loopAddress('alpha', '../loops/alpha.mp4', {
        ...files,
        '/src/content/loops/alpha.mp4': '/_astro/alpha.mp4',
      }),
    ).toThrow(/alpha\.yaml.*\.webm/);
  });

  it('says where the loops are kept', () => {
    expect(LOOPS_FOLDER).toBe('/src/content/loops/');
  });
});

describe('loopAddresses', () => {
  it('answers each entry that has a loop, and none that has not', () => {
    const found = loopAddresses(
      [
        { id: 'alpha', loop: '../loops/alpha.webm' },
        { id: 'beta' },
        { id: 'gamma', loop: undefined },
      ],
      files,
    );
    expect([...found]).toEqual([['alpha', '/_astro/alpha.abc123.webm']]);
  });

  it('refuses at the first entry whose loop is not there', () => {
    expect(() =>
      loopAddresses(
        [
          { id: 'alpha', loop: '../loops/alpha.webm' },
          { id: 'zed', loop: '../loops/zed.webm' },
        ],
        files,
      ),
    ).toThrow(/zed\.yaml/);
  });
});
