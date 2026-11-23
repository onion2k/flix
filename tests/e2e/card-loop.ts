// Brings a card's loop on, as a reader does: the first row is put in the middle
// of the window, and the page's own settle time runs in real time until the
// card it names shows its Pause button (and, unless the reader asked for less
// motion, plays). For the specs that need a card loop to be there to hold the
// page to something else (its ring, its contrast, axe, the policy); what plays
// and when is playing.spec.ts's, which steps the clock. Without it each would
// copy the scroll and the wait, and one would drift from the others.
import { expect, type Locator, type Page } from '@playwright/test';

/** Puts the first row's pictures in the middle of the window, by a jump. */
export async function centreFirstRow(page: Page): Promise<void> {
  await page.evaluate(() => {
    const frame = document.querySelector('section.row li.card .frame');
    const box = frame?.getBoundingClientRect();
    if (box === undefined) throw new Error('no card');
    window.scrollTo({
      top: scrollY + box.top + box.height / 2 - innerHeight / 2,
      behavior: 'instant',
    });
  });
}

/**
 * Settles on the first row and waits for the Pause button, and for the loop
 * to play where `playing` is asked. Gives back the card that holds them.
 */
export async function settleOnFirstRow(
  page: Page,
  playing = true,
): Promise<Locator> {
  await expect(page.locator('section.row[data-arrows]').first()).toBeAttached();
  await centreFirstRow(page);
  const pause = page.locator('section.row button.card-pause');
  await expect(pause).toBeVisible();
  // The inner locator of `has` is read inside each card.
  const card = page.locator('section.row li.card', {
    has: page.locator('button.card-pause'),
  });
  if (playing)
    await expect
      .poll(() =>
        card
          .locator('video')
          .evaluate(
            (video: HTMLVideoElement) =>
              !video.paused && video.currentTime > 0.3,
          ),
      )
      .toBe(true);
  return card;
}
