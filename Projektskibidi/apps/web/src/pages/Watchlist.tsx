import Header from "../components/Header.jsx";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { wlList } from "../services/auth";
import { useAuth } from "../context/AuthContext";

interface WatchlistItem {
    id: string;
    title: string;
    image?: string;
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
                {loading ? (
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
                        <Link key={i.id} to={`/anime/${i.id}`} className="media-card">
                            <img className="media-card__img" src={i.image} alt={i.title} />
                            <div className="media-card__title">{i.title}</div>
                        </Link>
                    ))}</div>
                )}
            </main>
        </div>
    );
}
