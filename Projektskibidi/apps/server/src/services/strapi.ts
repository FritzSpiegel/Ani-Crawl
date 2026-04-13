/**
 * Strapi CMS Service
 *
 * Centralised client that talks to Strapi's REST API.
 * Replaces direct Mongoose calls for all *content* data (Anime, Genre, …).
 * Auth / User / Watchlist stay in the Express app with their own MongoDB models.
 */

import axios, { AxiosInstance } from "axios";
import { logger } from "../logger";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const STRAPI_URL = process.env.STRAPI_URL || "http://localhost:1337";
const STRAPI_API_TOKEN = process.env.STRAPI_API_TOKEN || "";

const http: AxiosInstance = axios.create({
    baseURL: `${STRAPI_URL}/api`,
    timeout: 15_000,
    headers: {
        "Content-Type": "application/json",
        ...(STRAPI_API_TOKEN
            ? { Authorization: `Bearer ${STRAPI_API_TOKEN}` }
            : {}),
    },
});

// Log errors but don't throw raw Axios errors to callers
http.interceptors.response.use(
    (r) => r,
    (err) => {
        const msg =
            err.response?.data?.error?.message || err.message || "Strapi request failed";
        logger.error({ strapiError: msg, status: err.response?.status }, "Strapi API error");
        throw new Error(msg);
    },
);

// ---------------------------------------------------------------------------
// Helpers – Strapi v5 response shape: { data, meta }
// ---------------------------------------------------------------------------

/** Extract the flat attributes + id from a Strapi v5 entity object */
function flattenEntity(entity: any): any {
    if (!entity) return null;
    const { id, ...rest } = entity;
    // Strapi v5 puts attributes at the top level of data items
    return { id, ...rest };
}

function flattenList(response: any): { items: any[]; meta: any } {
    const data = Array.isArray(response.data) ? response.data : [];
    return {
        items: data.map(flattenEntity),
        meta: response.meta ?? {},
    };
}

// ---------------------------------------------------------------------------
// Anime
// ---------------------------------------------------------------------------

export interface StrapiAnime {
    id: number;
    slug: string;
    canonicalTitle: string;
    altTitles: string[];
    normalizedTitle: string;
    description: string;
    imageUrl: string | null;
    yearStart: number | null;
    yearEnd: number | null;
    genres: { id: number; name: string; slug: string }[];
    cast: string[];
    producers: string[];
    episodes: { number: number; title?: string; languages?: string[] }[];
    sourceUrl: string;
    lastCrawledAt: string;
    isFeatured: boolean;
}

/** Find anime by slug */
export async function findAnimeBySlug(slug: string): Promise<StrapiAnime | null> {
    const res = await http.get("/animes", {
        params: {
            "filters[slug][$eq]": slug,
            "populate[genres]": true,
            "populate[episodes]": true,
            "populate[cover]": true,
        },
    });
    const { items } = flattenList(res.data);
    return items.length > 0 ? mapAnime(items[0]) : null;
}

/** Find anime by normalizedTitle (exact) */
export async function findAnimeByNormalizedTitle(
    normalized: string,
): Promise<StrapiAnime | null> {
    const res = await http.get("/animes", {
        params: {
            "filters[normalizedTitle][$eq]": normalized,
            "populate[genres]": true,
            "populate[episodes]": true,
            "populate[cover]": true,
        },
    });
    const { items } = flattenList(res.data);
    return items.length > 0 ? mapAnime(items[0]) : null;
}

/** Prefix / contains search on normalizedTitle */
export async function searchAnimeByTitle(
    normalized: string,
): Promise<StrapiAnime | null> {
    const res = await http.get("/animes", {
        params: {
            "filters[normalizedTitle][$startsWith]": normalized,
            "populate[genres]": true,
            "populate[episodes]": true,
            "populate[cover]": true,
            "pagination[pageSize]": 1,
        },
    });
    const { items } = flattenList(res.data);
    return items.length > 0 ? mapAnime(items[0]) : null;
}

/** Full-text search across titles (used by autocomplete) */
export async function searchAnimeFuzzy(
    query: string,
    limit = 10,
): Promise<StrapiAnime[]> {
    const res = await http.get("/animes", {
        params: {
            "filters[$or][0][canonicalTitle][$containsi]": query,
            "filters[$or][1][normalizedTitle][$containsi]": query,
            "populate[genres]": true,
            "populate[episodes]": true,
            "populate[cover]": true,
            "pagination[pageSize]": limit,
        },
    });
    const { items } = flattenList(res.data);
    return items.map(mapAnime);
}

/** List anime with pagination (for home page grid) */
export async function listAnime(
    page = 1,
    pageSize = 25,
    sort = "createdAt:desc",
): Promise<{ items: StrapiAnime[]; meta: any }> {
    const res = await http.get("/animes", {
        params: {
            "populate[genres]": true,
            "populate[episodes]": true,
            "populate[cover]": true,
            "pagination[page]": page,
            "pagination[pageSize]": pageSize,
            sort,
        },
    });
    const { items, meta } = flattenList(res.data);
    return { items: items.map(mapAnime), meta };
}

