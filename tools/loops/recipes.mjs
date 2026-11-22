// One recipe a game, all in one file because each is a few lines of plain data
// and the owner will want to read them side by side. Without a recipe the
// recorder would not know how to play a game, and a loop could not be made
// again after the game changes.
//
// A recipe is { url, steps } and, for a game that does not fill the window,
// { crop: [x, y, width, height] }, the 16:9 part of the window to keep (cut,
// never stretched). The recorder opens the url, waits for the page's
// load event, then does each step in order, in a 1280x720 window:
//
//   { wait: ms }                  stand still for a time
//   { waitFor: 'selector' }       wait until the element is on the page
//   { click: 'selector' }         click an element, or { click: [x, y] } a spot
//   { key: 'Space', hold: ms }    hold a key down for a time, then let go
//   { down: 'KeyW' } / { up: 'KeyW' }   hold a key across later steps
//   { press: 'Enter' }            tap a key
//   { drag: [[x, y], ...], ms }   press, move along the points, let go
//   { move: [[x, y], ...], ms }   move the pointer along the points, no button
//   { wheel: dy, at: [x, y] }     turn the mouse wheel over a spot (zoom)
//   { run: async (page, { sleep }) => {} }   a game's own logic, where it
//                                 must read the page to decide what to do
//   { eval: 'expression' }        run script in the page (a last resort)
//   { mark: seconds }             the loop starts here, plus that many seconds
//
// The loop is the six seconds from the mark. Everything before it (loading, a
// title, getting into play) is for the page's sake and is cut away, so each
// recipe plays on past the mark for at least six seconds.

// Book Worm's grid is random, so the player reads the tiles, finds words from
// a short list of common ones by walking from tile to adjacent tile, and drags
// across each as a person would. It stops at three words or when none is left.
const WORDS = (
  'able acid aged also area army away baby back ball band bank base bath bear beat been bell belt bend best bike bill bird blow blue boat body bold bone book boom born both bowl burn busy cake call calm came camp card care case cash cast cell chat chip city clay club coal coat code cold come cook cool cope copy core cost crew crop dark data date dawn days dead deal dear deep deer desk dial diet dirt dish disk door dose down draw drew drop drum dual duke dust duty each earn ease east easy edge else even ever evil exit face fact fail fair fall farm fast fate fear feed feel feet fell felt file fill film find fine fire firm fish five flat flow food foot ford form fort four free from fuel full fund gain game gate gave gear gift girl give glad goal goes gold golf gone good gray grew grow gulf hair half hall hand hang hard harm hate have head hear heat held hell help here hero high hill hire hold hole holy home hope horn host hour huge hung hunt hurt idea inch into iron item jack join jump jury just keen keep kept kick kill kind king knee knew know lack lady laid lake land lane last late lead left less life lift like line link list live load loan lock logo long look lord lose loss lost love luck made mail main make male many mark mass meal mean meat meet menu mere mile milk mill mind mine miss mode mood moon more most move much must name navy near neck need news next nice nine none nose note okay once only onto open oral over pace pack page paid pain pair palm park part pass past path peak pick pink pipe plan play plot plug plus poll pool poor port post pull pure push race rail rain rank rare rate read real rear rely rent rest rice rich ride ring rise risk road rock role roll roof room root rose rule rush safe said sake sale salt same sand save seat seed seek seem seen self sell send sent ship shop shot show shut sick side sign site size skin slip slow snow soft soil sold sole some song soon sort soul spot star stay stem step stop such suit sure take tale talk tall tank tape task team tech tell tend term test text than that them then they thin this thus till time tiny told toll tone took tool tour town tree trip true tune turn twin type unit upon used user vary vast very vice view vote wage wait wake walk wall want ward warm wash wave ways weak wear week well went were west what when whom wide wife wild will wind wine wing wire wise wish with wood word wore work yard yeah year your zero zone ' +
  'about above actor adult after again agree ahead alarm album alive allow alone along among angel anger angle apple apply arise aside asset avoid awake award aware badly basic beach began begin being below bench black blade blame blank blind block blood board boost bound brain brand bread break brick brief bring broad brown brush build bunch buyer cable carry catch cause chain chair chart chase cheap check chest chief child chose civil claim class clean clear click climb clock close cloud coach coast count court cover crack craft crash cream crime cross crowd crown curve daily dance death delay depth doubt dozen draft drama dream dress drink drive early earth eight elite empty enemy enjoy enter entry equal error event every exact exist extra faith false fault fiber field fifth fifty fight final first flash fleet floor focus force frame fresh front fruit funny giant given glass globe grace grade grain grand grant grass great green gross group grown guard guess guest guide happy heart heavy hence horse hotel house human ideal image index inner input issue joint judge known label large laser later laugh layer learn lease least leave level light limit local logic loose lower lucky lunch magic major maker march match maybe mayor meant media metal might minor minus mixed model money month moral motor mount mouse mouth movie music needs never newly night noise north novel nurse occur ocean offer often order other ought paint panel paper party peace phase phone photo piece pilot pitch place plain plane plant plate point pound power press price pride prime print prior prize proof proud prove queen quick quiet quite radio raise range rapid ratio reach ready refer right rival river robot rough round route royal rural scale scene scope score sense serve seven shall shape share sharp sheet shelf shell shift shirt shock shoot short shown sight since sixth sixty sized skill sleep slide small smart smile smoke solid solve sorry sound south space spare speak speed spend spent split sport staff stage stake stand start state steam steel stick still stock stone stood store storm story strip stuck study stuff style sugar suite super sweet table taken taste teach thank their theme there these thick thing think third those three threw throw tight times title today topic total touch tough tower track trade train treat trend trial tribe trick tried tries truck truly trust truth twice under union unity until upper upset urban usage usual valid value video virus visit vital voice waste watch water wheel where which while white whole whose woman world worry worse worst worth would wound write wrong wrote yield young youth'
).split(' ');

