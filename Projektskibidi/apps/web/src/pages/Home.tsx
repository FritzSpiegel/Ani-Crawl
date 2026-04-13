import Header from "../components/Header";
import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";

interface Anime {
    id: number | string;
    slug?: string;
    title: string;
    img?: string;
}

function slugify(value: string) {
    return value
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, "")
        .trim()
        .replace(/\s+/g, "-");
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

function normalizeAnime(a: Anime): Anime {
    const slug = a.slug || slugify(a.title);
    return {
        ...a,
        slug,
        img: a.img && a.img.trim().length > 0 ? a.img : makePoster(a.title),
    };
}

// Popular anime queries to crawl from AniWorld
const POPULAR_ANIME_QUERIES = [
    "Attack on Titan", "One Piece", "Naruto", "Dragon Ball", "Demon Slayer",
    "My Hero Academia", "Death Note", "Fullmetal Alchemist", "Bleach", "Hunter x Hunter",
    "Tokyo Ghoul", "Sword Art Online", "Fairy Tail", "Black Clover", "Jujutsu Kaisen",
    "Chainsaw Man", "Spy x Family", "Mob Psycho 100", "One Punch Man", "Re:Zero",
    "Konosuba", "Overlord", "The Rising of the Shield Hero", "That Time I Got Reincarnated as a Slime",
    "Dr. Stone", "Fire Force", "The Promised Neverland", "Vinland Saga", "Beastars",
    "Your Name", "Spirited Away", "Princess Mononoke", "Howl's Moving Castle", "Grave of the Fireflies"
];

const FALLBACK_ANIME: Anime[] = POPULAR_ANIME_QUERIES.map((title, idx) => ({
    id: `fallback-${idx + 1}`,
    slug: slugify(title),
    title,
    img: makePoster(title),
}));

function getFallbackSlice(offset: number, count: number): Anime[] {
    const out: Anime[] = [];
    for (let i = 0; i < count; i += 1) {
        const item = FALLBACK_ANIME[(offset + i) % FALLBACK_ANIME.length];
        out.push({
            id: `${item.id}-${offset + i}`,
            slug: item.slug,
            title: item.title,
            img: item.img,
        });
    }
    return out;
}

async function fetchMoreAnime(offset: number, count: number): Promise<Anime[]> {
    try {
        // Prefer DB-backed list for scale
        const listRes = await fetch(`/api/anime?skip=${offset}&limit=${count}`);
        if (listRes.ok) {
            const json = await listRes.json();
            const items = ((json.items || []) as Anime[]).map(normalizeAnime);
            if (items.length >= count) return items;
            return [...items, ...getFallbackSlice(offset + items.length, count - items.length)];
        }
        // Fallback: use popular queries (older path)
        const queries = POPULAR_ANIME_QUERIES.slice(offset, offset + count);
        const animePromises = queries.map(async (query, index) => ({
            id: offset + index + 1,
            slug: query.toLowerCase().replace(/\s+/g, '-'),
            title: query,
            img: makePoster(query)
        }));
        return (await Promise.all(animePromises)).map(normalizeAnime);
    } catch (error) {
        console.error('Failed to fetch anime:', error);
        return getFallbackSlice(offset, count).map(normalizeAnime);
    }
}

