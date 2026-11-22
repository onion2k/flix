// Plays a card's previews: a mouse that has stopped on a card that has some, or
// keyboard focus on its link, shows them in turn over its own picture, once,
// as preview.ts says (the time is each frame's timestamp, which is handed to
// the rule), and then the card rests. Leaving stops it at once: the marks are
// cleared, no more frames are asked for, and the card is ready for the next
// entry. The previews' addresses are in data- attributes, and the first time
// the pause has passed they are moved to srcset and src, once, which is when a
// browser fetches them; until then nothing about a preview costs the page a
// request. A preview that has not arrived is not shown, so that a slow one
// leaves the card's own picture and never a blank.
//
// It does nothing, and fetches nothing, where the reader asked for less
// motion, where Save-Data is on, for touch (only a mouse where there is a
// pointer that hovers starts it, and a keyboard's focus that is visible), and
// while the card's own picture has not arrived (a late card still waiting).
// It runs on requestAnimationFrame only while a pass is playing, builds no
// markup, sets no style but the attribute the stylesheet reads, and keeps one
// small record and one frame's handle, so nothing it keeps grows. Without it
// the previews are never fetched or shown, and the page loses nothing.
import { PAUSE_MS, passLength, previewAt } from '../catalogue/preview';

/** What is playing: the card, its previews, and when its first frame was. */
interface Pass {
  card: HTMLElement;
  layer: HTMLElement;
  images: HTMLImageElement[];
  /** The timestamp of the first frame, which is where the pass begins. */
  began: number | null;
}

const CARDS = [...document.querySelectorAll<HTMLElement>('li.card')].filter(
  (card) => card.querySelector('.previews') !== null,
);

/** The card a mouse is on, and the one whose link has visible focus. */
let hovered: HTMLElement | null = null;
let focused: HTMLElement | null = null;
let pass: Pass | null = null;
let frame: number | null = null;

/** Whether an image has arrived and can be drawn. */
function drawn(image: HTMLImageElement | null | undefined): boolean {
  return (
    image !== null &&
    image !== undefined &&
    image.complete &&
    image.naturalWidth > 0
  );
}

/** Whether this reader and this card allow a pass to begin. */
function allowed(card: HTMLElement): boolean {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
  const connection = (
    navigator as Navigator & { connection?: { saveData?: boolean } }
  ).connection;
  if (connection?.saveData === true) return false;
  // The card's own picture, which a late card has not been given until its
  // row is near, and which a preview must not be drawn before.
  return drawn(card.querySelector<HTMLImageElement>('.frame picture img'));
}

/** Moves the previews' addresses to where a browser fetches from, once. */
function bringIn(running: Pass): void {
  const sizes = running.layer.dataset['sizes'] ?? '';
  for (const image of running.images) {
    const srcset = image.dataset['previewSrcset'];
    const src = image.dataset['previewSrc'];
    if (srcset === undefined || src === undefined) continue;
    image.sizes = sizes;
    image.srcset = srcset;
    image.src = src;
    delete image.dataset['previewSrcset'];
    delete image.dataset['previewSrc'];
  }
}

/** Marks the preview at `place` (and no other), or none where it is null. */
function show(running: Pass, place: number | null): void {
  running.images.forEach((image, at) =>
    image.toggleAttribute('data-showing', at === place && drawn(image)),
  );
}

/** One frame of a pass: the rule says what shows, and the frame is asked for again until it ends. */
function advance(now: number): void {
  frame = null;
  if (pass === null) return;
  pass.began ??= now;
  const elapsed = now - pass.began;
  if (elapsed >= PAUSE_MS) bringIn(pass);
  show(pass, previewAt(elapsed, pass.images.length));
  // After the last the card rests, and no frame is asked for.
  if (elapsed < passLength(pass.images.length))
    frame = requestAnimationFrame(advance);
}

function stop(): void {
  if (frame !== null) cancelAnimationFrame(frame);
  frame = null;
  if (pass !== null) show(pass, null);
  pass = null;
}

function start(card: HTMLElement): void {
  const layer = card.querySelector<HTMLElement>('.previews');
  if (layer === null || !allowed(card)) return;
  pass = {
    card,
    layer,
    images: [...layer.querySelectorAll<HTMLImageElement>('img')],
    began: null,
  };
  frame = requestAnimationFrame(advance);
}

/** Brings what plays into line with what is hovered or focused. */
function reconcile(): void {
  const wanted = hovered ?? focused;
  if (wanted === (pass?.card ?? null)) return;
  stop();
  if (wanted !== null) start(wanted);
}

for (const card of CARDS) {
  card.addEventListener('pointerenter', (event) => {
    // A mouse, on a screen where a pointer hovers: a touch's pointerenter, and
    // a pen's, are not a reader who has stopped on a card.
    if (event.pointerType !== 'mouse') return;
    if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    hovered = card;
    reconcile();
  });
  card.addEventListener('pointerleave', () => {
    if (hovered !== card) return;
    hovered = null;
    reconcile();
  });
  card.addEventListener('focusin', (event) => {
    const target = event.target;
    // Focus a keyboard (or a script after one) put on the link, which is what
    // :focus-visible says; a tap that focuses it does not.
    if (
      !(target instanceof HTMLElement) ||
      !target.matches('a.card-link:focus-visible')
    )
      return;
    focused = card;
    reconcile();
  });
  card.addEventListener('focusout', () => {
    if (focused !== card) return;
    focused = null;
    reconcile();
  });
}
