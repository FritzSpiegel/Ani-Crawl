import Header from "../components/Header";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { wlAdd, wlContains, wlRemove } from "../services/auth";
import { useAuth } from "../context/AuthContext";

interface AnimeData {
    slug: string;
    canonicalTitle: string;
    description: string;
    imageUrl: string | null;
    yearStart: number | null;
    yearEnd: number | null;
    genres: string[];
}

function makePoster(title: string) {
    const safe = String(title || "Anime").replace(/[<>&"]/g, "");
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='600' height='900'>
<defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0%' stop-color='#1f3359'/><stop offset='100%' stop-color='#5b8cff'/></linearGradient></defs>
<rect width='100%' height='100%' fill='url(#g)'/>
<text x='50%' y='52%' dominant-baseline='middle' text-anchor='middle' fill='white' font-family='Segoe UI, Arial, sans-serif' font-size='42' font-weight='700'>${safe}</text>
</svg>`;
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export default function Details() {
    const { id: slug } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const location = useLocation();
    const navState = (location.state || {}) as { title?: string; imageUrl?: string };
    const { user } = useAuth();
    const [data, setData] = useState<AnimeData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [expanded, setExpanded] = useState(false);
    const [inList, setInList] = useState(false);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        if (!slug) return;

        let mounted = true;
        setLoading(true); setError(""); setData(null);
        (async () => {
            try {
                const res = await fetch(`/api/anime/${encodeURIComponent(slug)}`);

                // Check if response is actually JSON
                const contentType = res.headers.get('content-type');
                if (!contentType || !contentType.includes('application/json')) {
                    const text = await res.text();
                    console.error('Non-JSON response:', text);
                    throw new Error('Server returned non-JSON response. Check console for details.');
                }

                const json = await res.json();
                if (!res.ok) throw new Error(json?.error?.message || `HTTP ${res.status}: Laden fehlgeschlagen`);
                if (mounted) setData(json);
            } catch (e: any) {
                console.error('Details fetch error:', e);
                // If backend/source is unavailable (e.g. Forbidden from upstream crawl),
                // still show a usable details screen with tile data.
                if (mounted) {
                    if (navState?.title || navState?.imageUrl) {
                        setData({
                            slug: slug || "",
                            canonicalTitle: navState.title || "Anime",
                            description: "Dieser Titel ist aktuell nur lokal verfuegbar. Sobald API/CMS stabil laeuft, werden wieder alle Details geladen.",
                            imageUrl: navState.imageUrl || null,
                            yearStart: null,
                            yearEnd: null,
                            genres: [],
                        });
                        setError("");
                    } else {
                        setError(String(e?.message || e));
                    }
                }
            } finally {
                if (mounted) setLoading(false);
            }
        })();
        return () => { mounted = false; };
    }, [slug, navState?.title, navState?.imageUrl]);

    useEffect(() => {
        if (!slug) return;

        let mounted = true;
        (async () => {
            try {
                if (user && slug) {
                    const exists = await wlContains(slug);
                    if (mounted) setInList(exists);
                } else {
                    if (mounted) setInList(false);
                }
            } catch { }
        })();
        return () => { mounted = false; };
    }, [slug, user]);

    const title = data?.canonicalTitle || "";
    const poster = data?.imageUrl || makePoster(title || "Anime");
    const overview = data?.description || "";
    const yearStart = data?.yearStart ?? "";
    const yearEnd = data?.yearEnd ?? "Heute";
    const genres = Array.isArray(data?.genres) ? data.genres : [];
    const text = overview.length > 260 && !expanded ? overview.slice(0, 260) + "…" : overview;

    async function toggleWatchlist() {
        if (!slug || busy) return;
        if (!user) {
            navigate('/login');
            return;
        }
        setBusy(true);
        try {
            if (inList) { await wlRemove(slug); setInList(false); }
            else { await wlAdd({ id: slug, title, image: poster }); setInList(true); }
        } finally { setBusy(false); }
    }

    return (
        <div>
            <Header />
            <main className="container" style={{ padding: "28px 0 96px" }}>
                {loading ? (
                    <div>lädt …</div>
                ) : error ? (
                    <div style={{ color: "#f55" }}>{error}</div>
                ) : (
                    <div className="details">
                        <div className="details__poster"><img src={poster} alt={title || "Anime"} /></div>
                        <div className="details__info">
                            <h1 className="details__title">{title} ({yearStart} - {yearEnd || "Heute"})</h1>
                            <p className="details__overview">
                                {text} {overview.length > 260 && <button className="link-more" onClick={() => setExpanded(v => !v)}>{expanded ? "weniger anzeigen" : "mehr anzeigen"}</button>}
                            </p>
                            <div className="tag-list">{genres.map((t) => <span key={t} className="tag-chip">{t}</span>)}</div>
                            <div className="cta-row">
                                <button className="btn btn--primary" onClick={toggleWatchlist} disabled={busy}>{inList ? "Von Watchlist entfernen" : (user ? "Zur Watchlist hinzufügen" : "Login für Watchlist")}</button>
                                <button
                                    className="btn"
                                    onClick={() => navigate(`/watch/${slug}/1`)}
                                >
                                    Watch Now
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
