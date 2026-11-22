// Brings in the pictures of the late rows (every row after the second; see
// Row.astro). Their addresses are in data- attributes, which a browser does
// not fetch, so that nothing below the first screen costs the page its weight
// budget. When a row comes within MARGIN of the window this moves each of its
// pictures' addresses into srcset and src, which is what makes the browser
// fetch them, and stops watching that row. It watches the row and not each
// picture: a strip clips sideways, and a row's pictures should arrive
// together. Where the browser has no IntersectionObserver, and when the page
// is about to be printed, every late picture is brought in at once. It builds
// no markup from a string, since the content policy refuses that, and it
// keeps nothing that grows. Without it a late row would show only its panel
// colour where the pictures should be, and the alt words would never be set;
// with script off the <noscript> beside each picture is the whole of it.

/**
 * How far below the window a row may be, in pixels, and still be loaded. The
 * pictures are fetched a moment before they are seen, so a reader scrolling at
 * a walk does not meet an empty frame, but it must stay small: at a desk's
 * width (1440x1000) the first late row starts about 1550px down, and the
 * window plus this has to stay short of that, or the pictures are fetched
 * without a scroll, which is what put the page over its budget.
 */
const MARGIN = 300;

/** Moves one row's pictures' addresses to where a browser fetches from. */
function bringIn(row: Element): void {
  for (const source of row.querySelectorAll<HTMLSourceElement>(
    'source[data-srcset]',
  )) {
    source.srcset = source.dataset['srcset'] ?? '';
    delete source.dataset['srcset'];
  }
  for (const image of row.querySelectorAll<HTMLImageElement>('img[data-src]')) {
    // The source's srcset first, then the img's, then its src: the img is
    // what starts the fetch, and it should find the sources already set.
    image.srcset = image.dataset['srcset'] ?? '';
    image.src = image.dataset['src'] ?? '';
    image.alt = image.dataset['alt'] ?? '';
    delete image.dataset['srcset'];
    delete image.dataset['src'];
    delete image.dataset['alt'];
  }
}

const rows = [...document.querySelectorAll('section.row[data-late]')];

function bringInAll(): void {
  for (const row of rows) bringIn(row);
}

if (typeof IntersectionObserver === 'undefined') {
  bringInAll();
} else {
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        bringIn(entry.target);
        observer.unobserve(entry.target);
      }
    },
    { rootMargin: `0px 0px ${MARGIN}px 0px` },
  );
  for (const row of rows) observer.observe(row);
}

// A printed page has no scrolling to wait for.
window.addEventListener('beforeprint', bringInAll);
