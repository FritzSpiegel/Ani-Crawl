import React from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { z } from "zod";

const EpisodeSchema = z.object({ number: z.number(), title: z.string().optional(), languages: z.array(z.string()).optional() });
const AnimeSchema = z.object({
  slug: z.string(),
  canonicalTitle: z.string(),
  altTitles: z.array(z.string()),
  description: z.string(),
  imageUrl: z.string().nullable(),
  yearStart: z.number().nullable(),
  yearEnd: z.number().nullable(),
  genres: z.array(z.string()),
  cast: z.array(z.string()),
  producers: z.array(z.string()),
  episodes: z.array(EpisodeSchema).optional(),
  sourceUrl: z.string(),
  lastCrawledAt: z.string(),
  // origin of data: "db" | "live"
  source: z.enum(["db", "live"]).optional(),
});

type Anime = z.infer<typeof AnimeSchema>;

function useSearch() {
  const [query, setQuery] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [data, setData] = React.useState<Anime | null>(null);

  const run = async () => {
    if (!query.trim()) return;
    setLoading(true); setError(null); setData(null);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || "Request failed");
      const parsed = AnimeSchema.parse(json);
      setData(parsed);
    } catch (e: any) {
      setError(e.message || "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  return { query, setQuery, loading, error, data, run };
}

function Card({ anime }: { anime: Anime }) {
  return (
    <div className="max-w-2xl w-full mx-auto bg-white shadow rounded p-4 space-y-3">
      <div className="flex gap-4">
        {anime.imageUrl && <img src={anime.imageUrl} alt="cover" className="w-28 h-40 object-cover rounded" />}
        <div className="flex-1">
          <h2 className="text-xl font-semibold">{anime.canonicalTitle}</h2>
          <div className="text-sm text-gray-600">{anime.yearStart ?? "?"} – {anime.yearEnd ?? "?"}</div>
          {!!anime.genres?.length && (
            <div className="mt-1 flex flex-wrap gap-1 text-xs text-blue-700">
              {anime.genres.map((g) => <span key={g} className="bg-blue-50 px-2 py-0.5 rounded">{g}</span>)}
            </div>
          )}
        </div>
      </div>
      <p className="line-clamp-6 text-sm text-gray-800">{anime.description}</p>
      <div className="text-xs text-gray-500">
        Quelle: {anime.sourceUrl} — {new Date(anime.lastCrawledAt).toLocaleString()}
        {anime.source && (
          <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded bg-gray-100 text-gray-700">
            Herkunft: {anime.source === "db" ? "MongoDB" : "AniWorld (live)"}
          </span>
        )}
      </div>
    </div>
  );
}

function SearchPage() {
  const { query, setQuery, loading, error, data, run } = useSearch();
  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-4">AniWorld Suche</h1>
        <div className="flex gap-2 mb-4">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") run(); }}
            className="flex-1 border rounded px-3 py-2"
            placeholder="Anime suchen..."
          />
          <button onClick={run} className="px-4 py-2 bg-blue-600 text-white rounded">Suchen</button>
        </div>
        {loading && <div>Suche...</div>}
        {error && <div className="text-red-600">{error}</div>}
        {!loading && !error && !data && <div className="text-gray-600">Nichts gefunden</div>}
        {data && <Card anime={data} />}
      </div>
    </div>
  );
}

const root = createRoot(document.getElementById("root")!);
root.render(<SearchPage />);
