import Header from "../components/Header";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { wlList } from "../services/auth";
import { useAuth } from "../context/AuthContext";

interface WatchlistItem {
    id: string;
    title: string;
    image?: string;
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

export default function Watchlist() {
    const { user } = useAuth();
    const [items, setItems] = useState<WatchlistItem[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        let mounted = true;
        async function load() {
            if (!user) return;

            try {
                setLoading(true);
                const r = await wlList();
                if (mounted) setItems(r);
            } catch (error) {
                console.error('Failed to load watchlist:', error);
            } finally {
                if (mounted) setLoading(false);
            }
        }
        load();
        return () => { mounted = false; };
    }, [user]);

    return (
        <div>
            <Header />
            <main className="container" style={{ padding: '24px 0 96px' }}>
                <h1 className="page-title">Deine Watchlist</h1>
                {!user ? (
                    <div className="empty">
                        <div className="empty__title">Bitte einloggen</div>
                        <div className="empty__text">Deine Watchlist ist an deinen Account gebunden.</div>
                        <Link to="/login" className="btn btn--primary" style={{ marginTop: 12 }}>Zum Login</Link>
                    </div>
                ) : loading ? (
                    <div className="empty">
                        <div className="empty__title">Lädt...</div>
                        <div className="empty__text">Deine Watchlist wird geladen und mit beliebten Anime gefüllt...</div>
                    </div>
                ) : items.length === 0 ? (
                    <div className="empty">
                        <div className="empty__title">Noch nichts gemerkt</div>
                        <div className="empty__text">Füge Serien/Filme über die Detailseite hinzu.</div>
                        <Link to="/" className="btn btn--primary" style={{ marginTop: 12 }}>Entdecken</Link>
                    </div>
                ) : (
                    <div className="grid">{items.map(i => (
                        <Link key={i.id} to={`/anime/${i.id}`} state={{ title: i.title, imageUrl: i.image || makePoster(i.title) }} className="media-card">
                            <img className="media-card__img" src={i.image || makePoster(i.title)} alt={i.title} />
                            <div className="media-card__title">{i.title}</div>
                        </Link>
                    ))}</div>
                )}
            </main>
        </div>
    );
}
