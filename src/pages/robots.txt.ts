// robots.txt: every robot may read everything, and the sitemap is named. Made
// from the `site` address in astro.config.mjs, so that the address is said
// once and a change of domain moves it. Without it a crawler would guess.
import type { APIRoute } from 'astro';

export const GET: APIRoute = ({ site }) => {
  const sitemap = new URL('sitemap.xml', site).href;
  return new Response(`User-agent: *\nAllow: /\n\nSitemap: ${sitemap}\n`, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
