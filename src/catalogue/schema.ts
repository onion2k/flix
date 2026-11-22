// What an entry and the catalogue file (src/content/catalogue.json, which says
// which sites are listed, in which rows and in what order) may say, and
// nothing more. Each is parsed from unknown and refused by name, so that a mistyped field or a bad address
// stops the build at the file that has it. Without it a catalogue with a typo
// would build, and the page would draw a card with a hole in it.
//
// The module takes its picture field as an argument and never learns what a
// picture is: at build it is Astro's image(), in a unit test a string.
import { z } from 'astro/zod';

/**
 * The strict shape of one entry. Strict, so that an unknown field is refused
 * and not quietly dropped: a field that is ignored is a field that looks as
 * though it works.
 */
export function entryShape<Picture extends z.ZodType>(picture: Picture) {
  return z.strictObject({
    title: z.string().min(1),
    kind: z.enum(['game', 'toy']),
    description: z.string().min(1),
    picture,
    pictureAlt: z.string().min(1),
    // A short silent recording of the game being played, a path to a .webm
    // file relative to this entry's own file, which the card plays when it
    // grows. Absent, the card grows with its picture. Only the kind of file is
    // held here, since the catalogue knows no file system; that the file is
    // there is checked by the build (src/build/loop-address.ts), naming the entry.
    loop: z
      .string()
      .regex(/\.webm$/, { error: 'a loop is a path to a .webm file' })
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
