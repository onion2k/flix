// Reads the headers a live address sends and fails unless the ones that stop
// framing, downgrades, guessed content types and a leaking referrer are all
// there, and the content policy is the whole one: frame-ancestors, object-src,
// base-uri, a default-src, and a script-src that lets no inline code or eval
// in. The policy comes from dist/_headers (written by the build) and the rest
// from netlify.toml, and nothing in the build reads either as Netlify does, so
// the only proof they are sent is a response from where the site is served.
//   npm run headers -- https://flix.ooer.com/
//
// It is for the live address, once there is one, and is not part of
// `npm run check`: the local preview sends none of these headers, so run
// against it the script fails, which is how it is seen to work. The script
// is plain Node and needs the network only for the address it is given.
const address = process.argv[2];
if (address === undefined) {
  console.error('Usage: npm run headers -- <address>');
  process.exit(2);
}

// An address that cannot be reached at all is said in one line, with the
// reason the connection gave, and not as a stack: the commonest case is a
// name whose certificate has not been issued yet, and its message says so.
let response;
try {
  response = await fetch(address, { redirect: 'follow' });
} catch (error) {
  const cause = error instanceof Error ? error.cause : undefined;
  const why =
    cause instanceof Error
      ? `${'code' in cause ? `${String(cause.code)}: ` : ''}${cause.message}`
      : String(error);
  console.error(`COULD NOT REACH ${address}: ${why}`);
  process.exit(1);
}
await response.body?.cancel();
const header = (name) => response.headers.get(name) ?? '';

const policy = header('content-security-policy');
// The policy is read as a browser reads it: a directive is its first mention,
// and its sources are what follows. Said once here, so that each piece below
// is a question of this map and not of a pattern over the whole text.
const directives = new Map();
for (const part of policy.split(';')) {
  const [name, ...sources] = part.trim().split(/\s+/);
  if (name !== undefined && name !== '' && !directives.has(name.toLowerCase()))
    directives.set(name.toLowerCase(), sources);
}
const sourcesOf = (name) => directives.get(name) ?? [];
const scriptSources = sourcesOf('script-src').map((source) =>
  source.toLowerCase(),
);
// What was found of one directive, short, since a script-src holds a hash for
// every inline script and a line of them says nothing the first words do not.
const found = (name) => {
  if (policy === '') return 'no Content-Security-Policy sent';
  if (!directives.has(name)) return `no ${name} in the policy`;
  const text = `${name} ${sourcesOf(name).join(' ')}`;
  return `got: ${text.length > 100 ? `${text.slice(0, 100)}...` : text}`;
};
const checks = [
  [
    'Content-Security-Policy with frame-ancestors',
    sourcesOf('frame-ancestors').length > 0,
    found('frame-ancestors'),
  ],
  [
    "Content-Security-Policy with object-src 'none'",
    sourcesOf('object-src').join(' ') === "'none'",
    found('object-src'),
  ],
  [
    'Content-Security-Policy with base-uri',
    sourcesOf('base-uri').length > 0,
    found('base-uri'),
  ],
  [
    'Content-Security-Policy with default-src',
    sourcesOf('default-src').length > 0,
    found('default-src'),
  ],
  [
    'Content-Security-Policy with a script-src',
    directives.has('script-src'),
    found('script-src'),
  ],
  [
    "Content-Security-Policy with no 'unsafe-inline' in script-src",
    directives.has('script-src') && !scriptSources.includes("'unsafe-inline'"),
    found('script-src'),
  ],
  [
    "Content-Security-Policy with no 'unsafe-eval' in script-src",
    directives.has('script-src') && !scriptSources.includes("'unsafe-eval'"),
    found('script-src'),
  ],
  [
    'Strict-Transport-Security',
    /max-age=\d+/i.test(header('strict-transport-security')),
    'no Strict-Transport-Security with a max-age sent',
  ],
  [
    'X-Content-Type-Options: nosniff',
    header('x-content-type-options').toLowerCase() === 'nosniff',
    `got: ${header('x-content-type-options') || 'nothing'}`,
  ],
  [
    'Referrer-Policy',
    header('referrer-policy') !== '',
    'no Referrer-Policy sent',
  ],
  [
    'X-Frame-Options',
    ['deny', 'sameorigin'].includes(header('x-frame-options').toLowerCase()),
    `got: ${header('x-frame-options') || 'nothing'}`,
  ],
];

let failed = 0;
// Headers on a page that is not the site prove nothing about the site: a
// host's own "not found" page can carry every one of them.
if (!response.ok) {
  failed += 1;
  console.error(
    `NOT THE SITE: ${response.url} answered ${response.status}, so its headers are some other page's`,
  );
}
for (const [name, ok, why] of checks) {
  if (!ok) {
    failed += 1;
    console.error(`MISSING ${name}: ${why}`);
  }
}
console.log(
  `${response.url} answered ${response.status}: ${checks.filter(([, ok]) => ok).length} of ${checks.length} headers held`,
);
process.exit(failed === 0 ? 0 : 1);
