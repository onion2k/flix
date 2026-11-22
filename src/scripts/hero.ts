// Works the moving hero: once the page has loaded, the day's feature's loop is
// made and played over its still, and the Pause button holds it and plays it
// again. The rules (play it, offer it, or leave the still; the button's words)
// are src/catalogue/hero.ts's; this only does them. The loop is a <video> made
// with its address then, which is the first any browser hears of it: until the
// load event the address is an attribute on the day's section, and a hidden
// candidate's is never read. It is muted, looped and inline, with the feature's
// own still as its poster, and it is added to the frame beside the still, so
// that if it never plays the still is what is drawn.
//
// Nothing plays by itself for a reader who asked for less motion: the still
// stays and the button reads Play, and the loop is fetched only if they press
// it. With Save-Data on, or no loop named, there is the still alone and the
// button stays hidden. If the loop cannot be fetched or played (a network
// failure, a codec the browser lacks, the browser's autoplay policy), the video
// is taken down and the button hidden, so that nothing offers a video that is
// not there. A loop that the reader pauses stays paused for the visit: it is
// kept nowhere and nothing starts it again. The button's words follow the
// video's own state, so that they cannot say Pause of a loop that is held. The
// page is whole without this: with script off there is the still, the panel
// and no button. It keeps one video and removes it if it fails.
import { heroStart, pauseWords } from '../catalogue/hero';

const hero = document.querySelector<HTMLElement>(
  'section.feature:not([hidden])',
);
const address = hero?.dataset['heroLoop'];
const button = hero?.querySelector<HTMLButtonElement>(
  'button[data-hero-button]',
);
const frame = hero?.querySelector<HTMLElement>('.feature-frame');
const title = hero?.querySelector('h2')?.textContent ?? '';

/** Whether the reader asked for the data to be spared. */
function saveData(): boolean {
  const connection = (
    navigator as Navigator & { connection?: { saveData?: boolean } }
  ).connection;
  return connection?.saveData === true;
}

const start = heroStart({
  hasLoop: address !== undefined,
  reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
  saveData: saveData(),
});

if (
  start !== 'still' &&
  hero !== undefined &&
  hero !== null &&
  address !== undefined &&
  button !== undefined &&
  button !== null &&
  frame !== undefined &&
  frame !== null
) {
  let video: HTMLVideoElement | null = null;

  /** Says what pressing the button will do, in its words and its name. */
  const say = (playing: boolean): void => {
    const { words, name } = pauseWords(title, playing);
    button.textContent = words;
    button.setAttribute('aria-label', name);
  };

  /** Takes the loop down and the button with it: the still is what is left. */
  const giveUp = (): void => {
    if (video !== null) {
      video.pause();
      video.removeAttribute('src');
      video.load();
      video.remove();
      video = null;
    }
    button.hidden = true;
  };

  /** Makes the loop, with its address and the still as its poster, and plays it. */
  const begin = (): void => {
    const made = document.createElement('video');
    made.className = 'hero-loop';
    made.muted = true;
    made.loop = true;
    made.playsInline = true;
    // The loop is a picture that moves; its words are the still's alt text and
    // the button's name, and the video offers a screen reader nothing.
    made.setAttribute('aria-hidden', 'true');
    const still = hero.querySelector<HTMLImageElement>('.feature-frame img');
    if (still !== null && still.currentSrc !== '')
      made.poster = still.currentSrc;
    made.addEventListener('play', () => say(true));
    made.addEventListener('pause', () => say(false));
    made.addEventListener('error', giveUp);
    made.src = address;
    frame.append(made);
    video = made;
    say(true);
    button.hidden = false;
    // A refusal (autoplay policy, a codec) leaves the still showing. An abort
    // is only a pause pressed while the play was starting, which is not one.
    made.play().catch((error: unknown) => {
      if (!(error instanceof DOMException && error.name === 'AbortError'))
        giveUp();
    });
  };

  button.addEventListener('click', () => {
    if (video === null) begin();
    else if (video.paused) video.play().catch(giveUp);
    else video.pause();
  });

  if (start === 'offer') {
    say(false);
    button.hidden = false;
  } else if (document.readyState === 'complete') begin();
  else window.addEventListener('load', begin, { once: true });
}
