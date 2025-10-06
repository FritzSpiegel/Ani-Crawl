import Header from "../components/Header.jsx";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { wlList } from "../services/auth.js";
import { useAuth } from "../context/AuthContext.jsx";

export default function Watchlist() {
    const { user } = useAuth();
    const [items, setItems] = useState([]);
    useEffect(() => {
        let mounted = true;
        async function load() {
            try { const r = await wlList(); if (mounted) setItems(r); } catch { /* ignore */ }
        }
        if (user) load();
        return () => { mounted = false; };
    }, [user]);
    return (
        <div>
            <Header />
            <main className="container" style={{ padding: '24px 0 96px' }}>
                <h1 className="page-title">Deine Watchlist</h1>
                {items.length === 0 ? (
                    <div className="empty">
                        <div className="empty__title">Noch nichts gemerkt</div>
                        <div className="empty__text">Füge Serien/Filme über die Detailseite hinzu.</div>
                        <Link to="/" className="btn btn--primary" style={{ marginTop: 12 }}>Entdecken</Link>
                    </div>
                ) : (
                    <div className="grid">{items.map(i => (
                        <div key={i.id} className="media-card">
                            <img className="media-card__img" src={i.image} alt={i.title} />
                            <div className="media-card__title">{i.title}</div>
                        </div>
                    ))}</div>
                )}
            </main>
        </div>
    );
}
