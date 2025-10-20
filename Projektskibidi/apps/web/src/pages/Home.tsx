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

async function fetchMoreAnime(offset: number, count: number): Promise<Anime[]> {
    try {
        // Prefer DB-backed list for scale
        const listRes = await fetch(`/api/anime?skip=${offset}&limit=${count}`);
        if (listRes.ok) {
            const json = await listRes.json();
            return (json.items || []) as Anime[];
        }
        // Fallback: use popular queries (older path)
        const queries = POPULAR_ANIME_QUERIES.slice(offset, offset + count);
        const animePromises = queries.map(async (query, index) => ({
            id: offset + index + 1,
            slug: query.toLowerCase().replace(/\s+/g, '-'),
            title: query,
            img: ""
        }));
        return await Promise.all(animePromises);
    } catch (error) {
        console.error('Failed to fetch anime:', error);
        // Fallback to mock data
        return Array.from({ length: count }, (_, i) => ({ 
            id: 100 + offset + i, 
            title: `Anime #${offset + i + 1}`, 
            img: "",
            slug: `anime-${offset + i + 1}`
        }));
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
            if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 300) 
                setPage(p => p + 1); 
        };
        window.addEventListener("scroll", onScroll); 
        return () => window.removeEventListener("scroll", onScroll);
    }, []);
    
    useEffect(() => { 
        if (page > 1 && !loading) {
            setLoading(true);
            fetchMoreAnime(items.length, pageSize).then(newItems => {
                setItems(prev => [...prev, ...newItems]);
                setLoading(false);
            });
        }
    }, [page, items.length, loading, pageSize]);
    
    // Load initial recommendations and anime
    useEffect(() => {
        let mounted = true;
        (async () => {
            try {
                // Load recommendations
                const recResponse = await fetch('/api/recommendations');
                if (recResponse.ok) {
                    const recommendations: Anime[] = await recResponse.json();
                    if (mounted) setRecs(recommendations);
                } else {
                    // Fallback to mock data if API fails
                    const mockRecs: Anime[] = [
                        { id: 1, title: "Attack on Titan", img: "", slug: "attack-on-titan" },
                        { id: 2, title: "One Piece", img: "", slug: "one-piece" },
                        { id: 3, title: "Naruto", img: "", slug: "naruto" },
                        { id: 4, title: "Dragon Ball", img: "", slug: "dragon-ball" },
                        { id: 5, title: "Demon Slayer", img: "", slug: "demon-slayer" },
                        { id: 6, title: "My Hero Academia", img: "", slug: "my-hero-academia" }
                    ];
                    if (mounted) setRecs(mockRecs);
                }

                // Load initial anime list (bigger batch for long scroll)
                const initialAnime = await fetchMoreAnime(0, pageSize);
                if (mounted) setItems(initialAnime);
            } catch (error) {
                console.error('Failed to fetch data:', error);
                // Fallback to mock data on error
                const mockRecs: Anime[] = [
                    { id: 1, title: "Attack on Titan", img: "", slug: "attack-on-titan" },
                    { id: 2, title: "One Piece", img: "", slug: "one-piece" },
                    { id: 3, title: "Naruto", img: "", slug: "naruto" },
                    { id: 4, title: "Dragon Ball", img: "", slug: "dragon-ball" },
                    { id: 5, title: "Demon Slayer", img: "", slug: "demon-slayer" },
                    { id: 6, title: "My Hero Academia", img: "", slug: "my-hero-academia" }
                ];
                if (mounted) {
                    setRecs(mockRecs);
                    setItems(mockRecs);
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
                                        <Link to={`/anime/${ra.slug || ra.id}`} className="recs-card recs-a">
                                            {ra.img && <img className="recs-card__img" src={ra.img} alt={ra.title} />}
                                            <div className="recs-card__title">{ra.title}</div>
										</Link>
									)}
									{rd && (
                                        <Link to={`/anime/${rd.slug || rd.id}`} className="recs-card recs-d">
                                            {rd.img && <img className="recs-card__img" src={rd.img} alt={rd.title} />}
											<div className="recs-card__title">{rd.title}</div>
										</Link>
									)}
									{rb && (
                                        <Link to={`/anime/${rb.slug || rb.id}`} className="recs-card recs-b">
                                            {rb.img && <img className="recs-card__img" src={rb.img} alt={rb.title} />}
											<div className="recs-card__title recs-card__title--big">{rb.title}</div>
										</Link>
									)}
									{rc && (
                                        <Link to={`/anime/${rc.slug || rc.id}`} className="recs-card recs-c">
                                            {rc.img && <img className="recs-card__img" src={rc.img} alt={rc.title} />}
											<div className="recs-card__title">{rc.title}</div>
										</Link>
									)}
									{re && (
                                        <Link to={`/anime/${re.slug || re.id}`} className="recs-card recs-e">
                                            {re.img && <img className="recs-card__img" src={re.img} alt={re.title} />}
											<div className="recs-card__title">{re.title}</div>
										</Link>
									)}
									{rf && (
                                        <Link to={`/anime/${rf.slug || rf.id}`} className="recs-card recs-f">
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
                    {items.filter(a => a.img && a.img.trim().length > 0).map(a => (
                        <Link key={a.id} to={`/anime/${a.slug || a.id}`} className="media-card">
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
