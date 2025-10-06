import * as cheerio from "cheerio";
import { normalizeTitle, slugify } from "../utils/normalize";
import type { AnimeDTO } from "@aniworld/shared";

export type SearchResult = {
  topTitle?: string;
  topHref?: string; // e.g., /anime/stream/<slug>
};

export function parseSearch(html: string): SearchResult {
  const $ = cheerio.load(html);
  // Assume first result link is within a result list; adapt as per provided HTML
  const first = $("a[href^='/anime/stream/']").first();
  const topHref = first.attr("href") || undefined;
  const topTitle = first.text().trim() || undefined;
  return { topTitle, topHref };
}

export type AnimePartial = Omit<AnimeDTO,
  "slug" | "lastCrawledAt" | "sourceUrl"> & { sourceUrl?: string };

export function parseDetail(html: string): AnimePartial {
  const $ = cheerio.load(html);

  const title = $(".series-title h1 span").first().text().trim();
  const descEl = $("p.seri_des").first();
  const description = (descEl.attr("data-full-description") || descEl.text() || "").trim();

  const imgEl = $(".seriesCoverBox img").first();
  let imageUrl = (imgEl.attr("data-src") || imgEl.attr("src") || "").trim() || null;
  // Normalize relative URLs to absolute for validation
  if (imageUrl && imageUrl.startsWith("/")) {
    imageUrl = `https://aniworld.to${imageUrl}`;
  }

  const startRaw = $(".series-title small [itemprop='startDate']").first().attr("content")
    || $(".series-title small [itemprop='startDate']").first().text();
  const endRaw = $(".series-title small [itemprop='endDate']").first().attr("content")
    || $(".series-title small [itemprop='endDate']").first().text();

  const toYear = (v?: string | null) => {
    if (!v) return null;
    const t = v.toLowerCase().trim();
    if (!t || t === "heute" || t === "today") return null;
    const n = Number(t.slice(0, 4));
    return Number.isFinite(n) ? n : null;
  };

  const yearStart = toYear(startRaw || undefined);
  const yearEnd = toYear(endRaw || undefined);

  const genres = $(".genres ul li a.genreButton").map((_, el) => $(el).text().trim()).get();

  // Optional episodes (best-effort)
  const episodes = $("table.seasonEpisodesList tbody tr").map((_, tr) => {
    const row = $(tr);
    const idText = row.find(".season1EpisodeID a").text().trim();
    const number = Number((idText.match(/\d+/) || [])[0]);
    const titleText = row.find(".seasonEpisodeTitle a strong, .seasonEpisodeTitle a span").first().text().trim();
    const languages = row.find("td.editFunctions img.flag[title]").map((_, img) => $(img).attr("title") || "").get().filter(Boolean);
    return { number, title: titleText || undefined, languages: languages.length ? languages : undefined };
  }).get().filter((e) => Number.isFinite(e.number));

  const canonicalTitle = title || "";

  return {
    canonicalTitle,
    altTitles: [],
    description,
    imageUrl,
    yearStart,
    yearEnd,
    genres,
    cast: [],
    producers: [],
    episodes: episodes.length ? episodes : undefined,
  };
}

export function deriveSlugAndSourceUrl(fromTitle: string, href?: string): { slug: string; sourceUrl: string } {
  if (href && href.startsWith("/anime/stream/")) {
    const slug = href.replace("/anime/stream/", "").replace(/\/$/, "");
    return { slug, sourceUrl: href };
  }
  const slug = slugify(fromTitle);
  return { slug, sourceUrl: `/anime/stream/${slug}` };
}
