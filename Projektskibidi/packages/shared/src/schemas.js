import { z } from "zod";
export const EpisodeSchema = z.object({
    number: z.number().int().nonnegative(),
    title: z.string().optional(),
    languages: z.array(z.string()).optional(),
});
export const GenreSchema = z.object({
    id: z.number().int(),
    name: z.string().min(1),
    slug: z.string().min(1),
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
export const StrapiAnimeSchema = AnimeSchema.omit({ genres: true }).extend({
    id: z.number().int(),
    genres: z.array(GenreSchema).default([]),
    isFeatured: z.boolean().default(false),
    normalizedTitle: z.string().default(""),
});
export const AnimeListItemSchema = z.object({
    id: z.union([z.number(), z.string()]),
    slug: z.string(),
    title: z.string(),
    img: z.string(),
});
