// Holds the page's one source of chance: a seeded generator that gives the
// same numbers for the same seed and nothing else, a pick that honours what
// it must not return and uses only the random it is handed, and the check on
// a seed that comes from outside. The generator is run by many seeds and many
// numbers, since a generator that is right for one seed can still collapse to
// a few values for another. Without this a surprise that was not seeded would
// pass every other test and then differ on every run of an end-to-end one.
import { describe, expect, it } from 'vitest';
import { pick, seeded, seedFrom } from '../../src/catalogue/chance';

/** The first `count` numbers a generator gives. */
function run(seed: number, count: number): number[] {
  const random = seeded(seed);
  return Array.from({ length: count }, () => random());
}

describe('seeded', () => {
  it('gives the same sequence for the same seed, and not from a shared state', () => {
    const first = seeded(42);
    const second = seeded(42);
    // Interleaved, so that a generator that kept its state outside itself
    // would give the second one a different run.
    const one: number[] = [];
    const two: number[] = [];
    for (let at = 0; at < 50; at += 1) {
      one.push(first());
      two.push(second());
    }
    expect(one).toEqual(two);
    expect(run(42, 50)).toEqual(one);
  });

  it('gives a different sequence for a different seed', () => {
    const seen = new Set<string>();
    const seeds = [0, 1, 2, 3, 4, 100, 2 ** 31, 2 ** 32 - 1, -2, 1752000000000];
    for (const seed of seeds) seen.add(run(seed, 8).join(','));
    expect(seen.size).toBe(seeds.length);
  });

  it('keeps every number from 0 up to but not 1, over many seeds and numbers', () => {
    let counted = 0;
    let total = 0;
    for (let seed = 0; seed < 50; seed += 1) {
      for (const number of run(seed * 7919, 2000)) {
        expect(number).toBeGreaterThanOrEqual(0);
        expect(number).toBeLessThan(1);
        total += number;
        counted += 1;
      }
    }
    expect(counted).toBe(100_000);
    // A generator stuck near one end would still be in range.
    expect(total / counted).toBeGreaterThan(0.49);
    expect(total / counted).toBeLessThan(0.51);
  });

  it('spreads its numbers across the range, tenth by tenth', () => {
    const counts = new Array<number>(10).fill(0);
    for (const number of run(7, 20_000))
      counts[Math.floor(number * 10)] =
        (counts[Math.floor(number * 10)] ?? 0) + 1;
    // 2000 expected each, sd about 42: 300 either way is over seven.
    for (const count of counts)
      expect(Math.abs(count - 2000)).toBeLessThan(300);
  });
});

describe('seedFrom', () => {
  const CLOCK = 1_752_000_000_000;

  it('takes a safe integer as it is, 0 and negatives included', () => {
    expect(seedFrom(5, CLOCK)).toBe(5);
    expect(seedFrom(0, CLOCK)).toBe(0);
    expect(seedFrom(-3, CLOCK)).toBe(-3);
    expect(seedFrom(2 ** 40, CLOCK)).toBe(2 ** 40);
  });

  it('takes the clock for anything else that comes from outside', () => {
    const outside: unknown[] = [
      '5',
      '',
      Number.NaN,
      1.5,
      Infinity,
      -Infinity,
      2 ** 60,
      null,
      undefined,
      {},
      [],
      [5],
      true,
      5n,
      () => 5,
    ];
    for (const value of outside) expect(seedFrom(value, CLOCK)).toBe(CLOCK);
    expect(outside.length).toBe(15);
  });
});

