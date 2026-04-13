/**
 * Public API routes – now backed by Strapi for all *content* data.
 *
 * - /search          → Strapi lookup, then live crawl → push to Strapi
 * - /anime/:slug     → Strapi lookup, then live crawl fallback
 * - /recommendations → Strapi curated list / featured flag
 * - /anime           → Paginated list from Strapi
 * - /search/suggestions → Fuzzy autocomplete from Strapi
 * - /auth/*          → Unchanged (still Express + MongoDB)
 */

import { Router } from "express";
import { z } from "zod";
import { normalizeTitle } from "../utils/normalize";
import { loadSearchHtml, loadDetailHtml } from "../crawler/fetch";
import {
  parseSearch,
  parseDetail,
  deriveSlugAndSourceUrl,
} from "../crawler/parser";
import { AnimeSchema } from "@aniworld/shared";
import { authRouter } from "./auth";
import {
  findAnimeBySlug,
  findAnimeByNormalizedTitle,
  searchAnimeByTitle,
  searchAnimeFuzzy,
  upsertAnime,
  getRecommendations,
  listAnime,
  StrapiAnime,
} from "../services/strapi";

const router = Router();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SearchQuery = z.object({
  q: z.string().min(1),
  fetchLive: z.coerce.boolean().optional(),
});

const POPULAR_ANIME_QUERIES = [
  "Attack on Titan", "One Piece", "Naruto", "Dragon Ball", "Demon Slayer",
  "My Hero Academia", "Death Note", "Fullmetal Alchemist", "Bleach", "Hunter x Hunter",
  "Tokyo Ghoul", "Sword Art Online", "Fairy Tail", "Black Clover", "Jujutsu Kaisen",
  "Chainsaw Man", "Spy x Family", "Mob Psycho 100", "One Punch Man", "Re:Zero",
  "Konosuba", "Overlord", "The Rising of the Shield Hero", "That Time I Got Reincarnated as a Slime",
  "Dr. Stone", "Fire Force", "The Promised Neverland", "Vinland Saga", "Beastars",
  "Your Name", "Spirited Away", "Princess Mononoke", "Howl's Moving Castle", "Grave of the Fireflies",
];

/** Convert a StrapiAnime into the public DTO the frontend expects */
function toDto(anime: StrapiAnime, source: "db" | "live" = "db") {
  return {
    slug: anime.slug,
    canonicalTitle: anime.canonicalTitle,
    altTitles: anime.altTitles,
    description: anime.description,
    imageUrl: anime.imageUrl,
    yearStart: anime.yearStart,
    yearEnd: anime.yearEnd,
    genres: anime.genres.map((g) => g.name),
    cast: anime.cast,
    producers: anime.producers,
    episodes: anime.episodes,
    sourceUrl: anime.sourceUrl,
    lastCrawledAt: anime.lastCrawledAt,
    source,
  };
}

/** Crawl an anime from AniWorld, upsert into Strapi, return DTO */
async function crawlAndUpsert(query: string) {
  const searchHtml = await loadSearchHtml(query, true);
  const { topTitle, topHref } = parseSearch(searchHtml);
  if (!topTitle || !topHref) return null;

  const detailHtml = await loadDetailHtml(topHref, true);
  const partial = parseDetail(detailHtml);
  const { slug, sourceUrl } = deriveSlugAndSourceUrl(topTitle, topHref);

  const now = new Date().toISOString();

  const payload = {
    slug,
    canonicalTitle: partial.canonicalTitle || topTitle,
    altTitles: Array.from(
      new Set([...(partial.altTitles || []), topTitle]),
    ).filter(Boolean),
    normalizedTitle: normalizeTitle(partial.canonicalTitle || topTitle),
    description: partial.description ?? "",
    imageUrl: partial.imageUrl ?? null,
    yearStart: partial.yearStart ?? null,
    yearEnd: partial.yearEnd ?? null,
    genres: partial.genres ?? [],
    cast: partial.cast ?? [],
    producers: partial.producers ?? [],
    episodes: partial.episodes ?? [],
    sourceUrl,
    lastCrawledAt: now,
  };

  // Best effort: persist to Strapi, but never fail crawl response if Strapi is down.
  try {
    return await upsertAnime(payload);
  } catch {
    return {
      id: -1,
      slug: payload.slug,
      canonicalTitle: payload.canonicalTitle,
      altTitles: payload.altTitles,
      normalizedTitle: payload.normalizedTitle,
      description: payload.description,
      imageUrl: payload.imageUrl,
      yearStart: payload.yearStart,
      yearEnd: payload.yearEnd,
      genres: payload.genres.map((name) => ({ id: 0, name, slug: normalizeTitle(name).replace(/\s+/g, "-") })),
      cast: payload.cast,
      producers: payload.producers,
      episodes: payload.episodes,
      sourceUrl: payload.sourceUrl,
      lastCrawledAt: payload.lastCrawledAt,
      isFeatured: false,
    } as StrapiAnime;
  }
}

