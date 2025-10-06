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
					<h2 className="headline-recs">Schwärzlers Empfehlungen</h2>
					<div className="recs-grid">
						{(() => {
							const slots = recs.slice(0, 6);
							const [ra, rb, rc, rd, re, rf] = slots;
							return (
								<>
									{ra && (
										<Link to={`/anime/${ra.id}`} className="recs-card recs-a">
											<img className="recs-card__img" src={ra.img} alt={ra.title} />
											<div className="recs-card__title">{ra.title}</div>
										</Link>
									)}
									{rd && (
										<Link to={`/anime/${rd.id}`} className="recs-card recs-d">
											<img className="recs-card__img" src={rd.img} alt={rd.title} />
											<div className="recs-card__title">{rd.title}</div>
										</Link>
									)}
									{rb && (
										<Link to={`/anime/${rb.id}`} className="recs-card recs-b">
											<img className="recs-card__img" src={rb.img} alt={rb.title} />
											<div className="recs-card__title recs-card__title--big">{rb.title}</div>
										</Link>
									)}
									{rc && (
										<Link to={`/anime/${rc.id}`} className="recs-card recs-c">
											<img className="recs-card__img" src={rc.img} alt={rc.title} />
											<div className="recs-card__title">{rc.title}</div>
										</Link>
									)}
									{re && (
										<Link to={`/anime/${re.id}`} className="recs-card recs-e">
											<img className="recs-card__img" src={re.img} alt={re.title} />
											<div className="recs-card__title">{re.title}</div>
										</Link>
									)}
									{rf && (
										<Link to={`/anime/${rf.id}`} className="recs-card recs-f">
											<img className="recs-card__img" src={rf.img} alt={rf.title} />
											<div className="recs-card__title">{rf.title}</div>
										</Link>
									)}
								</>
							);
						})()}
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
