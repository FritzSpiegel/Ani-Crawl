import Header from "../components/Header";
import { useParams } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { wlAdd, wlContains, wlRemove } from "../services/auth";
import { useAuth } from "../context/AuthContext";

export default function Details() {
    const { id: slug } = useParams();
    const { user } = useAuth();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [expanded, setExpanded] = useState(false);
    const [inList, setInList] = useState(false);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        let mounted = true;
        setLoading(true); setError(""); setData(null);
        (async () => {
            try {
                const res = await fetch(`/api/anime/${encodeURIComponent(slug)}`);
                const json = await res.json();
                if (!res.ok) throw new Error(json?.error?.message || "Laden fehlgeschlagen");
                if (mounted) setData(json);
            } catch (e) {
                if (mounted) setError(String(e?.message || e));
            } finally {
                if (mounted) setLoading(false);
            }
        })();
        return () => { mounted = false; };
    }, [slug]);

    useEffect(() => {
        let mounted = true;
        (async () => {
            try {
                if (user && slug) {
                    const exists = await wlContains(slug);
                    if (mounted) setInList(exists);
                } else {
                    if (mounted) setInList(false);
                }
            } catch {}
        })();
        return () => { mounted = false; };
    }, [slug, user]);

    const title = data?.canonicalTitle || "";
    const poster = data?.imageUrl || "";
    const overview = data?.description || "";
    const yearStart = data?.yearStart ?? "";
    const yearEnd = data?.yearEnd ?? "Heute";
    const genres = Array.isArray(data?.genres) ? data.genres : [];
    const text = overview.length > 260 && !expanded ? overview.slice(0, 260) + "…" : overview;

    async function toggleWatchlist() {
        if (!user || busy) return;
        setBusy(true);
        try {
            if (inList) { await wlRemove(slug); setInList(false); }
            else { await wlAdd({ id: slug, title, img: poster }); setInList(true); }
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
                        <div className="details__poster">{poster && <img src={poster} alt="" />}</div>
                        <div className="details__info">
                            <h1 className="details__title">{title} ({yearStart} - {yearEnd || "Heute"})</h1>
                            <p className="details__overview">
                                {text} {overview.length > 260 && <button className="link-more" onClick={() => setExpanded(v => !v)}>{expanded ? "weniger anzeigen" : "mehr anzeigen"}</button>}
                            </p>
                            <div className="tag-list">{genres.map((t) => <span key={t} className="tag-chip">{t}</span>)}</div>
                            <div className="cta-row">
                                <button className="btn btn--primary" onClick={toggleWatchlist} disabled={!user || busy}>{inList ? "Von Watchlist entfernen" : "Zur Watchlist hinzufügen"}</button>
                                <button className="btn">Watch Now</button>
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