describe('pick', () => {
  const IDS = ['a', 'b', 'c', 'd', 'e'];

  it('never gives one that is excluded, for every excluded set of the ids', () => {
    let checked = 0;
    // Every subset of five ids, each tried with 40 draws.
    for (let mask = 0; mask < 2 ** IDS.length; mask += 1) {
      const not = new Set(IDS.filter((_, at) => (mask >> at) & 1));
      const random = seeded(mask + 1);
      for (let draw = 0; draw < 40; draw += 1) {
        const got = pick(IDS, not, random);
        if (not.size === IDS.length) expect(got).toBeNull();
        else {
          expect(got).not.toBeNull();
          expect(IDS).toContain(got);
          expect(not.has(got ?? '')).toBe(false);
        }
        checked += 1;
      }
    }
    expect(checked).toBe(32 * 40);
  });

  it('gives nothing when none is left, and when there were none', () => {
    expect(pick(IDS, new Set(IDS), seeded(1))).toBeNull();
    expect(pick([], new Set(), seeded(1))).toBeNull();
  });

  it('takes an excluded id that is not among the ids as nothing to leave out', () => {
    const got = pick(['a'], new Set(['zzz']), () => 0);
    expect(got).toBe('a');
  });

  it('uses only the random it is handed: one draw for a pick, none for nothing', () => {
    let draws = 0;
    const counter = () => {
      draws += 1;
      return 0.5;
    };
    pick(IDS, new Set(), counter);
    expect(draws).toBe(1);
    pick(IDS, new Set(['a']), counter);
    expect(draws).toBe(2);
    pick(IDS, new Set(IDS), counter);
    expect(draws).toBe(2);
    pick([], new Set(), counter);
    expect(draws).toBe(2);
  });

  it('maps the ends of the range to the first and last that are left', () => {
    expect(pick(IDS, new Set(['a']), () => 0)).toBe('b');
    expect(pick(IDS, new Set(['e']), () => 0.999999999)).toBe('d');
    // 1 is not a number the generator gives, but a hand-made random could.
    expect(pick(IDS, new Set(), () => 1)).toBe('e');
  });

  it('gives the same picks for the same seed', () => {
    const picks = (seed: number) => {
      const random = seeded(seed);
      return Array.from({ length: 30 }, () => pick(IDS, new Set(), random));
    };
    expect(picks(9)).toEqual(picks(9));
    expect(picks(9)).not.toEqual(picks(10));
  });

  it('gives every id over a few thousand picks, none far from its share', () => {
    const ids = Array.from({ length: 19 }, (_, at) => `site-${at}`);
    const random = seeded(2026);
    const counts = new Map<string, number>(ids.map((id) => [id, 0]));
    const draws = 4000;
    for (let draw = 0; draw < draws; draw += 1) {
      const got = pick(ids, new Set(), random);
      expect(got).not.toBeNull();
      counts.set(got ?? '', (counts.get(got ?? '') ?? 0) + 1);
    }
    const share = draws / ids.length;
    // Each count is binomial with a standard deviation of about 14 here, so
    // half to one and a half times the share (105 either way) is over seven
    // deviations: a fair generator is outside it with a chance under 1e-11,
    // and the seed is fixed, so it cannot flicker at all.
    for (const [id, count] of counts) {
      expect(count, `${id} came up`).toBeGreaterThan(share * 0.5);
      expect(count, `${id} came up`).toBeLessThan(share * 1.5);
    }
    expect(counts.size).toBe(19);
  });

  it('stays fair when one is left out each time, as the page does', () => {
    const ids = ['a', 'b', 'c', 'd'];
    const random = seeded(5);
    const counts = new Map<string, number>(ids.map((id) => [id, 0]));
    let last: string | null = null;
    for (let draw = 0; draw < 4000; draw += 1) {
      const got = pick(ids, new Set(last === null ? [] : [last]), random);
      expect(got).not.toBe(last);
      last = got;
      counts.set(got ?? '', (counts.get(got ?? '') ?? 0) + 1);
    }
    // 1000 each expected, sd about 28 (and picks lean on their neighbours a
    // little): 300 either way is far outside it.
    for (const count of counts.values())
      expect(Math.abs(count - 1000)).toBeLessThan(300);
  });
});