/** Upsert anime – create or update by slug (used by crawler) */
export async function upsertAnime(data: {
    slug: string;
    canonicalTitle: string;
    altTitles?: string[];
    normalizedTitle: string;
    description?: string;
    imageUrl?: string | null;
    yearStart?: number | null;
    yearEnd?: number | null;
    genres?: string[];
    cast?: string[];
    producers?: string[];
    episodes?: { number: number; title?: string; languages?: string[] }[];
    sourceUrl: string;
    lastCrawledAt: string;
}): Promise<StrapiAnime> {
    // 1. Ensure genre records exist and collect their IDs
    const genreIds = await ensureGenres(data.genres ?? []);

    const payload: any = {
        canonicalTitle: data.canonicalTitle,
        slug: data.slug,
        altTitles: data.altTitles ?? [],
        normalizedTitle: data.normalizedTitle,
        description: data.description ?? "",
        imageUrl: data.imageUrl ?? null,
        yearStart: data.yearStart ?? null,
        yearEnd: data.yearEnd ?? null,
        cast: data.cast ?? [],
        producers: data.producers ?? [],
        episodes: (data.episodes ?? []).map((e) => ({
            number: e.number,
            title: e.title ?? null,
            languages: e.languages ?? [],
        })),
        sourceUrl: data.sourceUrl,
        lastCrawledAt: data.lastCrawledAt,
        genres: genreIds,
    };

    // 2. Check if slug already exists
    const existing = await findAnimeBySlug(data.slug);

    if (existing) {
        const res = await http.put(`/animes/${existing.id}`, { data: payload });
        return mapAnime(flattenEntity(res.data.data));
    }

    // 3. Create new
    const res = await http.post("/animes", { data: payload });
    return mapAnime(flattenEntity(res.data.data));
}

/** Get random featured / recommendation anime */
export async function getRecommendations(
    limit = 6,
): Promise<StrapiAnime[]> {
    // First try the curated "Recommendation" single type
    try {
        const res = await http.get("/recommendation", {
            params: {
                "populate[animes][populate][0]": "genres",
                "populate[animes][populate][1]": "episodes",
                "populate[animes][populate][2]": "cover",
            },
        });
        const rec = res.data?.data;
        if (rec?.animes && rec.animes.length > 0) {
            return rec.animes.slice(0, limit).map(mapAnime);
        }
    } catch {
        // single type may not exist yet — fall through
    }

    // Fallback: grab anime marked isFeatured, or just the latest
    const res = await http.get("/animes", {
        params: {
            "filters[isFeatured][$eq]": true,
            "populate[genres]": true,
            "populate[cover]": true,
            "pagination[pageSize]": limit,
            sort: "updatedAt:desc",
        },
    });
    const { items } = flattenList(res.data);
    if (items.length >= limit) return items.map(mapAnime);

    // Final fallback: just latest anime
    const res2 = await http.get("/animes", {
        params: {
            "populate[genres]": true,
            "populate[cover]": true,
            "pagination[pageSize]": limit,
            sort: "createdAt:desc",
        },
    });
    return flattenList(res2.data).items.map(mapAnime);
}

// ---------------------------------------------------------------------------
// Genres
// ---------------------------------------------------------------------------

/** Ensure genre records exist in Strapi; return their numeric IDs */
async function ensureGenres(names: string[]): Promise<number[]> {
    if (!names.length) return [];

    const ids: number[] = [];

    for (const name of names) {
        const trimmed = name.trim();
        if (!trimmed) continue;

        // Check if exists
        const res = await http.get("/genres", {
            params: { "filters[name][$eqi]": trimmed },
        });
        const existing = flattenList(res.data).items;
        if (existing.length > 0) {
            ids.push(existing[0].id);
            continue;
        }

        // Create
        const slug = trimmed.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
        const created = await http.post("/genres", {
            data: { name: trimmed, slug },
        });
        ids.push(created.data.data.id);
    }

    return ids;
}

/** List all genres */
export async function listGenres(): Promise<
    { id: number; name: string; slug: string }[]
> {
    const res = await http.get("/genres", {
        params: { "pagination[pageSize]": 200, sort: "name:asc" },
    });
    return flattenList(res.data).items.map((g: any) => ({
        id: g.id,
        name: g.name,
        slug: g.slug,
    }));
}

// ---------------------------------------------------------------------------
// Internal mapper
// ---------------------------------------------------------------------------

function mapAnime(raw: any): StrapiAnime {
    const genres = (raw.genres ?? []).map((g: any) => ({
        id: g.id,
        name: g.name,
        slug: g.slug,
    }));

    const episodes = (raw.episodes ?? []).map((e: any) => ({
        number: e.number,
        title: e.title ?? undefined,
        languages: e.languages ?? [],
    }));

    // Resolve cover image URL from Strapi media or fall back to imageUrl string
    let imageUrl = raw.imageUrl ?? null;
    if (raw.cover?.url) {
        imageUrl = raw.cover.url.startsWith("http")
            ? raw.cover.url
            : `${STRAPI_URL}${raw.cover.url}`;
    }

    return {
        id: raw.id,
        slug: raw.slug ?? "",
        canonicalTitle: raw.canonicalTitle ?? "",
        altTitles: raw.altTitles ?? [],
        normalizedTitle: raw.normalizedTitle ?? "",
        description: raw.description ?? "",
        imageUrl,
        yearStart: raw.yearStart ?? null,
        yearEnd: raw.yearEnd ?? null,
        genres,
        cast: raw.cast ?? [],
        producers: raw.producers ?? [],
        episodes,
        sourceUrl: raw.sourceUrl ?? "",
        lastCrawledAt: raw.lastCrawledAt ?? new Date().toISOString(),
        isFeatured: raw.isFeatured ?? false,
    };
}
