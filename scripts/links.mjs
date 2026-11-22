// Asks every https address a card or the feature links to, read from the built
// dist/index.html, whether it still answers, and fails if one is gone. Each
// address is a game the site sends a visitor to; without this one can vanish
// and the card goes on offering a 404.
//   npm run links [-- --mutate dead]
//
// It needs the network and other people's servers, so it is not part of
// `npm run check`: a gate that a stranger's outage can turn red teaches
// people to ignore it. Run it before a publish. Build first.
//
// Three verdicts, because a server that refuses a script is not a dead page:
//   ok          the address answered, after any redirects
//   gone        404, 410, or a name that does not resolve: this fails the run
//   unverified  refused, rate limited, broken or too slow: listed, not failed
// --mutate dead adds an address that cannot exist (.invalid never resolves),
// so that the run can be seen to fail.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const TIMEOUT_MS = 15000;
const TRIES = 2;
// A pause between requests to the same host, so that a site with two cards
// on one host is not hit twice at once.
const HOST_GAP_MS = 1000;

const mutate = process.argv.includes('--mutate')
  ? process.argv[process.argv.indexOf('--mutate') + 1]
  : null;

/** What an answer means: only the server saying "not there" is gone. */
export function verdict({ status, error }) {
  if (status >= 200 && status < 400) return 'ok';
  if (status === 404 || status === 410) return 'gone';
  if (error === 'ENOTFOUND') return 'gone';
  return 'unverified';
}

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

async function ask(address) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    // GET and not HEAD, which some servers refuse. The body is never read.
    const response = await fetch(address, {
      redirect: 'follow',
      signal: controller.signal,
      headers: { 'user-agent': 'ooerflix-link-check', accept: 'text/html,*/*' },
    });
    await response.body?.cancel();
    return { status: response.status, final: response.url };
  } catch (error) {
    const code =
      error.cause?.code ??
      (error.name === 'AbortError' ? 'TIMEOUT' : error.name);
    return { status: 0, error: code };
  } finally {
    clearTimeout(timer);
  }
}

const html = readFileSync(
  resolve(import.meta.dirname, '../dist/index.html'),
  'utf8',
);
const addresses = [
  ...new Set(
    [...html.matchAll(/<a\b[^>]*\shref="(https:\/\/[^"]+)"/g)].map(
      (match) => match[1],
    ),
  ),
];
if (mutate === 'dead') addresses.push('https://this-cannot-exist.invalid/');
if (addresses.length === 0) {
  console.error('No https address found in dist/index.html: build first.');
  process.exit(2);
}

const results = [];
const lastAt = new Map();
for (const address of addresses) {
  const host = new URL(address).host;
  const wait = (lastAt.get(host) ?? 0) + HOST_GAP_MS - Date.now();
  if (wait > 0) await sleep(wait);
  let answer = await ask(address);
  for (
    let again = 1;
    again < TRIES && verdict(answer) === 'unverified';
    again += 1
  ) {
    await sleep(HOST_GAP_MS * 2);
    answer = await ask(address);
  }
  lastAt.set(host, Date.now());
  const outcome = verdict(answer);
  results.push({ address, outcome, ...answer });
  console.log(
    `${outcome.padEnd(10)} ${address} ${answer.error ?? answer.status}${
      answer.final && answer.final !== address ? ` -> ${answer.final}` : ''
    }`,
  );
}

const gone = results.filter((result) => result.outcome === 'gone');
const unverified = results.filter((result) => result.outcome === 'unverified');
console.log(
  `${results.length} addresses: ${results.length - gone.length - unverified.length} ok, ${unverified.length} unverified, ${gone.length} gone`,
);
if (unverified.length > 0)
  console.log(
    `unverified (not failed): ${unverified.map((r) => r.address).join(', ')}`,
  );
process.exit(gone.length > 0 ? 1 : 0);
