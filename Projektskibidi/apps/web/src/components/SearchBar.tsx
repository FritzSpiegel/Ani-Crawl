import { useState, useCallback, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";

interface SearchResult {
    slug: string;
    canonicalTitle: string;
    source: 'db' | 'live';
    imageUrl?: string;
}

interface AutocompleteItem {
    slug: string;
    canonicalTitle: string;
    imageUrl?: string;
}

interface SearchBarProps {
    onSearchComplete?: (result: SearchResult) => void;
}

export default function SearchBar({ onSearchComplete }: SearchBarProps) {
    const [query, setQuery] = useState("");
    const [searching, setSearching] = useState(false);
    const [lastResult, setLastResult] = useState<SearchResult | null>(null);
    const [suggestions, setSuggestions] = useState<AutocompleteItem[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(-1);
    const navigate = useNavigate();
    const location = useLocation();
    const searchRef = useRef<HTMLDivElement>(null);
    const debounceRef = useRef<NodeJS.Timeout>();

    // Fetch autocomplete suggestions
    const fetchSuggestions = useCallback(async (searchQuery: string) => {
        if (searchQuery.length < 2) {
            setSuggestions([]);
            setShowSuggestions(false);
            return;
        }

        try {
            const res = await fetch(`/api/search/suggestions?q=${encodeURIComponent(searchQuery)}`);
            if (res.ok) {
                const data = await res.json();
                setSuggestions(data.suggestions || []);
                setShowSuggestions(true);
                setSelectedIndex(-1);
            }
        } catch (error) {
            console.error('Failed to fetch suggestions:', error);
            setSuggestions([]);
            setShowSuggestions(false);
        }
    }, []);

    // Debounced search for suggestions
    useEffect(() => {
        if (debounceRef.current) {
            clearTimeout(debounceRef.current);
        }
        
        debounceRef.current = setTimeout(() => {
            fetchSuggestions(query);
        }, 300);

        return () => {
            if (debounceRef.current) {
                clearTimeout(debounceRef.current);
            }
        };
    }, [query, fetchSuggestions]);

    const runSearch = useCallback(async (searchQuery?: string) => {
        const q = (searchQuery || query).trim();
        if (!q || searching) return;
        
        setSearching(true);
        setShowSuggestions(false);
        setSuggestions([]);
        
        try {
            const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&fetchLive=true`);
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

    // Handle keyboard navigation
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (!showSuggestions || suggestions.length === 0) {
            if (e.key === "Enter") {
                runSearch();
            }
            return;
        }

        switch (e.key) {
            case "ArrowDown":
                e.preventDefault();
                setSelectedIndex(prev => 
                    prev < suggestions.length - 1 ? prev + 1 : prev
                );
                break;
            case "ArrowUp":
                e.preventDefault();
                setSelectedIndex(prev => prev > 0 ? prev - 1 : -1);
                break;
            case "Enter":
                e.preventDefault();
                if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
                    const selectedSuggestion = suggestions[selectedIndex];
                    runSearch(selectedSuggestion.canonicalTitle);
                } else {
                    runSearch();
                }
                break;
            case "Escape":
                setShowSuggestions(false);
                setSelectedIndex(-1);
                break;
        }
    };

    // Handle clicking outside to close suggestions
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
                setShowSuggestions(false);
                setSelectedIndex(-1);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

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
        <div className="search-container" ref={searchRef}>
            <div className="header-search">
                <span className="header-search__icon">🔎</span>
                <input
                    className="header-search__input"
                    placeholder="Suche nach Anime..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={searching}
                    autoComplete="off"
                />
                {searching && <div className="search-loading">🔄</div>}
            </div>
            
            {/* Autocomplete Dropdown */}
            {showSuggestions && suggestions.length > 0 && (
                <div className="search-suggestions">
                    {suggestions.map((suggestion, index) => (
                        <div
                            key={suggestion.slug}
                            className={`search-suggestion ${index === selectedIndex ? 'selected' : ''}`}
                            onClick={() => runSearch(suggestion.canonicalTitle)}
                        >
                            {suggestion.imageUrl && (
                                <img 
                                    src={suggestion.imageUrl} 
                                    alt={suggestion.canonicalTitle}
                                    className="search-suggestion__image"
                                />
                            )}
                            <span className="search-suggestion__title">
                                {suggestion.canonicalTitle}
                            </span>
                        </div>
                    ))}
                </div>
            )}
            
            {lastResult && getSourceBadge()}
        </div>
    );
}