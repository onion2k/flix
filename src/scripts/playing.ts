// Plays the loop of the card most in focus. Which card that is, and when the
// answer has held long enough to act on, is src/catalogue/playing.ts's; whether
// a loop plays by itself, waits to be asked or is never offered is heroStart()'s
// in src/catalogue/hero.ts, the hero's own rule; this reads the page and does
// what they say. It reads the cards' boxes when the page or a strip scrolls,
// the window is resized, a mouse comes onto a card or leaves it, focus moves, a
// card is flipped, a picture arrives or the tab is hidden, and counts the
// settle time on requestAnimationFrame from each frame's own time. It runs no
// frame while nothing is waiting to settle.
//
// It keeps one video at most: a <video> made with its address when its card is
// settled on, which is the first any browser hears of a card's loop (until then
// the address is the card's data-loop, which no browser fetches), muted, looped
// and inline, hidden from the accessibility tree (the picture's alt words say
// what it shows), and added to the card's frame over the picture. It is taken
// down, paused with its address removed so the browser lets the file go, when
// another card takes over or none may play, and at once when its card stops
// qualifying (scrolled out of the window, flipped) or the tab is hidden. A loop
// that fails to load or play is taken down with its button, quietly, and its
// card keeps its still and is not tried again this visit.
//
// The one Pause button goes with the card in focus, at the lower right of its
// picture, after its flip button in the Tab order. It holds every card's loop
// for the visit, kept nowhere: nothing starts one again until Play is pressed,
// and the button then shows on whichever card is in focus, ready to play it. A
// reader who asked for less motion is shown the button and no loop, on each
// card in turn, and a card's loop is fetched only when its Play is pressed; one
// who asked to spare data, or a page with no card loops, has nothing at all.
// The button and its marks are built with DOM calls, never from a string, since
// the content policy's Trusted Types refuse that. What it keeps is one video,
// one button and the cards given up on, which are the page's own cards and
// cannot grow past them. Without it no card's loop would play, which is the
// page as it is with script off: the stills.
import { cardPauseWords, heroStart } from '../catalogue/hero';
import {
  inFocus,
  qualifies,
  settled,
  type PlayCard,
} from '../catalogue/playing';
import { lessMotion, savesData } from './asked';
import { frameBox, heroBox, windowNow } from './reading';

const SVG = 'http://www.w3.org/2000/svg';

const cards = [
  ...document.querySelectorAll<HTMLElement>('section.row li.card'),
];

const start = heroStart({
  hasLoop: cards.some((card) => card.dataset['loop'] !== undefined),
  reducedMotion: lessMotion(),
  saveData: savesData(),
});

/** A mark for the button, two bars or a triangle, drawn in the button's colour. */
function mark(shape: 'pause' | 'play'): SVGSVGElement {
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('viewBox', '0 0 16 16');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  const path = document.createElementNS(SVG, 'path');
  path.setAttribute(
    'd',
    shape === 'pause'
      ? 'M3 2h3.5v12H3zM9.5 2H13v12H9.5z'
      : 'M3.5 1.5l11 6.5-11 6.5z',
  );
  path.setAttribute('fill', 'currentColor');
  svg.append(path);
  return svg;
}

