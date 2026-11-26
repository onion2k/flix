// Holds the rule that says, from what the page learnt of the browser, whether
// it can run WebGPU, and the words a card says where it cannot. Every way the
// question can end is a case: no API at all, an adapter, a null adapter, a
// rejected request and one still open when the wait is over. The verdict
// "unknown" must never read as "lacks", since a card that says a site will not
// run, on a browser that was only slow, would turn a visitor away wrongly; and
// "lacks" must never read as "has", the reverse. Each case counts what it
// reached, so that an empty table is a failure and not a pass.
import { describe, expect, it } from 'vitest';
import {
  REQUIRES,
  WEBGPU_WAIT_MS,
  WEBGPU_WORDS,
  webgpuVerdict,
} from '../../src/catalogue/webgpu';
import type { WebGPUState } from '../../src/catalogue/webgpu';

describe('REQUIRES', () => {
  it('names webgpu, and only webgpu so far', () => {
    expect([...REQUIRES]).toEqual(['webgpu']);
  });
});

describe('the words', () => {
  it('say what will happen and why, said once', () => {
    expect(WEBGPU_WORDS).toBe("Won't run in this browser: it needs WebGPU.");
  });
});

describe('the wait', () => {
  it('is three seconds', () => {
    expect(WEBGPU_WAIT_MS).toBe(3000);
  });
});

describe('webgpuVerdict', () => {
  const cases: [string, WebGPUState, string][] = [
    ['no API', { api: false }, 'lacks'],
    ['an adapter', { api: true, outcome: 'adapter' }, 'has'],
    ['a null adapter', { api: true, outcome: 'null' }, 'lacks'],
    ['a rejected request', { api: true, outcome: 'rejected' }, 'lacks'],
    ['a request still open', { api: true, outcome: 'pending' }, 'unknown'],
  ];

  for (const [name, state, verdict] of cases) {
    it(`says ${verdict} for ${name}`, () => {
      expect(webgpuVerdict(state)).toBe(verdict);
    });
  }

  it('reached every verdict, so that a rule that says one thing fails', () => {
    expect(new Set(cases.map(([, state]) => webgpuVerdict(state)))).toEqual(
      new Set(['has', 'lacks', 'unknown']),
    );
  });
});
