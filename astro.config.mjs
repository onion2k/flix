// How the site is built. It names the address every absolute link is made
// from, hosts the fonts itself so that the page asks nothing of any other
// origin, and writes the content-security policy from what the build emits.
// Without it the build would fetch fonts from Google at view time, and the
// page would have no policy.
// @ts-check
import { readFileSync } from 'node:fs';
import { defineConfig, fontProviders } from 'astro/config';
import {
  hasFeatures,
  inlineScriptText,
  scriptHash,
  touchFirstScriptText,
  touchFirstCallText,
} from './src/build/inline-script.ts';

// With a list of features the page carries an inline script that picks the
// day's feature before the page is drawn, and every row carries one that puts a
// touch screen's playable cards first. Astro hashes the scripts it bundles and
// not these, which are written by hand, so their hashes are given here, worked
// out from the files the page reads. With no list there is no feature script
// and so no hash for it.
const catalogue = JSON.parse(
  readFileSync(
    new URL('./src/content/catalogue.json', import.meta.url),
    'utf8',
  ),
);
// Every page has rows: the first carries the touch-first function and each row
// the one-line call to it, the same text in all of them, so both hashes are
// always given.
const scriptHashes = [
  ...(hasFeatures(catalogue) ? [scriptHash(inlineScriptText())] : []),
  scriptHash(touchFirstScriptText()),
  scriptHash(touchFirstCallText()),
];

export default defineConfig({
  site: 'https://flix.ooer.com',
  // Every address ends in a slash, so the one served, the canonical link and
  // the sitemap's all agree and no page has two addresses.
  trailingSlash: 'always',
  security: {
    /**
     * Astro hashes every inline script and style it emits and writes them into
     * a <meta http-equiv="content-security-policy">, so the policy needs no
     * 'unsafe-inline'. The rest of the directives are set here.
     *
     * frame-ancestors is deliberately absent: a policy in a meta tag ignores
     * it, and a directive that silently does nothing is worse than none. The
     * whole policy, it included, is also sent as a header, from dist/_headers,
     * which src/build/write-headers.mjs writes after the build.
     */
    csp: {
      scriptDirective: { hashes: scriptHashes },
      directives: [
        "default-src 'self'",
        // Nothing is embedded, plugged in or submitted by a form.
        "object-src 'none'",
        "base-uri 'none'",
        "form-action 'none'",
        "frame-src 'none'",
        // Every asset is same-origin: the fonts are downloaded at build time
        // and the pictures are files of this site.
        "img-src 'self'",
        "font-src 'self'",
        "connect-src 'self'",
        // Nothing here builds markup from a string, so no sink may take one,
        // and no policy for one is allowed to be made.
        "require-trusted-types-for 'script'",
        "trusted-types 'none'",
        'upgrade-insecure-requests',
      ],
    },
  },
  build: {
    // The styles are small, and a stylesheet in its own file is a request that
    // blocks the first paint. Inlined, each is hashed into the policy.
    inlineStylesheets: 'always',
  },
  // Astro downloads and self-hosts these at build time: no request to Google
  // when the page is viewed. Each has optimizedFallbacks off: with it on, the
  // build stops with "Unknown font format" while Astro reads the downloaded
  // file's metrics (seen with Astro 7.4.13 on Node 23.4.0, for both families),
  // as ooer.com's build also has it off. The cost is a fallback face not
  // sized to match, so text may shift a little when the real face arrives.
  fonts: [
    {
      // Titles and the wordmark. A condensed face, set in capitals, at the
      // display end of its optical-size axis (see options below).
      provider: fontProviders.google(),
      name: 'Big Shoulders',
      cssVariable: '--face-display',
      weights: [800],
      styles: ['normal'],
      subsets: ['latin'],
      // Google serves Big Shoulders as one variable family with an optical-size
      // axis, and without this the build takes the instance for small text,
      // which is wider: the feature title wrapped to two lines. Asking the
      // provider for opsz 72 gets the display cut, still one self-hosted file.
      options: { experimental: { variableAxis: { opsz: [72] } } },
      fallbacks: ['Impact', 'sans-serif'],
      optimizedFallbacks: false,
    },
    {
      // Everything that is read: a face made to be told apart letter by letter.
      provider: fontProviders.google(),
      name: 'Atkinson Hyperlegible',
      cssVariable: '--face-body',
      weights: [400, 700],
      styles: ['normal'],
      subsets: ['latin'],
      fallbacks: ['system-ui', 'sans-serif'],
      optimizedFallbacks: false,
    },
  ],
});
