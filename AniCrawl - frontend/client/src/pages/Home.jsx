import Header from "../components/Header.jsx";
import { Link } from "react-router-dom";
import { useEffect, useState } from "react";

const recs = [
    { id: 1, title: "sekirei", img: "https://picsum.photos/seed/sekirei/640/400" },
    { id: 2, title: "Mob Psycho", img: "https://picsum.photos/seed/mob/640/400" },
    { id: 3, title: "One Piece", img: "https://picsum.photos/seed/onepiece/900/1200" },
    { id: 4, title: "Death Note", img: "https://picsum.photos/seed/death/640/400" },
    { id: 5, title: "Steins Gate", img: "https://picsum.photos/seed/steins/640/400" },
    { id: 6, title: "To LOVE RU", img: "https://picsum.photos/seed/love/640/900" }
];

function more(offset, count) { return Array.from({ length: count }, (_, i) => ({ id: 100 + offset + i, title: `Anime #${offset + i + 1}`, img: `https://picsum.photos/seed/an${offset + i + 1}/400/600` })); }

export default function Home() {
    const [items, setItems] = useState(more(0, 20));
    const [page, setPage] = useState(1);

    useEffect(() => {
        const onScroll = () => { if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 300) setPage(p => p + 1); };
        window.addEventListener("scroll", onScroll); return () => window.removeEventListener("scroll", onScroll);
    }, []);
    useEffect(() => { if (page > 1) setItems(prev => [...prev, ...more(prev.length, 20)]); }, [page]);

    return (
        <div>
            <Header />
<<<<<<< HEAD
            <section className="section">
                <div className="container"><h2 className="headline-recs">Schwärzlers Empfehlungen</h2></div>
                <div className="container recs-grid">
                    <Link to={`/anime/${recs[0].id}`} className="recs-card recs-a"><img className="recs-card__img" src={recs[0].img} alt="" /><div className="recs-card__title">{recs[0].title}</div></Link>
                    <Link to={`/anime/${recs[2].id}`} className="recs-card recs-b"><img className="recs-card__img" src={recs[2].img} alt="" /><div className="recs-card__title recs-card__title--big">{recs[2].title}</div></Link>
                    <Link to={`/anime/${recs[3].id}`} className="recs-card recs-c"><img className="recs-card__img" src={recs[3].img} alt="" /><div className="recs-card__title">{recs[3].title}</div></Link>
                    <Link to={`/anime/${recs[1].id}`} className="recs-card recs-d"><img className="recs-card__img" src={recs[1].img} alt="" /><div className="recs-card__title">{recs[1].title}</div></Link>
                    <Link to={`/anime/${recs[4].id}`} className="recs-card recs-e"><img className="recs-card__img" src={recs[4].img} alt="" /><div className="recs-card__title">{recs[4].title}</div></Link>
                    <Link to={`/anime/${recs[5].id}`} className="recs-card recs-f"><img className="recs-card__img" src={recs[5].img} alt="" /><div className="recs-card__title">{recs[5].title}</div></Link>
                </div>
            </section>
=======

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
>>>>>>> branch,-zum-zeigen-heute

            <main className="container" style={{ padding: "24px 0 96px" }}>
                <h3 className="section-title">Alle Titel</h3>
                <div className="grid">
                    {items.map(a => (
                        <Link key={a.id} to={`/anime/${a.id}`} className="media-card">
                            <img className="media-card__img" src={a.img} alt="" />
                            <div className="media-card__title">{a.title}</div>
                        </Link>
                    ))}
                </div>
            </main>
        </div>
    );
}
