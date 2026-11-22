// What an entry and the rows file may say, and nothing more. Each is parsed
// from unknown and refused by name, so that a mistyped field or a bad address
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
 * The strict shape of the rows file. A row's id is its anchor in the page's
 * address, so it is held to what is safe in one, and, once published, is
 * given out and kept.
 */
export const rowsShape = z.strictObject({
  feature: z.string().min(1),
  rows: z
    .array(
      z.strictObject({
        id: z.string().regex(/^[a-z0-9-]+$/, {
          error: 'a row id is lower-case letters, digits and hyphens',
        }),
        title: z.string().min(1),
        entries: z.array(z.string().min(1)).min(1),
      }),
    )
    .min(1),
});

export type RowsFile = z.infer<typeof rowsShape>;