async function findWords(page, { sleep }) {
  const tiles = await page.evaluate(() =>
    [...document.querySelectorAll('.tile')].map((t) => {
      const b = t.getBoundingClientRect();
      return {
        r: Number(t.dataset.row),
        c: Number(t.dataset.col),
        ch: t.textContent.trim().toLowerCase(),
        x: b.x + b.width / 2,
        y: b.y + b.height / 2,
      };
    }),
  );
  const at = new Map(tiles.map((t) => [`${t.r},${t.c}`, t]));
  const walk = (word, tile, used) => {
    if (tile.ch !== word[used.length]) return null;
    const path = [...used, tile];
    if (path.length === word.length) return path;
    for (let dr = -1; dr <= 1; dr += 1) {
      for (let dc = -1; dc <= 1; dc += 1) {
        const next = at.get(`${tile.r + dr},${tile.c + dc}`);
        if ((dr || dc) && next && !path.includes(next)) {
          const found = walk(word, next, path);
          if (found) return found;
        }
      }
    }
    return null;
  };
  const found = [];
  for (const word of [...WORDS].sort((a, b) => b.length - a.length)) {
    for (const tile of tiles) {
      const path = tile.ch === word[0] ? walk(word, tile, []) : null;
      if (path) {
        found.push(path);
        break;
      }
    }
    if (found.length === 3) break;
  }
  if (!found.length) throw new Error('no word from the list is in this grid');
  for (const path of found) {
    await page.mouse.move(path[0].x, path[0].y);
    await page.mouse.down();
    for (const tile of path.slice(1)) {
      await page.mouse.move(tile.x, tile.y, { steps: 6 });
      await sleep(120);
    }
    await page.mouse.up();
    await sleep(900);
  }
}

// Waits until the page's visible words match, polling often because a dip in
// Nuclear Fishin' lasts less than a second. The words are read from the page's
// text, since the game draws its status line where a locator does not see it.
const waitForText = (pattern) => (page) =>
  page.waitForFunction(
    ([source, flags]) =>
      new RegExp(source, flags).test(document.body.innerText),
    [pattern.source, pattern.flags],
    { timeout: 60000, polling: 50 },
  );

