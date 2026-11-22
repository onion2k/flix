// Holds the rule that says which candidate is the day's feature: the index is
// the number of whole days since 1970-01-01 UTC, modulo the number of
// candidates. The clock is handed in as a number of milliseconds, so every case
// here is a date written out, never the day the test is run. Each case is a
// property of the rule (day 0 is the first, days step through and wrap, the
// day changes at midnight UTC and not before, one candidate is always the
// first) and the refusals are read by what they say.
import { describe, expect, it } from 'vitest';
import { featureIndex } from '../../src/catalogue/today';

const DAY = 86_400_000;

describe('featureIndex', () => {
  it('gives the first on day 0, whatever the count', () => {
    for (const count of [1, 2, 3, 4, 7, 100])
      expect(featureIndex(count, 0)).toBe(0);
    expect(featureIndex(4, DAY - 1)).toBe(0);
  });

  it('steps through the candidates a day at a time and wraps', () => {
    const seen = [0, 1, 2, 3, 4, 5, 6, 7, 8].map((day) =>
      featureIndex(4, day * DAY),
    );
    expect(seen).toEqual([0, 1, 2, 3, 0, 1, 2, 3, 0]);
    expect(
      [0, 1, 2, 3, 4, 5, 6].map((day) => featureIndex(3, day * DAY)),
    ).toEqual([0, 1, 2, 0, 1, 2, 0]);
  });

  it('is the same for any time within a day, and one more the next', () => {
    const day = 20_001;
    const early = featureIndex(4, day * DAY);
    expect(featureIndex(4, day * DAY + DAY / 2)).toBe(early);
    // The last millisecond of a day and the first of the next differ by one.
    const late = featureIndex(4, day * DAY + DAY - 1);
    const next = featureIndex(4, (day + 1) * DAY);
    expect(late).toBe(early);
    expect(next).toBe((late + 1) % 4);
  });

  it('is worked out in UTC: a day starts at 00:00 UTC, not at local midnight', () => {
    // 2026-11-22T23:59:59Z and 2026-11-23T00:00:00Z are a second apart and a
    // day apart. They are tried with this process's zone set a long way each
    // side of UTC, so that a rule that used local time would be told apart.
    const before = Date.UTC(2026, 10, 22, 23, 59, 59);
    const after = Date.UTC(2026, 10, 23, 0, 0, 0);
    expect(after - before).toBe(1000);
    const was = process.env['TZ'];
    try {
      for (const zone of ['Pacific/Auckland', 'America/Los_Angeles', 'UTC']) {
        process.env['TZ'] = zone;
        expect(featureIndex(4, after), zone).toBe(
          (featureIndex(4, before) + 1) % 4,
        );
      }
    } finally {
      if (was === undefined) delete process.env['TZ'];
      else process.env['TZ'] = was;
    }
  });

  it('gives 0 for a count of 1 on every day', () => {
    for (let day = 0; day < 50; day += 1)
      expect(featureIndex(1, day * DAY + 123)).toBe(0);
  });

  it('keeps a reading before 1970 inside the list, counting back', () => {
    expect(featureIndex(4, -1)).toBe(3);
    expect(featureIndex(4, -DAY)).toBe(3);
    expect(featureIndex(4, -DAY - 1)).toBe(2);
  });

  it('refuses a count that is not a whole number of at least 1', () => {
    for (const count of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])
      expect(() => featureIndex(count, 0), String(count)).toThrow(/count/);
  });

  it('refuses a time that is not a number', () => {
    for (const time of [
      Number.NaN,
      Number.POSITIVE_INFINITY,
      Number.NEGATIVE_INFINITY,
      '0' as unknown as number,
      undefined as unknown as number,
      null as unknown as number,
    ])
      expect(() => featureIndex(4, time), String(time)).toThrow(/time/);
  });
});
