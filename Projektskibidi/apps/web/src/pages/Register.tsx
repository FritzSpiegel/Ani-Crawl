import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Header from "../components/Header";
import { useAuth } from "../context/AuthContext";

export default function Register() {
    const nav = useNavigate();
    const { register } = useAuth();
    const [form, setForm] = useState({ firstName: "", lastName: "", email: "", password: "" });
    const [err, setErr] = useState("");

    async function onSubmit(e) {
        e.preventDefault();
        try { const r = await register(form); nav(`/verify?email=${encodeURIComponent(r.email)}`); }
        catch { setErr("Registrierung fehlgeschlagen."); }
    }

    return (
        <div>
            <Header />
            <main className="container" style={{ padding: "32px 0" }}>
                <h1 className="page-title">Registrieren</h1>
                <form onSubmit={onSubmit} className="details__meta" style={{ maxWidth: 520 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <label>Vorname<input className="header-search__input" style={{ border: '1px solid #333', padding: 10, borderRadius: 10 }} onChange={e => setForm({ ...form, firstName: e.target.value })} /></label>
                        <label>Nachname<input className="header-search__input" style={{ border: '1px solid #333', padding: 10, borderRadius: 10 }} onChange={e => setForm({ ...form, lastName: e.target.value })} /></label>
                    </div>
                    <label>E-Mail<input className="header-search__input" style={{ border: '1px solid #333', padding: 10, borderRadius: 10 }} onChange={e => setForm({ ...form, email: e.target.value })} /></label>
                    <label>Passwort<input type="password" className="header-search__input" style={{ border: '1px solid #333', padding: 10, borderRadius: 10 }} onChange={e => setForm({ ...form, password: e.target.value })} /></label>
                    {err && <div style={{ color: '#ff6b6b', fontWeight: 700 }}>{err}</div>}
                    <div className="cta-row"><button className="btn btn--primary" type="submit">Registrieren</button></div>
                </form>
            </main>
        </div>
    );
}
