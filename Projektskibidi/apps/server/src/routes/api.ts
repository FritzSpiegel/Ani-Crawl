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
  const doc = await AnimeModel.findOne({ slug }).lean();
  if (!doc) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Not found" } });
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

export default router;
