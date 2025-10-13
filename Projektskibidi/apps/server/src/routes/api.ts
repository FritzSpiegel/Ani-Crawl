import { Router } from "express";
import { z } from "zod";
import { AnimeModel } from "../models/Anime";
import { normalizeTitle } from "../utils/normalize";
import { loadSearchHtml, loadDetailHtml } from "../crawler/fetch";
import { parseSearch, parseDetail, deriveSlugAndSourceUrl } from "../crawler/parser";
import { AnimeSchema } from "@aniworld/shared";

const router = Router();

const SearchQuery = z.object({ q: z.string().min(1), fetchLive: z.coerce.boolean().optional() });

router.get("/search", async (req, res) => {
  const parsed = SearchQuery.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: { code: "VALIDATION_FAILED", message: "Invalid query" } });
  }
  const { q, fetchLive } = parsed.data;
  const normalized = normalizeTitle(q);

  // Mongo-first fuzzy lookup
  const exact = await AnimeModel.findOne({ normalizedTitle: normalized }).lean();
  if (exact) {
    const dto = { ...exact, lastCrawledAt: exact.lastCrawledAt.toISOString() } as any;
    return res.json({ ...dto, source: "db" });
  }
  const prefixHit = await AnimeModel.findOne({ normalizedTitle: { $regex: `^${normalized}` } }).lean();
  if (prefixHit) {
    const dto = { ...prefixHit, lastCrawledAt: prefixHit.lastCrawledAt.toISOString() } as any;
    return res.json({ ...dto, source: "db" });
  }
  const aliasHit = await AnimeModel.findOne({ altTitles: { $elemMatch: { $regex: new RegExp(normalized.split(" ").join(".*"), "i") } } }).lean();
  if (aliasHit) {
    const dto = { ...aliasHit, lastCrawledAt: aliasHit.lastCrawledAt.toISOString() } as any;
    return res.json({ ...dto, source: "db" });
  }

  // Crawl from live search (force fetchLive=true to avoid static fixtures)
  try {
    const searchHtml = await loadSearchHtml(q, true); // Always use live fetch for searches
    const { topTitle, topHref } = parseSearch(searchHtml);
    if (!topTitle || !topHref) {
      return res.status(404).json({ error: { code: "NOT_FOUND", message: "No results in search" } });
    }
    const detailHtml = await loadDetailHtml(topHref, true); // Always use live fetch for details
    const partial = parseDetail(detailHtml);
    const { slug, sourceUrl } = deriveSlugAndSourceUrl(topTitle, topHref);

    const now = new Date();
    const doc = await AnimeModel.findOneAndUpdate(
      { slug },
      {
        $set: {
          slug,
          canonicalTitle: partial.canonicalTitle || topTitle,
          altTitles: Array.from(new Set([...(partial.altTitles || []), topTitle])).filter(Boolean),
          normalizedTitle: normalizeTitle(partial.canonicalTitle || topTitle),
          description: partial.description || "",
          imageUrl: partial.imageUrl || undefined,
          yearStart: partial.yearStart ?? undefined,
          yearEnd: partial.yearEnd ?? undefined,
          genres: partial.genres || [],
          cast: partial.cast || [],
          producers: partial.producers || [],
          episodes: partial.episodes || [],
          sourceUrl,
          lastCrawledAt: now,
        },
      },
      { upsert: true, new: true }
    ).lean();

    const dto = {
      slug: doc.slug,
      canonicalTitle: doc.canonicalTitle,
      altTitles: doc.altTitles,
      description: doc.description,
      imageUrl: doc.imageUrl ?? null,
      yearStart: doc.yearStart ?? null,
      yearEnd: doc.yearEnd ?? null,
      genres: doc.genres,
      cast: doc.cast,
      producers: doc.producers,
      episodes: doc.episodes,
      sourceUrl: doc.sourceUrl,
      lastCrawledAt: doc.lastCrawledAt.toISOString(),
    };

    const validated = AnimeSchema.parse(dto);
    return res.json({ ...validated, source: "live" });
  } catch (err: any) {
    return res.status(500).json({ error: { code: "CRAWL_FAILED", message: err?.message || "Crawl failed" } });
  }
});

router.get("/anime/:slug", async (req, res) => {
  const slug = String(req.params.slug);
  
  try {
    // First try to find by slug
    let doc = await AnimeModel.findOne({ slug }).lean();
    
    // If not found by slug, try by _id (for numeric IDs)
    if (!doc && /^[0-9a-fA-F]{24}$/.test(slug)) {
      doc = await AnimeModel.findById(slug).lean();
    }
    
    // If still not found, try to find by canonical title (for fallback cases)
    if (!doc) {
      doc = await AnimeModel.findOne({ 
        canonicalTitle: { $regex: new RegExp(slug.replace(/-/g, ' '), 'i') }
      }).lean();
    }
    
    // If still not found, try live crawl (similar to search)
    if (!doc) {
      try {
        // Convert slug back to a searchable title
        const searchQuery = slug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        const searchHtml = await loadSearchHtml(searchQuery, true);
        const { topTitle, topHref } = parseSearch(searchHtml);
        
        if (topTitle && topHref) {
          const detailHtml = await loadDetailHtml(topHref, true);
          const partial = parseDetail(detailHtml);
          const { slug: newSlug, sourceUrl } = deriveSlugAndSourceUrl(topTitle, topHref);

          const now = new Date();
          doc = await AnimeModel.findOneAndUpdate(
            { slug: newSlug },
            {
              $set: {
                slug: newSlug,
                canonicalTitle: partial.canonicalTitle || topTitle,
                altTitles: Array.from(new Set([...(partial.altTitles || []), topTitle])).filter(Boolean),
                normalizedTitle: normalizeTitle(partial.canonicalTitle || topTitle),
                description: partial.description || "",
                imageUrl: partial.imageUrl || undefined,
                yearStart: partial.yearStart ?? undefined,
                yearEnd: partial.yearEnd ?? undefined,
                genres: partial.genres || [],
                cast: partial.cast || [],
                producers: partial.producers || [],
                episodes: partial.episodes || [],
                sourceUrl,
                lastCrawledAt: now,
              },
            },
            { upsert: true, new: true }
          ).lean();
        }
      } catch (crawlErr) {
        console.error(`Failed to crawl anime for slug ${slug}:`, crawlErr);
      }
    }
    
    if (!doc) {
      return res.status(404).json({ error: { code: "NOT_FOUND", message: "Anime not found" } });
    }
    
    const dto = {
      slug: doc.slug,
      canonicalTitle: doc.canonicalTitle,
      altTitles: doc.altTitles,
      description: doc.description,
      imageUrl: doc.imageUrl ?? null,
      yearStart: doc.yearStart ?? null,
      yearEnd: doc.yearEnd ?? null,
      genres: doc.genres,
      cast: doc.cast,
      producers: doc.producers,
      episodes: doc.episodes,
      sourceUrl: doc.sourceUrl,
      lastCrawledAt: doc.lastCrawledAt.toISOString(),
    };
    return res.json(dto);
  } catch (err: any) {
    console.error(`Error fetching anime ${slug}:`, err);
    return res.status(500).json({ error: { code: "FETCH_FAILED", message: err?.message || "Failed to fetch anime" } });
  }
});

