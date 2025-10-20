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
            <main className="container auth-page">
                <div className="auth-card">
                    <h1 className="auth-title">Registrieren</h1>
                    <form onSubmit={onSubmit} className="auth-form">
                        <div className="form-row form-row--grid">
                            <div className="form-row">
                                <label className="label">Vorname</label>
                                <input className="input" onChange={e => setForm({ ...form, firstName: e.target.value })} />
                            </div>
                            <div className="form-row">
                                <label className="label">Nachname</label>
                                <input className="input" onChange={e => setForm({ ...form, lastName: e.target.value })} />
                            </div>
                        </div>
                        <div className="form-row">
                            <label className="label">E-Mail</label>
                            <input className="input" onChange={e => setForm({ ...form, email: e.target.value })} />
                        </div>
                        <div className="form-row">
                            <label className="label">Passwort</label>
                            <input type="password" className="input" onChange={e => setForm({ ...form, password: e.target.value })} />
                        </div>
                        {err && <div className="error">{err}</div>}
                        <div className="actions"><button className="button button--primary" type="submit">Registrieren</button></div>
                    </form>
                </div>
            </main>
        </div>
    );
}