if (start !== 'still') {
  const failed = new Set<HTMLElement>();
  const place = document.createElement('span');
  place.className = 'card-pause-place';
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'card-pause';
  const marks = { pause: mark('pause'), play: mark('play') };
  const name = document.createElement('span');
  name.className = 'visually-hidden';
  button.append(marks.play, name);
  place.append(button);

  /** The card that holds the button, and the loop if one is made. */
  let shown: HTMLElement | null = null;
  let video: HTMLVideoElement | null = null;
  /** Every card loop is held: a reader pressed Pause, or asked for less motion. */
  let held = start === 'offer';
  /** The answer waiting to settle, and the time it was first seen. */
  let pending: { card: HTMLElement; since: number } | null = null;
  let frame: number | null = null;
  let mouse: HTMLElement | null = null;
  let focused: HTMLElement | null = null;
  const pointer = matchMedia('(hover: hover) and (pointer: fine)');

  /** Says what pressing the button will do: its mark and its name. */
  const say = (playing: boolean): void => {
    button.replaceChildren(playing ? marks.pause : marks.play, name);
    name.textContent = cardPauseWords(playing);
  };

  /** What decides whether a card may play, as the page is now. */
  const read = (card: HTMLElement, at: number): PlayCard => {
    const image = card.querySelector<HTMLImageElement>('.frame img');
    return {
      id: String(at),
      hasLoop: card.dataset['loop'] !== undefined && !failed.has(card),
      arrived: image !== null && image.complete && image.naturalWidth > 0,
      flipped: card.hasAttribute('data-flipped'),
      frame: frameBox(card),
    };
  };

  /** Takes the loop and the button down: the card's still is what is left. */
  const takeDown = (): void => {
    if (video !== null) {
      video.pause();
      video.removeAttribute('src');
      video.load();
      video.remove();
      video = null;
    }
    place.remove();
    shown = null;
  };

  /** Gives up on a card whose loop would not load or play. */
  const giveUp = (card: HTMLElement): void => {
    failed.add(card);
    if (shown === card) takeDown();
    schedule();
  };

  /** Makes the card's loop over its picture and plays it. */
  const begin = (card: HTMLElement): void => {
    const address = card.dataset['loop'];
    const picture = card.querySelector('.frame');
    if (address === undefined || picture === null) return;
    const made = document.createElement('video');
    made.className = 'card-loop';
    made.muted = true;
    made.loop = true;
    made.playsInline = true;
    made.setAttribute('aria-hidden', 'true');
    const still = picture.querySelector('img');
    if (still !== null && still.currentSrc !== '')
      made.poster = still.currentSrc;
    // Only the loop that is current speaks: one taken down is done with.
    made.addEventListener('play', () => {
      if (video === made) say(true);
    });
    made.addEventListener('pause', () => {
      if (video === made) say(false);
    });
    made.addEventListener('error', () => {
      if (video === made) giveUp(card);
    });
    made.src = address;
    picture.append(made);
    video = made;
    say(true);
    // A refusal (autoplay policy, a codec) leaves the still. An abort is only a
    // pause pressed, or the loop taken down, while the play was starting.
    made.play().catch((error: unknown) => {
      if (
        video === made &&
        !(error instanceof DOMException && error.name === 'AbortError')
      )
        giveUp(card);
    });
  };

  /** Gives the button, and the loop unless they are held, to a card. */
  const takeOver = (card: HTMLElement): void => {
    takeDown();
    shown = card;
    // Less motion: each card's loop waits for its own press.
    if (start === 'offer') held = true;
    card.querySelector('.face.front')?.append(place);
    if (held) say(false);
    else begin(card);
  };

  /** Reads the page and does what the rule says, at `now` on the page's clock. */
  const check = (now: number): void => {
    const window_ = windowNow();
    const read_ = cards.map(read);
    const hidden = document.visibilityState === 'hidden';
    const pointed = mouse ?? focused;
    const id = hidden
      ? null
      : inFocus(
          read_,
          window_,
          heroBox(),
          pointed === null ? null : String(cards.indexOf(pointed)),
          // A mouse names the card it means and no other plays; a touch
          // screen has no pointer, so the card in the window's middle does.
          !pointer.matches,
        );
    const want = id === null ? null : (cards[Number(id)] ?? null);
    // A card that may no longer play stops at once; one that still may waits
    // for the next to settle before it gives way.
    if (shown !== null) {
      const own = read_[cards.indexOf(shown)];
      if (want === null || own === undefined || !qualifies(own, window_))
        takeDown();
    }
    if (want === null || want === shown) {
      pending = null;
      return;
    }
    if (pending === null || pending.card !== want)
      pending = { card: want, since: now };
    if (settled(now - pending.since)) {
      pending = null;
      takeOver(want);
      return;
    }
    schedule();
  };

  /** Reads the page on the next frame, once however many things asked. */
  function schedule(): void {
    if (frame !== null) return;
    frame = requestAnimationFrame((now) => {
      frame = null;
      check(now);
    });
  }

  button.addEventListener('click', () => {
    if (shown === null) return;
    if (video === null) {
      held = false;
      begin(shown);
    } else if (video.paused) {
      held = false;
      const playing = video;
      const card = shown;
      playing.play().catch(() => {
        if (video === playing) giveUp(card);
      });
    } else {
      held = true;
      video.pause();
    }
  });

  // Only a mouse points: a touch screen's hover sticks after a tap, and the
  // card in the window's middle is the one in focus there.
  for (const card of cards) {
    card.addEventListener('pointerenter', (event) => {
      if (event.pointerType !== 'mouse' || !pointer.matches) return;
      mouse = card;
      schedule();
    });
    card.addEventListener('pointerleave', () => {
      if (mouse !== card) return;
      mouse = null;
      schedule();
    });
  }

  document.addEventListener('focusin', (event) => {
    focused =
      event.target instanceof Element
        ? event.target.closest<HTMLElement>('section.row li.card')
        : null;
    schedule();
  });
  document.addEventListener('focusout', () => {
    focused = null;
    schedule();
  });

  // A scroll of the page or of any strip: scroll does not bubble, so it is
  // heard on its way down.
  document.addEventListener('scroll', schedule, {
    capture: true,
    passive: true,
  });
  window.addEventListener('resize', schedule);
  // A picture arriving (load does not bubble either).
  document.addEventListener(
    'load',
    (event) => {
      if (event.target instanceof HTMLImageElement) schedule();
    },
    true,
  );
  // A flip and a hidden tab act at once: a hidden tab runs no frames.
  new MutationObserver(() => check(performance.now())).observe(
    document.querySelector('main') ?? document.body,
    { subtree: true, attributes: true, attributeFilter: ['data-flipped'] },
  );
  document.addEventListener('visibilitychange', () => check(performance.now()));

  schedule();
}
