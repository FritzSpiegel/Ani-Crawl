import Header from '../components/Header.jsx';
import { useParams } from 'react-router-dom';

export default function Details() {
    const { id } = useParams();
    return (
        <div>
            <Header />
            <main className="container" style={{ padding: '32px 0 96px' }}>
                <h1 className="auth-title">Details: Anime #{id}</h1>
                <p className="hint">Hier würdest du echte API-Daten anzeigen (Titel, Synopsis, Genres, …).</p>
            </main>
        </div>
    );
}
