import { Link, NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
<<<<<<< HEAD
import { useNavigate } from "react-router-dom";

export default function Header() {
    const nav = useNavigate();
=======

export default function Header() {
>>>>>>> branch,-zum-zeigen-heute
    const { user, isAdmin, logout } = useAuth();
    return (
        <header className="site-header">
            <div className="container header-bar">
                <Link to="/" className="brand">
                    <span className="brand__box">ANI</span>
                    <span className="brand__text">CRAWL</span>
                </Link>

                <div className="header-search">
                    <span className="header-search__icon">🔎</span>
                    <input className="header-search__input" placeholder="Suche" />
                </div>

                <nav className="header-nav">
                    <NavLink to="/" className={({ isActive }) => `nav-link ${isActive ? "is-active" : ""}`}>★ Empfehlungen</NavLink>
                    <NavLink to="/watchlist" className={({ isActive }) => `nav-link ${isActive ? "is-active" : ""}`}>🗂️ WatchList</NavLink>
<<<<<<< HEAD
                    {!user && <NavLink to="/login" className={({ isActive }) => `nav-link ${isActive ? "is-active" : ""}`}>Login</NavLink>}
                    {!user && <Link to="/register" className="btn btn--primary">Registrieren</Link>}
                    {user && (
                        <>
                            {isAdmin && <NavLink to="/admin" className={({ isActive }) => `nav-link ${isActive ? "is-active" : ""}`}>Admin</NavLink>}
                            <span className="nav-link" style={{ opacity: .9 }}>👤 {user.firstName || user.email}</span>
                            <button className="btn" onClick={async () => { await logout(); nav('/'); }}>Logout</button>
=======
                    {!user ? (
                        <>
                            <NavLink to="/login" className={({ isActive }) => `nav-link ${isActive ? "is-active" : ""}`}>Login</NavLink>
                            <Link to="/register" className="btn btn--primary">Registrieren</Link>
                        </>
                    ) : (
                        <>
                            <div className="nav-link" style={{ background: '#1b2437', cursor: 'default' }}>Hallo {user.firstName}</div>
                            <button className="btn" onClick={logout}>Logout</button>
>>>>>>> branch,-zum-zeigen-heute
                        </>
                    )}
                </nav>
            </div>
        </header>
    );
}
