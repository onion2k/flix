// What the reader has asked the browser for, read where the page's loops need
// it: less motion, and data spared. The hero's loop and the cards' both start by
// heroStart() in src/catalogue/hero.ts from these, and they are read here once
// so that the two cannot read them differently: without it a change to how
// Save-Data is found (the API is Chromium's alone, and may move) could be made
// for one loop and not the other, and a reader who asked to spare data would
// be sent the other loop.

/** Whether the reader asked for less motion. */
export function lessMotion(): boolean {
  return matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Whether the reader asked for the data to be spared. */
export function savesData(): boolean {
  const connection = (
    navigator as Navigator & { connection?: { saveData?: boolean } }
  ).connection;
  return connection?.saveData === true;
}
