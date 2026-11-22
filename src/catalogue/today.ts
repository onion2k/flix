// Says which of the candidates is the day's feature: the number of whole days
// since 1970-01-01 UTC, modulo the number of candidates. It is a pure
// function of a count and a reading of the clock, so that the clock is handed
// in and a test holds it. The same rule is said a second time in
// src/scripts/today-inline.js, which runs in the page before it is first drawn
// and cannot import this; tests/unit/today-inline.test.ts holds the two equal
// over many dates. Without this one place for the rule, the page could not say
// what it is meant to show, and a test could not say what it should have seen.

/** The length of a day, in milliseconds, as UTC counts them. */
const DAY_MS = 86_400_000;

/**
 * The index, from 0, of the day's feature among `count` candidates, at a
 * reading of the clock given in milliseconds since 1970-01-01 UTC. The day
 * changes at midnight UTC, and a reading before 1970 counts back, so that the
 * index is always inside the list. Refuses a count that is not a whole number
 * of at least 1, and a time that is not a finite number.
 */
export function featureIndex(count: number, nowMs: number): number {
  if (!Number.isInteger(count) || count < 1)
    throw new RangeError(
      `the count of candidates is a whole number of at least 1, and was ${String(count)}`,
    );
  if (typeof nowMs !== 'number' || !Number.isFinite(nowMs))
    throw new RangeError(
      `the time is a finite number of milliseconds, and was ${String(nowMs)}`,
    );
  const day = Math.floor(nowMs / DAY_MS);
  return ((day % count) + count) % count;
}
