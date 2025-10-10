import { useState, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";

interface SearchResult {
    slug: string;
    canonicalTitle: string;
    source: 'db' | 'live';
    imageUrl?: string;
}

interface SearchBarProps {
    onSearchComplete?: (result: SearchResult) => void;
}

export default function SearchBar({ onSearchComplete }: SearchBarProps) {
    const [query, setQuery] = useState("");
    const [searching, setSearching] = useState(false);
    const [lastResult, setLastResult] = useState<SearchResult | null>(null);
    const navigate = useNavigate();
    const location = useLocation();

    const runSearch = useCallback(async () => {
        const q = query.trim();
        if (!q || searching) return;
        setSearching(true);
        try {
            const res = await fetch(`http://localhost:3001/api/search?q=${encodeURIComponent(q)}`);
            const json = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(json?.error?.message || "Keine Ergebnisse");
            
            const result: SearchResult = {
                slug: json.slug,
                canonicalTitle: json.canonicalTitle,
                source: json.source,
                imageUrl: json.imageUrl
            };
            
            setLastResult(result);
            onSearchComplete?.(result);
            
            const target = `/anime/${result.slug}`;
            if (location.pathname === target) {
                navigate(`${target}?t=${Date.now()}`, { replace: true });
            } else {
                navigate(target);
            }
            setQuery("");
        } catch (error) {
            setLastResult(null);
            // ignore; keep user on page
        } finally {
            setSearching(false);
        }
    }, [query, searching, navigate, location.pathname, onSearchComplete]);

    const getSourceBadge = () => {
        if (!lastResult) return null;
        
        const isLocal = lastResult.source === 'db';
        return (
            <div className={`search-source-badge ${isLocal ? 'local' : 'live'}`}>
                {isLocal ? '🗄️ Local (MongoDB)' : '🌐 Live (Aniworld)'}
            </div>
        );
    };

    return (
        <div className="search-container">
            <div className="header-search">
                <span className="header-search__icon">🔎</span>
                <input
                    className="header-search__input"
                    placeholder="Suche nach Anime..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") runSearch(); }}
                    disabled={searching}
                />
                {searching && <div className="search-loading">🔄</div>}
            </div>
            {lastResult && getSourceBadge()}
        </div>
    );
}