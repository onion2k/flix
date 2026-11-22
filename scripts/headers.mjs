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

const response = await fetch(address, { redirect: 'follow' });
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
for (const [name, ok, why] of checks) {
  if (!ok) {
    failed += 1;
    console.error(`MISSING ${name}: ${why}`);
  }
}
console.log(
  `${response.url} answered ${response.status}: ${checks.length - failed} of ${checks.length} headers held`,
);
process.exit(failed === 0 ? 0 : 1);
