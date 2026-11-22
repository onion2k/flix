// Reads the headers a live address sends and fails unless the ones that stop
// framing, downgrades, guessed content types and a leaking referrer are all
// there. They are set in netlify.toml, which nothing in the build reads, so
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
const checks = [
  [
    'Content-Security-Policy with frame-ancestors',
    /(^|;)\s*frame-ancestors\s+\S/i.test(policy),
    policy === '' ? 'no Content-Security-Policy sent' : `got: ${policy}`,
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
