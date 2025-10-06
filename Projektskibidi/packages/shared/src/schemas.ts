import { z } from "zod";

export const EpisodeSchema = z.object({
  number: z.number().int().nonnegative(),
  title: z.string().optional(),
  languages: z.array(z.string()).optional(),
});

export const AnimeSchema = z.object({
  slug: z.string().min(1),
  canonicalTitle: z.string().min(1),
  altTitles: z.array(z.string()).default([]),
  description: z.string().default(""),
  imageUrl: z.string().url().nullable().optional().transform((v) => v ?? null),
  yearStart: z.number().int().nullable().optional().transform((v) => v ?? null),
  yearEnd: z.number().int().nullable().optional().transform((v) => v ?? null),
  genres: z.array(z.string()).default([]),
  cast: z.array(z.string()).default([]),
  producers: z.array(z.string()).default([]),
  episodes: z.array(EpisodeSchema).optional(),
  sourceUrl: z.string().min(1),
  lastCrawledAt: z.string().datetime(),
});

export type AnimeDTOSchema = z.infer<typeof AnimeSchema>;
