import { Link, NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import SearchBar from "./SearchBar";

export default function Header() {
    const { user, isAdmin, logout } = useAuth();
    
    return (
        <header className="site-header">
            <div className="container header-bar">
                <Link to="/" className="brand">
                    <span className="brand__box">ANI</span>
                    <span className="brand__text">CRAWL</span>
                </Link>

                <SearchBar />

                <nav className="header-nav">
                    <NavLink to="/" className={({ isActive }) => `nav-link ${isActive ? "is-active" : ""}`}> Empfehlungen</NavLink>
                    <NavLink to="/watchlist" className={({ isActive }) => `nav-link ${isActive ? "is-active" : ""}`}> WatchList</NavLink>
                    {!user ? (
                        <>
                            <NavLink to="/login" className={({ isActive }) => `nav-link ${isActive ? "is-active" : ""}`}>Login</NavLink>
                            <Link to="/register" className="btn btn--primary">Registrieren</Link>
                        </>
                    ) : (
                        <>
                            <div className="nav-link" style={{ background: '#1b2437', cursor: 'default' }}>Hallo {user.firstName}</div>
                            <button className="btn" onClick={logout}>Logout</button>
                        </>
                    )}
                </nav>
            </div>
        </header>
    );
}
