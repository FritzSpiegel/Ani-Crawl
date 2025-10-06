import Header from "../components/Header.jsx";
import { useParams } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { wlAdd, wlContains, wlRemove } from "../services/auth.js";
import { useAuth } from "../context/AuthContext.jsx";

function useAnime(id) {
    return useMemo(() => ({
        id, title: "One Piece", yearStart: 1999, yearEnd: "Heute",
        poster: "https://picsum.photos/seed/onepieceposter/640/900",
        overview: "Reichtum, Macht und Ruhm … (Dummy).",
        crew: { regie: "Kōnosuke Uda …", cast: "Mayumi Tanaka …", production: "Toei Animation …", country: "Japan" },
        tags: ["Fighting - Shounen", "Abenteuer", "Action", "Drama", "EngSub", "GerDub"]
    }), [id]);
}

export default function Details() {
    const { id } = useParams();
    const anime = useAnime(id);
    const [expanded, setExpanded] = useState(false);
    const text = anime.overview.length > 260 && !expanded ? anime.overview.slice(0, 260) + "…" : anime.overview;
    const { user } = useAuth();
    const [inList, setInList] = useState(false);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        let mounted = true;
        async function load() { try { if (user) { const exists = await wlContains(id); if (mounted) setInList(exists); } } catch {}
        }
        load();
        return () => { mounted = false; };
    }, [id, user]);

    async function toggleWatchlist() {
        if (!user || busy) return;
        setBusy(true);
        try {
            if (inList) { await wlRemove(id); setInList(false); }
            else { await wlAdd({ id, title: anime.title, img: anime.poster }); setInList(true); }
        } finally { setBusy(false); }
    }

    return (
        <div>
            <Header />
            <main className="container" style={{ padding: "28px 0 96px" }}>
                <div className="details">
                    <div className="details__poster"><img src={anime.poster} alt="" /></div>
                    <div className="details__info">
                        <h1 className="details__title">{anime.title} ({anime.yearStart} - {anime.yearEnd})</h1>
                        <p className="details__overview">
                            {text} {anime.overview.length > 260 && <button className="link-more" onClick={() => setExpanded(v => !v)}>{expanded ? "weniger anzeigen" : "mehr anzeigen"}</button>}
                        </p>
                        <div className="details__meta">
                            <div><span className="meta-label">Regisseure:</span> {anime.crew.regie}</div>
                            <div><span className="meta-label">Schauspieler:</span> {anime.crew.cast}</div>
                            <div><span className="meta-label">Produzent:</span> {anime.crew.production}</div>
                            <div><span className="meta-label">Land:</span> {anime.crew.country}</div>
                        </div>
                        <div className="tag-list">{anime.tags.map(t => <span key={t} className="tag-chip">{t}</span>)}</div>
                        <div className="cta-row">
                            <button className="btn btn--primary" onClick={toggleWatchlist} disabled={!user || busy}>{inList ? "Von Watchlist entfernen" : "Zur Watchlist hinzufügen"}</button>
                            <button className="btn">Watch Now</button>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
