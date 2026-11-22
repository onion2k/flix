// Writes dist/_headers, the file Netlify reads to send the site's content policy
// as a response header, from the pages the build has just made. It runs as
// `postbuild`, so `npm run build` always ends with it, and it takes the folder
// to read as its one argument (default `dist`) so that a test can run it on
// pages made for the purpose.
//
// It lives beside the other build-time code, in src/build/, and is plain Node
// since it runs straight after Astro with nothing else loaded.
//
// Why a header at all: the policy Astro writes is a <meta> tag, and a browser
// reads a meta policy only from the point the parser reaches it. The styles
// written above it (the fonts) are not governed, `frame-ancestors` is ignored
// in one, and the policy is not in force until the head has been read. A header
// governs the whole response from its first byte.
//
// Why it hashes the pages itself: a header is written before any page is
// served, so it has to hold the hash of every inline script and style of every
// page, and the only list of them that is trusted is the one worked out here
// from the text that was built. Astro's own list is read, as the page's policy,
// and anything the page carries that it does not name is added. One policy
// serves every path, since a header per page would be a rule per page and one
// forgotten page would be a page with no policy: it is the union of the pages',
// directive by directive, so a page is never refused what its own policy
// allowed. The meta tag stays, both policies are enforced, and neither loosens
// the other.
//
// Why it refuses what it cannot make safe: no hash covers an inline event
// handler or a `style` attribute, and a policy that allowed 'unsafe-inline' or
// 'unsafe-eval' in a script or style source would be a policy in name only. The
// build stops, naming the page, and writes nothing, and so does a folder with
// no page in it, since a header written from nothing would be the policy of a
// site that was not there. The policy is named here and in no other file:
// netlify.toml says so, since two sources for one header are joined by Netlify
// into two policies and not one.
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const folder = resolve(process.argv[2] ?? 'dist');

/** The sources of these directives may never hold either word below. */
const GUARDED = [
  'script-src',
  'script-src-elem',
  'script-src-attr',
  'style-src',
  'style-src-elem',
  'style-src-attr',
];
const FORBIDDEN = ["'unsafe-inline'", "'unsafe-eval'"];

/** Stops the build with a message, and writes nothing. */
function stop(lines) {
  for (const line of lines) console.error(`write-headers: ${line}`);
  process.exit(1);
}

if (!existsSync(folder)) stop([`there is no folder ${folder}; run the build`]);

/** Every .html file under a folder, in a fixed order. */
function pagesUnder(directory) {
  return readdirSync(directory, { withFileTypes: true })
    .sort((a, b) => a.name.localeCompare(b.name))
    .flatMap((entry) => {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) return pagesUnder(path);
      return entry.name.endsWith('.html') ? [path] : [];
    });
}

/** The name a source gives an inline text: sha256-, then the digest in base64. */
function hashOf(text) {
  return `'sha256-${createHash('sha256').update(text, 'utf8').digest('base64')}'`;
}

/** The text of an attribute value as a browser reads it, for the few escapes. */
function unescapeAttribute(value) {
  return value
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&#x27;', "'")
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&amp;', '&');
}