// ---------------------------------------------------------------------------
// GET /search
// ---------------------------------------------------------------------------

router.get("/search", async (req, res) => {
  const parsed = SearchQuery.safeParse(req.query);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: { code: "VALIDATION_FAILED", message: "Invalid query" } });
  }

  const { q } = parsed.data;
  const normalized = normalizeTitle(q);

  // 1/2. Strapi cache lookups (best effort)
  try {
    let hit = await findAnimeByNormalizedTitle(normalized);
    if (hit) return res.json(toDto(hit));

    hit = await searchAnimeByTitle(normalized);
    if (hit) return res.json(toDto(hit));
  } catch {
    // Strapi unavailable -> continue with live crawl fallback
  }

  // 3. Live crawl → Strapi upsert
  try {
    const anime = await crawlAndUpsert(q);
    if (!anime) {
      return res
        .status(404)
        .json({ error: { code: "NOT_FOUND", message: "No results in search" } });
    }

    const dto = toDto(anime, "live");
    const validated = AnimeSchema.parse(dto);
    return res.json({ ...validated, source: "live" });
  } catch (err: any) {
    return res
      .status(500)
      .json({ error: { code: "CRAWL_FAILED", message: err?.message || "Crawl failed" } });
  }
});

// ---------------------------------------------------------------------------
// GET /search/suggestions  (autocomplete)
// ---------------------------------------------------------------------------

router.get("/search/suggestions", async (req, res) => {
  const q = String(req.query.q ?? "").trim();
  if (q.length < 2) return res.json({ suggestions: [] });

  try {
    const results = await searchAnimeFuzzy(q, 8);
    return res.json({
      suggestions: results.map((a) => ({
        slug: a.slug,
        canonicalTitle: a.canonicalTitle,
        imageUrl: a.imageUrl,
      })),
    });
  } catch {
    // Fallback: crawl one result and return it as a single suggestion
    try {
      const anime = await crawlAndUpsert(q);
      if (!anime) return res.json({ suggestions: [] });
      return res.json({
        suggestions: [{
          slug: anime.slug,
          canonicalTitle: anime.canonicalTitle,
          imageUrl: anime.imageUrl,
        }],
      });
    } catch {
      return res.json({ suggestions: [] });
    }
  }
});

// ---------------------------------------------------------------------------
// GET /anime  (paginated list)
// ---------------------------------------------------------------------------

router.get("/anime", async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 25));
  const skip = Number(req.query.skip) || 0;

  try {
    // If ?skip is used (legacy infinite-scroll), compute page
    const computedPage = skip > 0 ? Math.floor(skip / limit) + 1 : page;
    const strapiResult = await listAnime(computedPage, limit);
    const items = strapiResult.items;
    const meta = strapiResult.meta;

    const normalizedItems = items.map((a) => ({
      id: a.id,
      slug: a.slug,
      title: a.canonicalTitle,
      img: a.imageUrl ?? "",
    }));

    // If Strapi has too little content for requested page, live-crawl fallback batch.
    if (normalizedItems.length < limit) {
      const fallbackStart = skip;
      const fallbackQueries = POPULAR_ANIME_QUERIES.slice(
        fallbackStart,
        fallbackStart + (limit - normalizedItems.length),
      );

      const crawled = [] as Array<{ id: number | string; slug: string; title: string; img: string }>;
      for (const q of fallbackQueries) {
        try {
          const anime = await crawlAndUpsert(q);
          if (anime) {
            crawled.push({
              id: anime.id,
              slug: anime.slug,
              title: anime.canonicalTitle,
              img: anime.imageUrl ?? "",
            });
          }
        } catch {
          // best effort
        }
      }

      return res.json({
        items: [...normalizedItems, ...crawled],
        meta,
      });
    }

    return res.json({
      items: normalizedItems,
      meta,
    });
  } catch (err: any) {
    // Strapi list unavailable -> full live crawl fallback for this page slice.
    try {
      const fallbackQueries = POPULAR_ANIME_QUERIES.slice(skip, skip + limit);
      const crawled = [] as Array<{ id: number | string; slug: string; title: string; img: string }>;
      for (const q of fallbackQueries) {
        try {
          const anime = await crawlAndUpsert(q);
          if (anime) {
            crawled.push({
              id: anime.id,
              slug: anime.slug,
              title: anime.canonicalTitle,
              img: anime.imageUrl ?? "",
            });
          }
        } catch {
          // skip one title, continue
        }
      }
      return res.json({
        items: crawled,
        meta: { page, limit, total: crawled.length, totalPages: 1 },
      });
    } catch {
      return res
        .status(500)
        .json({ error: { code: "FETCH_FAILED", message: err?.message ?? "Failed" } });
    }
  }
});

