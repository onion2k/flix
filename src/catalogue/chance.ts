// The page's one source of chance, and the two rules that use it: a seeded
// generator, a pick that leaves out what it is told to, and the check on a
// seed that comes from outside. Nothing here reads the clock, the language's
// own global random or any state kept between calls, so a seed handed in
// gives the same numbers on every run and a test can hold the page to them.
// Without it a "Surprise me" that reached for the global random would be
// different on every load, and no test could say which card it should land
// on, or that it never lands on the one it must not.

/** A source of numbers from 0 up to but not 1. */
export type Random = () => number;

/**
 * Mulberry32, by Tommy Ettinger: a 32-bit state that steps by a fixed amount
 * and is mixed on the way out. It is enough here because the page needs only
 * a fair pick among a few dozen cards, for which a small, fast generator with
 * a full 2^32 period and a good spread is far more than enough; nothing
 * depends on it being unpredictable, and nothing is secret. The state is held
 * in the closure, so two generators never share one. A seed is kept to 32
 * bits, so two seeds 2^32 apart give the same run, which a clock's reading
 * in milliseconds never meets within a lifetime of one page.
 */
export function seeded(seed: number): Random {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let mixed = Math.imul(state ^ (state >>> 15), state | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * The seed to use, given what a test handed in (anything at all, since it
 * comes from outside the module) and the clock's reading to fall back on. A
 * safe integer is taken as it is. Anything else (a string, NaN, 1.5, an
 * infinity, a number too big to be exact) is ignored, not repaired, so that a
 * badly formed seed never changes what the page does in a way a test could
 * mistake for the seed working. The clock is handed in, never read here.
 */
export function seedFrom(outside: unknown, clock: number): number {
  return typeof outside === 'number' && Number.isSafeInteger(outside)
    ? outside
    : clock;
}

/**
 * One of `ids` that is not in `not`, chosen with the `random` handed in, or
 * null where none is left. It draws once for a pick and not at all for
 * nothing, so that two runs with the same seed stay in step.
 */
export function pick(
  ids: readonly string[],
  not: ReadonlySet<string>,
  random: Random,
): string | null {
  const left = ids.filter((id) => !not.has(id));
  if (left.length === 0) return null;
  // A hand-made random could give 1, which would fall off the end.
  const at = Math.min(left.length - 1, Math.floor(random() * left.length));
  return left[at] ?? null;
}
