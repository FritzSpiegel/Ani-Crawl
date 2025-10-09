import { Link, NavLink, useNavigate, useLocation } from "react-router-dom";
import { useState, useCallback } from "react";
import { useAuth } from "../context/AuthContext.jsx";

export default function Header() {
    const { user, isAdmin, logout } = useAuth();
    const [query, setQuery] = useState("");
    const [searching, setSearching] = useState(false);
    const navigate = useNavigate();
    const location = useLocation();

    const runSearch = useCallback(async () => {
        const q = query.trim();
        if (!q || searching) return;
        setSearching(true);
        try {
            const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
            const json = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(json?.error?.message || "Keine Ergebnisse");
            const slug = json?.slug;
            if (slug) {
                const target = `/anime/${slug}`;
                if (location.pathname === target) {
                    navigate(`${target}?t=${Date.now()}`, { replace: true });
                } else {
                    navigate(target);
                }
                setQuery("");
            }
        } catch {
            // ignore; keep user on page
        } finally {
            setSearching(false);
        }
    }, [query, searching, navigate, location.pathname]);
    return (
        <header className="site-header">
            <div className="container header-bar">
                <Link to="/" className="brand">
                    <span className="brand__box">ANI</span>
                    <span className="brand__text">CRAWL</span>
                </Link>

                <div className="header-search">
                    <span className="header-search__icon">🔎</span>
                    <input
                        className="header-search__input"
                        placeholder="Suche"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") runSearch(); }}
                    />
                </div>

                <nav className="header-nav">
                    <NavLink to="/" className={({ isActive }) => `nav-link ${isActive ? "is-active" : ""}`}>★ Empfehlungen</NavLink>
                    <NavLink to="/watchlist" className={({ isActive }) => `nav-link ${isActive ? "is-active" : ""}`}>🗂️ WatchList</NavLink>
                    {!user ? (
                        <>
                            <NavLink to="/login" className={({ isActive }) => `nav-link ${isActive ? "is-active" : ""}`}>Login</NavLink>
                            <Link to="/register" className="btn btn--primary">Registrieren</Link>
                        </>
                    ) : (
                        <>
                            <div className="nav-link" style={{ background: '#1b2437', cursor: 'default' }}>Hallo {user.firstName}</div>
                            <button className="btn" onClick={logout}>Logout</button>
                        </>
                    )}
                </nav>
            </div>
        </header>
    );
}