// ---------------------------------------------------------------------------
// GET /anime/:slug
// ---------------------------------------------------------------------------

router.get("/anime/:slug", async (req, res) => {
  const slug = String(req.params.slug);

  try {
    let anime: StrapiAnime | null = null;
    try {
      anime = await findAnimeBySlug(slug);
    } catch {
      anime = null;
    }

    // Fallback: live crawl
    if (!anime) {
      try {
        const searchQuery = slug
          .replace(/-/g, " ")
          .replace(/\b\w/g, (l) => l.toUpperCase());
        anime = await crawlAndUpsert(searchQuery) ?? null;
      } catch (crawlErr) {
        console.error(`Failed to crawl anime for slug ${slug}:`, crawlErr);
      }
    }

    if (!anime) {
      return res
        .status(404)
        .json({ error: { code: "NOT_FOUND", message: "Anime not found" } });
    }

    return res.json(toDto(anime));
  } catch (err: any) {
    console.error(`Error fetching anime ${slug}:`, err);
    return res
      .status(500)
      .json({ error: { code: "FETCH_FAILED", message: err?.message ?? "Failed" } });
  }
});

// ---------------------------------------------------------------------------
// GET /recommendations
// ---------------------------------------------------------------------------

router.get("/recommendations", async (req, res) => {
  try {
    let recs: StrapiAnime[] = [];
    try {
      recs = await getRecommendations(6);
    } catch {
      recs = [];
    }

    if (recs.length > 0) {
      return res.json(
        recs.map((a) => ({
          id: a.id,
          slug: a.slug,
          title: a.canonicalTitle,
          img: a.imageUrl ?? "",
        })),
      );
    }

    // If Strapi has no content yet, crawl popular titles as seed
    const popularQueries = [
      "Attack on Titan",
      "One Piece",
      "Naruto",
      "Dragon Ball",
      "Demon Slayer",
      "My Hero Academia",
    ];

    const results: any[] = [];
    for (const q of popularQueries) {
      if (results.length >= 6) break;
      try {
        const anime = await crawlAndUpsert(q);
        if (anime) {
          results.push({
            id: anime.id,
            slug: anime.slug,
            title: anime.canonicalTitle,
            img: anime.imageUrl ?? "",
          });
        }
      } catch {
        // skip
      }
    }

    return res.json(results.slice(0, 6));
  } catch (err: any) {
    console.error("Recommendations error:", err);
    return res
      .status(500)
      .json({ error: { code: "FETCH_FAILED", message: err?.message ?? "Failed" } });
  }
});

// ---------------------------------------------------------------------------
// POST /reindex  (dev only)
// ---------------------------------------------------------------------------

router.post("/reindex", async (_req, res) => {
  if (process.env.NODE_ENV === "production") {
    return res
      .status(404)
      .json({ error: { code: "NOT_FOUND", message: "Not available" } });
  }
  // Not applicable with Strapi – content is always up to date
  return res.json({ ok: true, message: "Reindex is a no-op with Strapi CMS" });
});

// ---------------------------------------------------------------------------
// Auth sub-router (unchanged – still uses MongoDB)
// ---------------------------------------------------------------------------

router.use("/auth", authRouter);

export default router;
