import Header from '../components/Header.jsx';
import { Link } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';

// Dummy-Daten (ersetzbar durch echte API)
function makeItems(offset, count) {
    return Array.from({ length: count }, (_, i) => ({
        id: offset + i + 1,
        title: `Anime #${offset + i + 1}`,
        img: `https://picsum.photos/seed/anime${offset + i + 1}/400/600`
    }));
}
function makeRecommendations() {
    return Array.from({ length: 12 }, (_, i) => ({
        id: 1000 + i + 1,
        title: `Schwärzlers Pick #${i + 1}`,
        img: `https://picsum.photos/seed/rec${i + 1}/800/600`
    }));
}

export default function Home() {
    const [items, setItems] = useState(makeItems(0, 20));
    const [page, setPage] = useState(1);
    const recs = useMemo(() => makeRecommendations(), []);

    useEffect(() => {
        const onScroll = () => {
            if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 300) {
                setPage(p => p + 1);
            }
        };
        window.addEventListener('scroll', onScroll);
        return () => window.removeEventListener('scroll', onScroll);
    }, []);
    useEffect(() => { if (page > 1) setItems(prev => [...prev, ...makeItems(prev.length, 20)]); }, [page]);

    return (
        <div>
            <Header />

            {/* Schwärzlers Empfehlungen */}
            <section className="section">
                <div className="container">
                    <h2 className="section__title">Schwärzlers Empfehlungen</h2>
                </div>
                <div className="rail">
                    <div className="rail__inner container">
                        {recs.map(r => (
                            <Link key={r.id} to={`/anime/${r.id}`} className="rail__card">
                                <img src={r.img} alt={r.title} className="rail__img" />
                                <div className="rail__overlay">
                                    <div className="rail__title">{r.title}</div>
                                </div>
                            </Link>
                        ))}
                    </div>
                </div>
            </section>

            {/* Hauptgrid mit Infinity Scroll */}
            <main className="container" style={{ padding: '24px 0 96px' }}>
                <h3 style={{ margin: '0 0 16px' }}>Beliebte Anime</h3>
                <div className="grid">
                    {items.map(a => (
                        <Link key={a.id} to={`/anime/${a.id}`} className="card">
                            <img className="card__img" src={a.img} alt={a.title} />
                            <div className="card__title">{a.title}</div>
                        </Link>
                    ))}
                </div>
            </main>
        </div>
    );
}