export default function Home() {
    const [items, setItems] = useState<Anime[]>([]);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(false);
    const [pageSize] = useState(48);
    const [recs, setRecs] = useState<Anime[]>([]);
    const { user, isAdmin } = useAuth();

    useEffect(() => {
        const onScroll = () => {
            if (loading) return;
            if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 300)
                setPage(p => p + 1);
        };
        window.addEventListener("scroll", onScroll);
        return () => window.removeEventListener("scroll", onScroll);
    }, [loading]);

    useEffect(() => {
        if (page <= 1) return;
        let cancelled = false;
        setLoading(true);
        const offset = (page - 1) * pageSize;

        fetchMoreAnime(offset, pageSize)
            .then(newItems => {
                if (!cancelled) {
                    setItems(prev => [...prev, ...newItems]);
                }
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [page, pageSize]);

    // Load initial recommendations and anime
    useEffect(() => {
        let mounted = true;
        (async () => {
            try {
                // Load recommendations
                const recResponse = await fetch('/api/recommendations');
                if (recResponse.ok) {
                    const recommendations: Anime[] = await recResponse.json();
                    const normalized = recommendations.map(normalizeAnime);
                    if (mounted) {
                        setRecs(normalized.length > 0 ? normalized : getFallbackSlice(0, 6).map(normalizeAnime));
                    }
                } else {
                    if (mounted) setRecs(getFallbackSlice(0, 6).map(normalizeAnime));
                }

                // Load initial anime list (bigger batch for long scroll)
                const initialAnime = await fetchMoreAnime(0, pageSize);
                if (mounted) setItems(initialAnime);
            } catch (error) {
                console.error('Failed to fetch data:', error);
                if (mounted) {
                    const recsFallback = getFallbackSlice(0, 6).map(normalizeAnime);
                    setRecs(recsFallback);
                    setItems(getFallbackSlice(0, pageSize).map(normalizeAnime));
                }
            }
        })();
        return () => { mounted = false; };
    }, []);

    return (
        <div>
            <Header />

            {/* Admin Dashboard Button */}
            {user && isAdmin && (
                <div style={{ padding: "16px", textAlign: "center", backgroundColor: "#f5f5f5", borderBottom: "1px solid #ddd" }}>
                    <Link
                        to="/admin"
                        style={{
                            backgroundColor: "#ff6b6b",
                            color: "white",
                            padding: "12px 24px",
                            borderRadius: "8px",
                            textDecoration: "none",
                            fontWeight: "bold",
                            display: "inline-block"
                        }}
                    >
                        🔧 Admin Dashboard
                    </Link>
                </div>
            )}

            {/* Schwärzlers Empfehlungen */}
            <section className="section">
                <div className="container">
                    <h2 className="headline-recs">Schwärzlers Empfehlungen</h2>
                    <div className="recs-grid">
                        {(() => {
                            const slots = recs.slice(0, 6);
                            const [ra, rb, rc, rd, re, rf] = slots;
                            return (
                                <>
                                    {ra && (
                                        <Link to={`/anime/${ra.slug || ra.id}`} state={{ title: ra.title, imageUrl: ra.img }} className="recs-card recs-a">
                                            {ra.img && <img className="recs-card__img" src={ra.img} alt={ra.title} />}
                                            <div className="recs-card__title">{ra.title}</div>
                                        </Link>
                                    )}
                                    {rd && (
                                        <Link to={`/anime/${rd.slug || rd.id}`} state={{ title: rd.title, imageUrl: rd.img }} className="recs-card recs-d">
                                            {rd.img && <img className="recs-card__img" src={rd.img} alt={rd.title} />}
                                            <div className="recs-card__title">{rd.title}</div>
                                        </Link>
                                    )}
                                    {rb && (
                                        <Link to={`/anime/${rb.slug || rb.id}`} state={{ title: rb.title, imageUrl: rb.img }} className="recs-card recs-b">
                                            {rb.img && <img className="recs-card__img" src={rb.img} alt={rb.title} />}
                                            <div className="recs-card__title recs-card__title--big">{rb.title}</div>
                                        </Link>
                                    )}
                                    {rc && (
                                        <Link to={`/anime/${rc.slug || rc.id}`} state={{ title: rc.title, imageUrl: rc.img }} className="recs-card recs-c">
                                            {rc.img && <img className="recs-card__img" src={rc.img} alt={rc.title} />}
                                            <div className="recs-card__title">{rc.title}</div>
                                        </Link>
                                    )}
                                    {re && (
                                        <Link to={`/anime/${re.slug || re.id}`} state={{ title: re.title, imageUrl: re.img }} className="recs-card recs-e">
                                            {re.img && <img className="recs-card__img" src={re.img} alt={re.title} />}
                                            <div className="recs-card__title">{re.title}</div>
                                        </Link>
                                    )}
                                    {rf && (
                                        <Link to={`/anime/${rf.slug || rf.id}`} state={{ title: rf.title, imageUrl: rf.img }} className="recs-card recs-f">
                                            {rf.img && <img className="recs-card__img" src={rf.img} alt={rf.title} />}
                                            <div className="recs-card__title">{rf.title}</div>
                                        </Link>
                                    )}
                                </>
                            );
                        })()}
                    </div>
                </div>
            </section>

            <main className="container" style={{ padding: "24px 0 96px" }}>
                <h3 className="section-title">Alle Titel</h3>
                <div className="grid">
                    {items.map(a => (
                        <Link key={a.id} to={`/anime/${a.slug || a.id}`} state={{ title: a.title, imageUrl: a.img }} className="media-card">
                            {a.img && <img className="media-card__img" src={a.img} alt={a.title} />}
                            <div className="media-card__title">{a.title}</div>
                        </Link>
                    ))}
                </div>
                {loading && (
                    <div style={{ textAlign: "center", padding: "20px", color: "#9fb0d0" }}>
                        Lädt weitere Anime...
                    </div>
                )}
            </main>
        </div>
    );
}
