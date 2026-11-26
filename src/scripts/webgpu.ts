// Asks the visitor's browser, once, whether it can run WebGPU, and where it
// certainly cannot, says so on each card whose site requires it (a card the
// page marks `data-requires="webgpu"`) and on the feature's panel when the
// day's feature is one. Some of the sites are built on WebGPU with no fallback,
// and a card is only a link out: this tells a visitor before they leave. What
// the answer means is src/catalogue/webgpu.ts's rule (webgpuVerdict), and the
// words are its own; this asks the browser, waits at most WEBGPU_WAIT_MS, and
// draws.
//
// The question is `navigator.gpu.requestAdapter()`, made once, after the
// window's `load` (or at once if it has come), so that it never competes with
// what the first screen draws. It is a question to the browser alone: nothing
// is read from the adapter, and nothing is sent or kept. A browser with no
// `navigator.gpu`, a request that fails or throws, and one answered with no
// adapter all lack it; an adapter has it; a request not answered in time is
// unknown, since a slow answer says nothing. Only "lacks" changes the page,
// and it adds a line and moves nothing: the verdict comes after the page has
// drawn, and a card moved then would shift under the reader. The verdict is
// also written on the root as data-webgpu (has, lacks or unknown), for the
// tests.
//
// A line is made with createElement and textContent, never a written string:
// the page enforces Trusted Types. It goes after the needs line where a face
// has one, else after the title (the front) or the description (the back and
// the panel). The back of a card that is not flipped is inert, so a line added
// to it is not in the accessibility tree until the card is turned.
import {
  WEBGPU_WAIT_MS,
  WEBGPU_WORDS,
  webgpuVerdict,
} from '../catalogue/webgpu';
import type { WebGPUState } from '../catalogue/webgpu';

/** The adapter request, the one part of the API this page uses. */
interface Gpu {
  requestAdapter(): Promise<unknown>;
}

/** How the request ended, or `pending` if it was still open when the wait was. */
function ask(gpu: Gpu): Promise<WebGPUState> {
  return new Promise((resolve) => {
    const done = (outcome: 'adapter' | 'null' | 'rejected' | 'pending') => {
      clearTimeout(timer);
      resolve({ api: true, outcome });
    };
    const timer = setTimeout(() => done('pending'), WEBGPU_WAIT_MS);
    try {
      gpu.requestAdapter().then(
        (adapter) => done(adapter == null ? 'null' : 'adapter'),
        () => done('rejected'),
      );
    } catch {
      done('rejected');
    }
  });
}

/** Puts the line after `anchor`, or after `fallback` where there is none. */
function say(anchor: Element | null, fallback: Element | null): void {
  const after = anchor ?? fallback;
  if (after === null) return;
  const line = document.createElement('p');
  line.className = 'card-webgpu';
  line.textContent = WEBGPU_WORDS;
  after.after(line);
}

/** The line on every card and panel that requires WebGPU. */
function draw(): void {
  for (const card of document.querySelectorAll(
    'li.card[data-requires~="webgpu"]',
  )) {
    const front = card.querySelector('.face.front');
    const back = card.querySelector('.face.back');
    say(
      front?.querySelector('.card-needs') ?? null,
      front?.querySelector('.card-title') ?? null,
    );
    say(
      back?.querySelector('.card-needs') ?? null,
      back?.querySelector('.description') ?? null,
    );
  }
  for (const panel of document.querySelectorAll(
    'section.feature[data-requires~="webgpu"]',
  )) {
    say(
      panel.querySelector('.card-needs'),
      panel.querySelector('.description'),
    );
  }
}

async function run(): Promise<void> {
  const gpu = (navigator as Navigator & { gpu?: Gpu }).gpu;
  const state: WebGPUState =
    gpu === undefined ? { api: false } : await ask(gpu);
  const verdict = webgpuVerdict(state);
  document.documentElement.dataset['webgpu'] = verdict;
  if (verdict === 'lacks') draw();
}

if (document.readyState === 'complete') void run();
else window.addEventListener('load', () => void run(), { once: true });
