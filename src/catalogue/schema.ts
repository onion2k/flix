// What an entry and the catalogue file (src/content/catalogue.json, which says
// which sites are listed, in which rows and in what order) may say, and
// nothing more. Each is parsed from unknown and refused by name, so that a mistyped field or a bad address
// stops the build at the file that has it. Without it a catalogue with a typo
// would build, and the page would draw a card with a hole in it.
//
// The module takes its picture field as an argument and never learns what a
// picture is: at build it is Astro's image(), in a unit test a string.
import { z } from 'astro/zod';
import { NEEDS } from './fitting';
import { REQUIRES } from './webgpu';

/**
 * What a site is: one to play (a game), one to play with (a toy), or one to
 * use (a tool, which came with the subdomain sites on 2026-11-25). Its label
 * says it, in rows.ts.
 */
export const KINDS = ['game', 'toy', 'tool'] as const;
export type Kind = (typeof KINDS)[number];

/**
 * The strict shape of one entry. Strict, so that an unknown field is refused
 * and not quietly dropped: a field that is ignored is a field that looks as
 * though it works.
 */
export function entryShape<Picture extends z.ZodType>(picture: Picture) {
  return z.strictObject({
    title: z.string().min(1),
    kind: z.enum(KINDS),
    description: z.string().min(1),
    picture,
    pictureAlt: z.string().min(1),
    // A short silent recording of the game being played, a path to a .webm
    // file relative to this entry's own file, which the card will play when it
    // is the one most in view (part 4 of plans/cards.md; nothing plays it
    // now). Absent, the card keeps its picture. Only the kind of file is
    // held here, since the catalogue knows no file system; that the file is
    // there is checked by the build (src/build/loop-address.ts), naming the entry.
    loop: z
      .string()
      .regex(/\.webm$/, { error: 'a loop is a path to a .webm file' })
      .optional(),
    // The same recording at the size of the moving hero, 960 wide, for a site
    // that may be the day's feature: a path to a .webm file, as `loop` is,
    // and checked in the same two places. Absent, the hero shows its picture.
    heroLoop: z
      .string()
      .regex(/\.webm$/, { error: 'a heroLoop is a path to a .webm file' })
      .optional(),
    // What the site needs of a device that a phone may not have: any of a
    // keyboard, a mouse and a gamepad, each said once, and an empty list for
    // a site that plays by touch, mouse or keys alike. The card says it in
    // words before a visitor leaves (fitting.ts). Optional here, since a site
    // in the workshop has no address to be sent to; that a linked entry says
    // it is held by buildPage (rows.ts), which names the file and the id.
    needs: z
      .array(z.enum(NEEDS))
      .refine((list) => new Set(list).size === list.length, {
        error: 'a need is said once',
      })
      .optional(),
    // What the site requires of the browser that opens it (webgpu so far),
    // each said once. Optional: most sites require nothing. The page asks the
    // visitor's browser and the card says so where it lacks it (webgpu.ts).
    requires: z
      .array(z.enum(REQUIRES))
      .refine((list) => new Set(list).size === list.length, {
        error: 'a requirement is said once',
      })
      .optional(),
    // Only a secure address: a card links straight to the game, and a page
    // served over https must not send a visitor to one that is not.
    url: z
      .url({
        protocol: /^https$/,
        error: 'the url must be an address beginning https://',
      })
      .optional(),
  });
}

/**
 * The strict shape of the catalogue file. A row's id is its anchor in the page's
 * address, so it is held to what is safe in one, and, once published, is
 * given out and kept.
 */
export const catalogueShape = z.strictObject({
  feature: z.string().min(1),
  // More sites the feature may be, a day each in turn after `feature`. Absent
  // or empty, the page is built as it is without them.
  features: z.array(z.string().min(1)).optional(),
  // The best of the sites, whose cards shine like a foil trading card and say
  // so in their label, wherever a row draws them. Absent or empty, none does.
  best: z.array(z.string().min(1)).optional(),
  // The finish of the cards that are not best ones, each a list of the sites
  // whose cards wear it, wherever a row draws them: a decoration that says
  // nothing a reader needs, so no label changes. The keys are the three named
  // finishes and no other (a best card is holo and every other card reverse,
  // and neither is named here). Absent, empty or with a list left out, those
  // cards are reverse.
  finishes: z
    .strictObject({
      gold: z.array(z.string().min(1)).optional(),
      galaxy: z.array(z.string().min(1)).optional(),
      ice: z.array(z.string().min(1)).optional(),
    })
    .optional(),
  rows: z
    .array(
      z.strictObject({
        id: z.string().regex(/^[a-z0-9-]+$/, {
          error: 'a row id is lower-case letters, digits and hyphens',
        }),
        title: z.string().min(1),
        sites: z.array(z.string().min(1)).min(1),
      }),
    )
    .min(1),
});

export type CatalogueFile = z.infer<typeof catalogueShape>;
