import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Header from "../components/Header.jsx";
<<<<<<< HEAD
=======
import "../styles/Auth.css";
>>>>>>> branch,-zum-zeigen-heute
import { useAuth } from "../context/AuthContext.jsx";

export default function Login() {
    const nav = useNavigate();
    const { login } = useAuth();
    const [form, setForm] = useState({ email: "", password: "" });
    const [err, setErr] = useState("");

    async function onSubmit(e) {
        e.preventDefault();
        try {
            const r = await login(form);
            if (r?.isAdmin) nav("/admin"); else nav("/");
        }
<<<<<<< HEAD
        catch { setErr("Login fehlgeschlagen."); }
=======
        catch (e) { setErr(e?.response?.message || "Login fehlgeschlagen."); }
>>>>>>> branch,-zum-zeigen-heute
    }

    return (
        <div>
            <Header />
<<<<<<< HEAD
            <main className="container" style={{ padding: "32px 0" }}>
                <h1 className="page-title">Login</h1>
                <form onSubmit={onSubmit} className="details__meta" style={{ maxWidth: 420 }}>
                    <label>E-Mail<input className="header-search__input" style={{ border: '1px solid #333', padding: 10, borderRadius: 10 }} name="email" onChange={e => setForm({ ...form, email: e.target.value })} /></label>
                    <label>Passwort<input type="password" className="header-search__input" style={{ border: '1px solid #333', padding: 10, borderRadius: 10 }} name="password" onChange={e => setForm({ ...form, password: e.target.value })} /></label>
                    {err && <div style={{ color: '#ff6b6b', fontWeight: 700 }}>{err}</div>}
                    <div className="cta-row"><button className="btn btn--primary" type="submit">Login</button><Link to="/register" className="btn">Registrieren</Link></div>
                </form>
=======
            <main className="container auth-page">
                <div className="auth-card">
                    <h1 className="auth-title">Login</h1>
                    <form className="auth-form" onSubmit={onSubmit}>
                        <div className="form-row">
                            <label className="label" htmlFor="email">E-Mail</label>
                            <input id="email" name="email" className="input" onChange={e => setForm({ ...form, email: e.target.value })} />
                        </div>
                        <div className="form-row">
                            <label className="label" htmlFor="password">Passwort</label>
                            <input id="password" name="password" type="password" className="input" onChange={e => setForm({ ...form, password: e.target.value })} />
                        </div>
                        {err && <div className="error">{err}</div>}
                        <div className="actions">
                            <button className="button button--primary" type="submit">Anmelden</button>
                            <Link to="/register" className="button">Registrieren</Link>
                        </div>
                    </form>
                </div>
>>>>>>> branch,-zum-zeigen-heute
            </main>
        </div>
    );
}
