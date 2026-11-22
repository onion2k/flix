// How the site is built. It names the address every absolute link is made
// from, hosts the fonts itself so that the page asks nothing of any other
// origin, and writes the content-security policy from what the build emits.
// Without it the build would fetch fonts from Google at view time, and the
// page would have no policy.
// @ts-check
import { defineConfig, fontProviders } from 'astro/config';

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
     * it, and a directive that silently does nothing is worse than none. It is
     * a real header in netlify.toml.
     */
    csp: {
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
      // Titles and the wordmark. A condensed face, set in capitals.
      provider: fontProviders.google(),
      name: 'Big Shoulders',
      cssVariable: '--face-display',
      weights: [800],
      styles: ['normal'],
      subsets: ['latin'],
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
