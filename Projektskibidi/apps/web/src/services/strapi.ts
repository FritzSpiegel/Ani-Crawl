/**
 * Strapi CMS client for the frontend.
 *
 * Used for direct read-only queries to Strapi (genres list, anime browsing).
 * Write operations and auth still go through the Express backend at /api.
 */

const STRAPI_BASE = "/strapi"; // proxied by Vite → http://localhost:1337/api

export interface StrapiAnime {
    id: number;
    slug: string;
    canonicalTitle: string;
    description: string;
    imageUrl: string | null;
    yearStart: number | null;
    yearEnd: number | null;
    genres: { id: number; name: string; slug: string }[];
    episodes: { number: number; title?: string; languages?: string[] }[];
    cast: string[];
    producers: string[];
    sourceUrl: string;
    lastCrawledAt: string;
    isFeatured: boolean;
    cover?: { url: string } | null;
}

export interface StrapiGenre {
    id: number;
    name: string;
    slug: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resolveImageUrl(anime: any): string | null {
    if (anime.cover?.url) {
        return anime.cover.url.startsWith("http")
            ? anime.cover.url
            : anime.cover.url; // Vite proxies /uploads to Strapi
    }
    return anime.imageUrl ?? null;
}

function mapAnime(raw: any): StrapiAnime {
    return {
        id: raw.id,
        slug: raw.slug ?? "",
        canonicalTitle: raw.canonicalTitle ?? "",
        description: raw.description ?? "",
        imageUrl: resolveImageUrl(raw),
        yearStart: raw.yearStart ?? null,
        yearEnd: raw.yearEnd ?? null,
        genres: (raw.genres ?? []).map((g: any) => ({
            id: g.id,
            name: g.name,
            slug: g.slug,
        })),
        episodes: (raw.episodes ?? []).map((e: any) => ({
            number: e.number,
            title: e.title ?? undefined,
            languages: e.languages ?? [],
        })),
        cast: raw.cast ?? [],
        producers: raw.producers ?? [],
        sourceUrl: raw.sourceUrl ?? "",
        lastCrawledAt: raw.lastCrawledAt ?? "",
        isFeatured: raw.isFeatured ?? false,
        cover: raw.cover ?? null,
    };
}

async function strapiGet(path: string, params?: Record<string, string>) {
    const url = new URL(`${window.location.origin}${STRAPI_BASE}${path}`);
    if (params) {
        Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    }
    const res = await fetch(url.toString());
    if (!res.ok) throw new Error(`Strapi: ${res.status}`);
    return res.json();
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** List all genres */
export async function listGenres(): Promise<StrapiGenre[]> {
    const json = await strapiGet("/genres", {
        "pagination[pageSize]": "200",
        sort: "name:asc",
    });
    return (json.data ?? []).map((g: any) => ({
        id: g.id,
        name: g.name,
        slug: g.slug,
    }));
}

/** Browse anime by genre (direct Strapi query) */
export async function browseAnimeByGenre(
    genreSlug: string,
    page = 1,
    pageSize = 25,
): Promise<{ items: StrapiAnime[]; meta: any }> {
    const json = await strapiGet("/animes", {
        "filters[genres][slug][$eq]": genreSlug,
        "populate[genres]": "true",
        "populate[episodes]": "true",
        "populate[cover]": "true",
        "pagination[page]": String(page),
        "pagination[pageSize]": String(pageSize),
        sort: "canonicalTitle:asc",
    });
    return {
        items: (json.data ?? []).map(mapAnime),
        meta: json.meta ?? {},
    };
}

/** Get a single anime by slug (direct Strapi read) */
export async function getAnimeBySlug(
    slug: string,
): Promise<StrapiAnime | null> {
    const json = await strapiGet("/animes", {
        "filters[slug][$eq]": slug,
        "populate[genres]": "true",
        "populate[episodes]": "true",
        "populate[cover]": "true",
    });
    const items = json.data ?? [];
    return items.length > 0 ? mapAnime(items[0]) : null;
}

/** List featured / recommended anime */
export async function getFeaturedAnime(
    limit = 6,
): Promise<StrapiAnime[]> {
    const json = await strapiGet("/animes", {
        "filters[isFeatured][$eq]": "true",
        "populate[genres]": "true",
        "populate[cover]": "true",
        "pagination[pageSize]": String(limit),
        sort: "updatedAt:desc",
    });
    return (json.data ?? []).map(mapAnime);
}
