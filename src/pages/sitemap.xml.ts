// sitemap.xml: the home page and the privacy page, the only pages there are to
// find (the 404 is not one). Made from the `site` address in astro.config.mjs. Without
// it a search engine would have to find the page by following a link.
import type { APIRoute } from 'astro';

export const GET: APIRoute = ({ site }) => {
  const home = new URL('/', site).href;
  const privacy = new URL('/privacy/', site).href;
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>${home}</loc></url>\n  <url><loc>${privacy}</loc></url>\n</urlset>\n`,
    { headers: { 'Content-Type': 'application/xml; charset=utf-8' } },
  );
};
