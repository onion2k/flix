// Holds the build step that writes dist/_headers (src/build/write-headers.mjs):
// run on small pages made here, it writes one Content-Security-Policy for every
// path that is the union of the pages' own, adds the hash of each inline script
// and style the page's meta policy lacks, puts frame-ancestors in, and stops the
// build, naming the page, for a page with no policy, a policy that lets inline
// code in, an inline handler or style attribute (which no hash covers), or no
// page at all. The script is run as a process, as `postbuild` runs it, so what
// is read is its exit and its words and not a function this test imported.
// Without this a change to the step would be seen only as a broken site, since
// the one policy it writes is sent for every page. The hashes are worked out in
// this file, from the pages it wrote, and never by the code under test.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';

const STEP = join(import.meta.dirname, '../../src/build/write-headers.mjs');

const hashOf = (text: string): string =>
  `'sha256-${createHash('sha256').update(text, 'utf8').digest('base64')}'`;

const META =
  "default-src 'self';object-src 'none';base-uri 'none';script-src 'self';style-src 'self'";

/** A page as the build writes one: a policy in a meta tag, and a body. */
function page(policy: string | null, body = '', head = ''): string {
  const meta =
    policy === null
      ? ''
      : `<meta http-equiv="content-security-policy" content="${policy}">`;
  return `<!doctype html><html><head>${head}${meta}</head><body>${body}</body></html>`;
}

/** A dist folder holding these pages, by path, and nothing else. */
function dist(pages: Record<string, string>): string {
  const folder = mkdtempSync(join(tmpdir(), 'ooerflix-headers-'));
  for (const [name, html] of Object.entries(pages)) {
    mkdirSync(dirname(join(folder, name)), { recursive: true });
    writeFileSync(join(folder, name), html);
  }
  return folder;
}

interface Run {
  code: number;
  said: string;
  headers: string | null;
}