// A script or style element, its attributes and the exact text between its tags
// (which is what a browser hashes), and a comment, which holds no markup.
const ELEMENT =
  /<(script|style)\b((?:"[^"]*"|'[^']*'|[^>"'])*)>([\s\S]*?)<\/\1\s*>/gi;
const COMMENT = /<!--[\s\S]*?-->/g;
// A start tag, and one attribute of it.
const TAG = /<([a-zA-Z][^\s/>]*)((?:"[^"]*"|'[^']*'|[^>"'])*)>/g;
const ATTRIBUTE =
  /([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;

/** The attributes of a tag's text, as [lower-cased name, value] pairs. */
function attributesOf(text) {
  return [...text.matchAll(ATTRIBUTE)].map((match) => [
    (match[1] ?? '').toLowerCase(),
    match[2] ?? match[3] ?? match[4] ?? '',
  ]);
}

/**
 * What a page holds that a policy is about: the policies in its meta tags, the
 * hash of each inline script and style, and the attributes that no hash covers.
 * Text inside a script, a style or a comment is not markup and is left out of
 * the search for attributes, so that a string in a script is not read as one.
 */
function readPage(html) {
  const policies = [];
  const scripts = [];
  const styles = [];
  for (const match of html.matchAll(ELEMENT)) {
    if (attributesOf(match[2] ?? '').some(([name]) => name === 'src')) continue;
    (match[1]?.toLowerCase() === 'script' ? scripts : styles).push(
      hashOf(match[3] ?? ''),
    );
  }
  const markup = html
    .replace(COMMENT, '')
    .replace(ELEMENT, (_all, name, attrs) => `<${name}${attrs}></${name}>`);
  const handlers = [];
  for (const tag of markup.matchAll(TAG)) {
    const attributes = attributesOf(tag[2] ?? '');
    const http = attributes.find(([name]) => name === 'http-equiv');
    if (
      tag[1]?.toLowerCase() === 'meta' &&
      http?.[1].toLowerCase() === 'content-security-policy'
    ) {
      const content = attributes.find(([name]) => name === 'content');
      policies.push(unescapeAttribute(content?.[1] ?? ''));
    }
    for (const [name] of attributes) {
      if (name === 'style' || /^on[a-z]/.test(name))
        handlers.push(`<${tag[1]}> has a ${name} attribute`);
    }
  }
  return { policies, scripts, styles, handlers };
}

/** `a 'b'; c` as a Map of directive to its list of sources, in order. */
function parsePolicy(policy) {
  const found = new Map();
  for (const part of policy.split(';')) {
    const [name, ...sources] = part.trim().split(/\s+/);
    if (name === undefined || name === '') continue;
    const key = name.toLowerCase();
    // A directive said twice counts the first time only, as a browser reads it.
    if (!found.has(key)) found.set(key, sources);
  }
  return found;
}

const files = pagesUnder(folder);
if (files.length === 0)
  stop([`no page was found under ${folder}, so there is no policy to write`]);

const problems = [];
const union = new Map();

/** Adds sources to a directive of the union, a source once, in first-seen order. */
function add(name, sources) {
  const held = union.get(name) ?? [];
  for (const source of sources) if (!held.includes(source)) held.push(source);
  union.set(name, held);
}

for (const file of files) {
  const name = relative(folder, file).split('\\').join('/');
  const page = readPage(readFileSync(file, 'utf8'));
  if (page.policies.length === 0) {
    problems.push(`${name}: it has no content-security-policy meta tag`);
    continue;
  }
  for (const detail of page.handlers)
    problems.push(
      `${name}: ${detail}, which no hash covers; move it into a script or a stylesheet`,
    );
  for (const policy of page.policies) {
    const directives = parsePolicy(policy);
    for (const [directive, hashes] of [
      ['script-src', page.scripts],
      ['style-src', page.styles],
    ]) {
      if (hashes.length === 0) continue;
      if (!directives.has(directive)) {
        problems.push(
          `${name}: it has inline code and no ${directive} to hold its hash`,
        );
        continue;
      }
      directives.set(directive, [
        ...(directives.get(directive) ?? []),
        ...hashes,
      ]);
    }
    for (const directive of GUARDED) {
      for (const source of directives.get(directive) ?? []) {
        if (FORBIDDEN.includes(source.toLowerCase()))
          problems.push(`${name}: ${directive} holds ${source}`);
      }
    }
    for (const [directive, sources] of directives) add(directive, sources);
  }
}

if (problems.length > 0) stop(problems);

// The directive a meta tag cannot carry, and the reason for a header: nobody
// may frame the site. It replaces anything a page said, so that it is one.
union.set('frame-ancestors', ["'none'"]);

const policy = [...union]
  .map(([name, sources]) => [name, ...sources].join(' '))
  .join('; ');

// One line, since the file has no way to continue one: a value split over two
// lines would be read as a header and a stray line.
writeFileSync(
  join(folder, '_headers'),
  [
    '# Written by src/build/write-headers.mjs on every build. Do not edit it:',
    '# it holds the hash of every inline script and style of every page, which',
    '# only the build knows. It is the one place the content policy is sent from.',
    '/*',
    `  Content-Security-Policy: ${policy}`,
    '',
  ].join('\n'),
);

const sources = [...union.values()].reduce((sum, each) => sum + each.length, 0);
console.log(
  `write-headers: ${files.length} pages read, _headers holds ${union.size} directives and ${sources} sources`,
);
