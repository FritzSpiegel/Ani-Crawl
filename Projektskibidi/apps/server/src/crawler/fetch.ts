import axios from "axios";
import fs from "node:fs/promises";
import { env } from "../env";

const http = axios.create({
  timeout: 10000,
  headers: { "User-Agent": "aniworld-scraper/1.0 (+github example)" },
});

async function withRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const delay = 250 * Math.pow(2, i);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastErr;
}

export async function loadSearchHtml(query: string, fetchLive?: boolean): Promise<string> {
  if (!fetchLive && !env.allowLiveFetch) {
    return await fs.readFile(env.staticSearchHtmlPath, "utf-8");
  }
  // AniWorld search results are populated via client-side AJAX.
  // To get results server-side, query the same AJAX endpoint directly and synthesize minimal HTML
  // that our existing parser can understand.
  const ajaxUrl = "https://aniworld.to/ajax/search";
  return withRetry(async () => {
    try {
      const body = new URLSearchParams({ keyword: query });
      const resp = await http.post(ajaxUrl, body, {
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          referer: "https://aniworld.to/search",
        },
      });
      const items = Array.isArray(resp.data) ? resp.data : [];
      if (items.length > 0) {
        const html = `\n<ul class="searchResults">${items
          .map((it: any) => {
            const link = typeof it?.link === "string" ? it.link : "";
            const title = typeof it?.title === "string" ? it.title : "";
            return `<li><a href="${link}">${title}</a></li>`;
          })
          .join("")}</ul>`;
        return html;
      }
      // Fallback to static page if AJAX returns nothing
    } catch {
      // ignore and fallback below
    }
    const url = `https://aniworld.to/search?q=${encodeURIComponent(query)}`;
    return (await http.get(url)).data as string;
  });
}

export async function loadDetailHtml(href: string, fetchLive?: boolean): Promise<string> {
  if (!fetchLive && !env.allowLiveFetch) {
    return await fs.readFile(env.staticDetailHtmlPath, "utf-8");
  }
  const base = "https://aniworld.to";
  const url = href.startsWith("http") ? href : `${base}${href}`;
  return withRetry(async () => (await http.get(url)).data as string);
}