/** Runs the step on a folder, and reports how it ended and what it wrote. */
function run(folder: string): Run {
  let code = 0;
  let said = '';
  try {
    said = execFileSync(process.execPath, [STEP, folder], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (error) {
    const failure = error as { status: number; stderr: string };
    code = failure.status;
    said = failure.stderr;
  }
  let headers: string | null = null;
  try {
    headers = readFileSync(join(folder, '_headers'), 'utf8');
  } catch {
    headers = null;
  }
  return { code, said, headers };
}

/** The one policy in a written file, by directive, as sets. */
function policyOf(headers: string): Map<string, string[]> {
  const lines = headers.split('\n').filter((line) => !line.startsWith('#'));
  expect(lines.filter((line) => line === '/*')).toHaveLength(1);
  const value = lines.filter((line) =>
    /^\s+Content-Security-Policy:/.test(line),
  );
  expect(value).toHaveLength(1);
  const text = (value[0] ?? '').replace(/^\s+Content-Security-Policy:\s*/, '');
  const found = new Map<string, string[]>();
  for (const part of text.split(';')) {
    const [name, ...sources] = part.trim().split(/\s+/);
    if (name !== undefined && name !== '') found.set(name, sources);
  }
  return found;
}

describe('the step that writes dist/_headers', () => {
  it('writes one rule for every path, with the whole policy and frame-ancestors', () => {
    const result = run(dist({ 'index.html': page(META) }));
    expect(result.code).toBe(0);
    const policy = policyOf(result.headers ?? '');
    expect(policy.get('frame-ancestors')).toEqual(["'none'"]);
    expect(policy.get('object-src')).toEqual(["'none'"]);
    expect(policy.get('base-uri')).toEqual(["'none'"]);
    expect(policy.get('default-src')).toEqual(["'self'"]);
  });

  it('adds the hash of an inline script and of an inline style the meta policy lacks', () => {
    const script = 'document.title = "x";';
    const style = 'body{margin:0}';
    const result = run(
      dist({
        'index.html': page(
          META,
          `<script>${script}</script>`,
          `<style>${style}</style>`,
        ),
      }),
    );
    const policy = policyOf(result.headers ?? '');
    expect(policy.get('script-src')).toContain(hashOf(script));
    expect(policy.get('style-src')).toContain(hashOf(style));
  });

  it('hashes the exact text between the tags, spaces and newlines included', () => {
    const style = '\n  a { color: red }\n';
    const result = run(
      dist({ 'index.html': page(META, '', `<style>${style}</style>`) }),
    );
    expect(policyOf(result.headers ?? '').get('style-src')).toContain(
      hashOf(style),
    );
  });

  it('does not hash a script that has an address, which the policy allows by origin', () => {
    const result = run(
      dist({
        'index.html': page(META, '<script type="module" src="/a.js"></script>'),
      }),
    );
    expect(result.code).toBe(0);
    expect(policyOf(result.headers ?? '').get('script-src')).toEqual([
      "'self'",
    ]);
  });

  it('makes the union of the pages, a source once, whichever page held it', () => {
    const one = hashOf('one();');
    const two = hashOf('two();');
    const result = run(
      dist({
        'index.html': page(META, '<script>one();</script>'),
        'privacy/index.html': page(
          META,
          '<script>one();</script><script>two();</script>',
        ),
        '404.html': page(`${META};img-src 'self'`),
      }),
    );
    const policy = policyOf(result.headers ?? '');
    const scripts = policy.get('script-src') ?? [];
    expect(scripts.filter((source) => source === one)).toHaveLength(1);
    expect(scripts).toContain(two);
    expect(policy.get('img-src')).toEqual(["'self'"]);
  });

  it('stops, naming the page, for a page with no meta policy', () => {
    const result = run(
      dist({ 'index.html': page(META), 'privacy/index.html': page(null) }),
    );
    expect(result.code).not.toBe(0);
    expect(result.said).toContain('privacy/index.html');
    expect(result.said).toMatch(/no content-security-policy/i);
  });

  for (const source of ["'unsafe-inline'", "'unsafe-eval'"]) {
    for (const directive of ['script-src', 'style-src']) {
      it(`stops, naming the page, for ${source} in ${directive}`, () => {
        const result = run(
          dist({
            'index.html': page(META),
            'privacy/index.html': page(
              META.replace(
                `${directive} 'self'`,
                `${directive} 'self' ${source}`,
              ),
            ),
          }),
        );
        expect(result.code).not.toBe(0);
        expect(result.said).toContain('privacy/index.html');
        expect(result.said).toContain(source);
      });
    }
  }

  for (const [name, tag] of [
    ['an inline event handler', '<button onclick="go()">x</button>'],
    ['an inline event handler in another case', '<img src="a" onError=x>'],
    ['a style attribute', '<p style="color:red">x</p>'],
    ['a style attribute in single quotes', "<p STYLE='color:red'>x</p>"],
  ] as const) {
    it(`stops, naming the page, for ${name}`, () => {
      const result = run(
        dist({
          'index.html': page(META),
          'privacy/index.html': page(META, tag),
        }),
      );
      expect(result.code).not.toBe(0);
      expect(result.said).toContain('privacy/index.html');
    });
  }

  it('does not mistake words in a script, a style or text for attributes', () => {
    const result = run(
      dist({
        'index.html': page(
          META,
          '<p>an onclick= and a style= in text</p><script>el.setAttribute("style", "a"); x = "<b onclick=1>";</script>',
        ),
      }),
    );
    expect(result.code).toBe(0);
  });

  it('stops for a folder with no page, since writing a policy from none is a pass in silence', () => {
    const result = run(dist({ 'robots.txt': 'User-agent: *' }));
    expect(result.code).not.toBe(0);
    expect(result.said).toMatch(/no page/i);
    expect(result.headers).toBeNull();
  });

  it('stops for a folder that is not there', () => {
    const result = run(join(tmpdir(), 'ooerflix-no-such-folder'));
    expect(result.code).not.toBe(0);
  });

  it('writes nothing when it stops', () => {
    const result = run(dist({ 'index.html': page(null) }));
    expect(result.code).not.toBe(0);
    expect(result.headers).toBeNull();
  });
});