router.post("/reindex", async (req, res) => {
  if (process.env.NODE_ENV === "production") {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Not available" } });
  }
  // Simplified: accept body { slugs: string[] } and set lastCrawledAt now
  const body = (req.body as any) || {};
  const slugs: string[] = Array.isArray(body.slugs) ? body.slugs : [];
  await AnimeModel.updateMany({ slug: { $in: slugs } }, { $set: { lastCrawledAt: new Date() } });
  return res.json({ ok: true, count: slugs.length });
});

router.get("/recommendations", async (req, res) => {
  try {
    // First try to get recommendations from database
    const recommendations = await AnimeModel.aggregate([
      { $match: { imageUrl: { $exists: true, $ne: null, $ne: "" } } },
      { $sample: { size: 6 } },
      { $project: {
        slug: 1,
        canonicalTitle: 1,
        imageUrl: 1,
        _id: 1
      }}
    ]);

    // If we have enough recommendations from DB, return them
    if (recommendations.length >= 6) {
      const dto = recommendations.map(anime => ({
        id: anime._id.toString(),
        slug: anime.slug,
        title: anime.canonicalTitle,
        img: anime.imageUrl
      }));
      return res.json(dto);
    }

    // If we don't have enough data in DB, crawl some popular anime
    const popularAnimeQueries = [
      "Attack on Titan",
      "One Piece", 
      "Naruto",
      "Dragon Ball",
      "Demon Slayer",
      "My Hero Academia",
      "Death Note",
      "Fullmetal Alchemist"
    ];

    const crawledData = [];
    const needed = 6 - recommendations.length;
    
    for (let i = 0; i < Math.min(needed, popularAnimeQueries.length); i++) {
      try {
        const query = popularAnimeQueries[i];
        const normalized = normalizeTitle(query);
        
        // Check if we already have this one
        const existing = await AnimeModel.findOne({ normalizedTitle: normalized }).lean();
        if (existing) {
          crawledData.push({
            id: existing._id.toString(),
            slug: existing.slug,
            title: existing.canonicalTitle,
            img: existing.imageUrl || ""
          });
          continue;
        }

        // Crawl it live
        const searchHtml = await loadSearchHtml(query, true);
        const { topTitle, topHref } = parseSearch(searchHtml);
        
        if (topTitle && topHref) {
          const detailHtml = await loadDetailHtml(topHref, true);
          const partial = parseDetail(detailHtml);
          const { slug, sourceUrl } = deriveSlugAndSourceUrl(topTitle, topHref);

          const now = new Date();
          const doc = await AnimeModel.findOneAndUpdate(
            { slug },
            {
              $set: {
                slug,
                canonicalTitle: partial.canonicalTitle || topTitle,
                altTitles: Array.from(new Set([...(partial.altTitles || []), topTitle])).filter(Boolean),
                normalizedTitle: normalizeTitle(partial.canonicalTitle || topTitle),
                description: partial.description || "",
                imageUrl: partial.imageUrl || undefined,
                yearStart: partial.yearStart ?? undefined,
                yearEnd: partial.yearEnd ?? undefined,
                genres: partial.genres || [],
                cast: partial.cast || [],
                producers: partial.producers || [],
                episodes: partial.episodes || [],
                sourceUrl,
                lastCrawledAt: now,
              },
            },
            { upsert: true, new: true }
          ).lean();

          crawledData.push({
            id: doc._id.toString(),
            slug: doc.slug,
            title: doc.canonicalTitle,
            img: doc.imageUrl || ""
          });
        }
      } catch (err) {
        console.error(`Failed to crawl ${popularAnimeQueries[i]}:`, err);
        // Continue with next anime
      }
    }

    // Combine DB recommendations with newly crawled data
    const dbDto = recommendations.map(anime => ({
      id: anime._id.toString(),
      slug: anime.slug,
      title: anime.canonicalTitle,
      img: anime.imageUrl
    }));

    const combined = [...dbDto, ...crawledData].slice(0, 6);
    return res.json(combined);

  } catch (err: any) {
    console.error('Recommendations error:', err);
    return res.status(500).json({ error: { code: "FETCH_FAILED", message: err?.message || "Failed to fetch recommendations" } });
  }
});

export default router;
