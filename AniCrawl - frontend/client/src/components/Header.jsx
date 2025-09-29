import { Link } from 'react-router-dom';

export default function Header() {
    return (
        <header className="page-header">
            <div className="container app-header">
                <Link to="/" className="app-logo">ANI<br />CRAWL</Link>
                <div className="spacer" />
                <nav>
                    <Link to="/register" className="button" style={{ marginRight: 8 }}>Registrieren</Link>
                    <Link to="/login" className="button button--primary">Login</Link>
                </nav>
            </div>
        </header>
    );
}
