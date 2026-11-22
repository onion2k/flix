// How a spec waits for a strip to have finished moving, said once. A strip
// glides to where it is sent and then settles on a card, so a spec that reads
// its position too soon reads a place it is only passing through. Two specs
// each had their own wait, "the same place across two frames", and it was not
// enough: on a busy machine two frames can pass before a glide has moved at
// all, and a drag test then began from a strip still in flight and failed one
// run in forty. Without this file the specs that move a strip would each wait
// in their own way, and the weakest would fail by chance.
import type { Locator } from '@playwright/test';

/**
 * How many frames in a row the strip must be found in the same place before
 * it is taken to have stopped. A glide moves every frame once it has begun,
 * and the wait before it begins was seen to be two frames at most under load,
 * so twelve, about a fifth of a second, is well clear of both.
 */
const FRAMES_AT_REST = 12;

/** The strip has stopped: it has been in one place for a run of frames. */
export async function atRest(list: Locator): Promise<void> {
  await list.evaluate(
    (el, frames) =>
      new Promise<void>((done) => {
        let was = el.scrollLeft;
        let same = 0;
        const frame = () => {
          if (el.scrollLeft === was) same += 1;
          else {
            was = el.scrollLeft;
            same = 0;
          }
          if (same >= frames) done();
          else requestAnimationFrame(frame);
        };
        requestAnimationFrame(frame);
      }),
    FRAMES_AT_REST,
  );
}

/**
 * Does something that sends the strip somewhere, and comes back when the
 * browser itself says the scroll has ended (`scrollend`), which is after any
 * glide and after the strip has settled on a card. The listener is put on
 * before the action, so an instant scroll is not missed.
 */
export async function untilScrolled(
  list: Locator,
  action: () => Promise<void>,
): Promise<void> {
  const ended = list.evaluate(
    (el) =>
      new Promise<void>((done) => {
        el.addEventListener('scrollend', () => done(), { once: true });
      }),
  );
  await action();
  await ended;
}
