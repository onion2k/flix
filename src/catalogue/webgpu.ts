// What a site requires of the browser that opens it, and what a card says
// where the browser lacks it. Some of the sites are built on WebGPU with no
// fallback: in a browser without it they show an error, or hang on a loading
// screen for good, and a card is only a link out, so it says so in words before
// a visitor leaves. Whether the browser has it is not known at build, only in
// the visitor's own browser, which src/scripts/webgpu.ts asks once after the
// page has loaded; the rule that turns its answer into a verdict is here, pure,
// so that it is held by a unit test and not by a browser. The words are a draft
// for the owner to edit and are said here and nowhere else; the markup holds
// none, only which cards require it.

/** What a site may require of a browser: one thing so far. */
export const REQUIRES = ['webgpu'] as const;
export type Requirement = (typeof REQUIRES)[number];

/** The line a card says where its site will not run in the visitor's browser. */
export const WEBGPU_WORDS = "Won't run in this browser: it needs WebGPU.";

/**
 * How long the page waits for the browser to answer, in milliseconds. A slow
 * answer says nothing either way, so past this the verdict is unknown and the
 * page is left as it was.
 */
export const WEBGPU_WAIT_MS = 3000;

/**
 * What the page learnt: whether the browser has the API at all (`navigator.gpu`)
 * and, if so, how its request for an adapter ended when the wait was over. An
 * adapter is the browser's word that a device can run it; `null` and a refusal
 * are its word that none can; `pending` is no word yet.
 */
export type WebGPUState =
  | { api: false }
  | { api: true; outcome: 'adapter' | 'null' | 'rejected' | 'pending' };

/** Whether the browser can run WebGPU, cannot, or has not said. */
export type Verdict = 'has' | 'lacks' | 'unknown';

/**
 * The verdict. Only `lacks` changes the page, so only a certain answer of no
 * is one: a request still open, which may yet come back with an adapter, is
 * unknown and never lacks.
 */
export function webgpuVerdict(state: WebGPUState): Verdict {
  if (!state.api) return 'lacks';
  switch (state.outcome) {
    case 'adapter':
      return 'has';
    case 'null':
    case 'rejected':
      return 'lacks';
    case 'pending':
      return 'unknown';
  }
}