export const recipes = {
  chopdrop: {
    url: 'https://copter.ooer.com/',
    steps: [
      { wait: 3000 },
      { click: [640, 360] },
      { mark: 0 },
      { key: 'Space', hold: 1200 },
      { down: 'KeyW' },
      { wait: 1500 },
      { key: 'KeyA', hold: 1300 },
      { wait: 1500 },
      { key: 'KeyD', hold: 1000 },
      { wait: 1500 },
      { up: 'KeyW' },
    ],
  },

  'nuclear-fishin': {
    url: 'https://fish.ooer.com',
    steps: [
      { wait: 9000 },
      { press: 'KeyC' },
      { wait: 2500 },
      // The cast is made before the loop, since a bite comes ten seconds or
      // so after it; the loop is the nibble, the dip, the strike and the reel.
      {
        drag: [
          [640, 380],
          [640, 560],
        ],
        ms: 900,
      },
      { run: waitForText(/nibble/) },
      { mark: 0 },
      { run: waitForText(/^!$/m) },
      { key: 'Space', hold: 150 },
      { key: 'Space', hold: 3500 },
    ],
  },
  aquaclysm: {
    url: 'https://aqua.ooer.com',
    // The game is drawn 16:9 inside the window with black around it.
    crop: [160, 90, 960, 540],
    steps: [
      // The level list takes a few seconds to answer a key, and a key pressed
      // too soon is lost, so it is given time.
      { wait: 12000 },
      { click: [440, 340] },
      { wait: 1200 },
      { press: 'Enter' },
      { wait: 3500 },
      { mark: 0 },
      { down: 'KeyD' },
      { key: 'Space', hold: 900 },
      { wait: 700 },
      { key: 'Space', hold: 900 },
      { wait: 700 },
      { key: 'Space', hold: 900 },
      { wait: 800 },
      { up: 'KeyD' },
    ],
  },
  coinpush: {
    url: 'https://onion2k.github.io/coinpush/',
    crop: [300, 200, 680, 383],
    steps: [
      { wait: 8000 },
      { mark: 0 },
      {
        move: [
          [560, 300],
          [720, 300],
        ],
        ms: 600,
      },
      { press: 'Space' },
      { wait: 500 },
      { press: 'Space' },
      { wait: 500 },
      {
        move: [
          [720, 300],
          [600, 300],
        ],
        ms: 600,
      },
      { press: 'Space' },
      { wait: 500 },
      { press: 'Space' },
      { wait: 500 },
      { press: 'Space' },
      { wait: 1500 },
    ],
  },
  coinpusher: {
    url: 'https://coins.ooer.com',
    crop: [380, 230, 520, 293],
    steps: [
      { wait: 8000 },
      { mark: 0 },
      { click: [560, 330] },
      { wait: 700 },
      { click: [680, 330] },
      { wait: 700 },
      { click: [620, 330] },
      { wait: 700 },
      { click: [740, 330] },
      { wait: 700 },
      { click: [600, 330] },
      { wait: 2000 },
    ],
  },
  'fruit-machine': {
    url: 'https://slots.ooer.com',
    crop: [220, 40, 840, 473],
    steps: [
      { wait: 8000 },
      { move: [[850, 490]], ms: 400 },
      { mark: 0 },
      { click: [850, 490] },
      { wait: 3800 },
      { click: [850, 490] },
      { wait: 3500 },
    ],
  },
  'tiny-slots': {
    url: 'https://tinyslots.ooer.com',
    crop: [400, 225, 880, 495],
    steps: [
      { wait: 9000 },
      { mark: 0 },
      { click: [1190, 658] },
      { wait: 3500 },
      { click: [1190, 658] },
      { wait: 3500 },
    ],
  },
  pushminer: {
    url: 'https://miner.ooer.com',
    steps: [
      { wait: 10000 },
      { press: 'KeyV' },
      { wait: 1000 },
      { down: 'KeyW' },
      { wait: 3500 },
      { mark: 0 },
      { down: 'KeyA' },
      { wait: 700 },
      { up: 'KeyA' },
      { wait: 2500 },
      { down: 'KeyA' },
      { wait: 500 },
      { up: 'KeyA' },
      { wait: 2500 },
      { up: 'KeyW' },
    ],
  },
  'codex-squadron': {
    url: 'https://shump.ooer.com',
    // The top 60 px is a debug read-out of the game's own counters.
    crop: [53, 60, 1173, 660],
    steps: [
      { wait: 6000 },
      { press: 'Enter' },
      { wait: 2000 },
      { mark: 0 },
      {
        move: [
          [640, 600],
          [400, 600],
          [900, 600],
          [640, 600],
        ],
        ms: 5500,
      },
    ],
  },

  ooergolf: {
    url: 'https://golf.ooer.com',
    steps: [
      { wait: 8000 },
      { click: 'text=Practise' },
      { wait: 5000 },
      { mark: 0 },
      {
        drag: [
          [640, 400],
          [640, 540],
        ],
        ms: 1300,
      },
      { wait: 5500 },
    ],
  },
  propshop: {
    url: 'https://propshop.ooer.com',
    steps: [
      { click: 'role=button[name="Start"]' },
      { wait: 1500 },
      { click: 'text=Free play' },
      { wait: 1000 },
      { click: 'text=Just play' },
      { click: 'text=skip to open' },
      { click: 'role=button[name="60×"]' },
      { click: 'role=button[name="Market"]' },
      { wait: 1500 },
      { mark: 0 },
      { wait: 6500 },
    ],
  },
  spiro: {
    url: 'https://spiro.ooer.com',
    // The curve, without the empty stage around it.
    crop: [380, 200, 520, 293],
    steps: [
      { wait: 6000 },
      { click: 'text=Minimize UI' },
      { wait: 1000 },
      { mark: 0 },
      {
        drag: [
          [640, 360],
          [720, 330],
        ],
        ms: 2500,
      },
      { wait: 4000 },
    ],
  },
  heist: {
    url: 'https://heist.ooer.com',
    steps: [
      { wait: 6000 },
      { mark: 0 },
      {
        drag: [
          [640, 360],
          [800, 380],
        ],
        ms: 1500,
      },
      { wait: 5000 },
    ],
  },
  'release-flow-model': {
    url: 'https://allaboard.ooer.com',
    steps: [
      { wait: 5000 },
      { click: 'role=button[name="Scenario"]' },
      { wait: 1500 },
      { mark: 0 },
      {
        drag: [
          [430, 177],
          [560, 177],
        ],
        ms: 1500,
      },
      { wait: 400 },
      {
        drag: [
          [718, 177],
          [850, 177],
        ],
        ms: 1500,
      },
      { wait: 400 },
      {
        drag: [
          [102, 263],
          [230, 263],
        ],
        ms: 1500,
      },
      { wait: 700 },
    ],
  },
  'petz-9000': {
    url: 'https://pet.ooer.com',
    // The pet is an egg until it has been looked after for a good while, and
    // an egg cannot be fed or played with, so what can honestly be done is
    // to turn the toy over in the hands, as the game allows.
    crop: [300, 10, 680, 383],
    steps: [
      { wait: 4000 },
      { press: 'KeyB' },
      { wait: 1500 },
      { mark: 0 },
      {
        drag: [
          [420, 300],
          [640, 330],
          [760, 300],
        ],
        ms: 2200,
      },
      { wait: 600 },
      {
        drag: [
          [760, 300],
          [500, 260],
          [380, 300],
        ],
        ms: 2200,
      },
      { wait: 800 },
    ],
  },
  chess: {
    url: 'https://onion2k.github.io/chess/',
    // The board, without the panel of options beside it.
    crop: [150, 190, 720, 405],
    steps: [
      { wait: 15000 },
      { move: [[537, 442]], ms: 300 },
      { mark: 0 },
      {
        drag: [
          [537, 442],
          [537, 392],
        ],
        ms: 900,
      },
      { wait: 2200 },
      {
        drag: [
          [657, 465],
          [592, 417],
        ],
        ms: 900,
      },
      { wait: 2500 },
    ],
  },
  'book-worm': {
    url: 'https://bookworm.ooer.com',
    crop: [220, 0, 840, 473],
    steps: [
      { wait: 4000 },
      { wheel: 160, at: [640, 400] },
      { wait: 800 },
      { mark: 0 },
      { run: findWords },
      { wait: 1500 },
    ],
  },
};
