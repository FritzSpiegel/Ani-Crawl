import Header from "../components/Header.jsx";
import { useEffect, useState } from "react";
import { adminUsers, adminDeleteUser } from "../services/auth.js";
import { useAuth } from "../context/AuthContext.jsx";

export default function Admin() {
<<<<<<< HEAD
    const { isAdmin, login } = useAuth();
    const [form, setForm] = useState({ email: "", password: "" });
    const [users, setUsers] = useState([]);
    const [err, setErr] = useState("");

    async function onSubmit(e) {
        e.preventDefault();
        setErr("");
        try {
            const r = await login(form);
            if (!r?.isAdmin) { setErr("Kein Admin-Konto."); }
        } catch (e) {
            setErr(e?.response?.message || "Login fehlgeschlagen.");
        }
    }

=======
    const { isAdmin } = useAuth();
    const [users, setUsers] = useState([]);
    const [err, setErr] = useState("");

>>>>>>> branch,-zum-zeigen-heute
    useEffect(() => {
        if (!isAdmin) return;
        let mounted = true;
        (async () => {
            try { const list = await adminUsers(); if (mounted) setUsers(list); } catch {}
        })();
        return () => { mounted = false; };
    }, [isAdmin]);

    async function onDelete(id) {
        if (!confirm('Diesen Nutzer wirklich löschen?')) return;
        try {
            await adminDeleteUser(id);
            setUsers(u => u.filter(x => x.id !== id));
        } catch (e) {
            alert(e?.response?.message || 'Löschen fehlgeschlagen.');
        }
    }

    return (
        <div>
            <Header />
            <main className="container" style={{ padding: "24px 0 96px" }}>
                <h1 className="page-title">Admin</h1>
                {!isAdmin ? (
                    <div className="card card--centered">
<<<<<<< HEAD
                        <form onSubmit={onSubmit} className="details__meta">
                            <div className="auth-header">
                                <h2 className="auth-title">Admin Login</h2>
                                <div className="auth-subtitle">Nur für Administratoren</div>
                            </div>
                            <label>E-Mail<input className="header-search__input input--lg" style={{ border: '1px solid #333', padding: 10, borderRadius: 10 }} onChange={e => setForm({ ...form, email: e.target.value })} /></label>
                            <label>Passwort<input type="password" className="header-search__input input--lg" style={{ border: '1px solid #333', padding: 10, borderRadius: 10 }} onChange={e => setForm({ ...form, password: e.target.value })} /></label>
                            {err && <div className="alert alert--error">{err}</div>}
                            <div className="cta-row"><button className="btn btn--primary" type="submit">Anmelden</button></div>
                            <div className="admin-login__hint">Standard: <b>Admin@Mail</b> / <b>password</b> (änderbar über .env)</div>
                        </form>
=======
                        <div className="details__meta">
                            <div className="auth-header">
                                <h2 className="auth-title">Admin-Bereich</h2>
                                <div className="auth-subtitle">Bitte zuerst normal einloggen. Admin wird automatisch erkannt.</div>
                            </div>
                            {err && <div className="alert alert--error">{err}</div>}
                        </div>
>>>>>>> branch,-zum-zeigen-heute
                    </div>
                ) : (
                    <div>
                        <div className="skeleton-row" style={{ marginBottom: 8 }}>Insgesamt {users.length} Nutzer</div>
                        <div style={{ overflowX: 'auto' }}>
                            <table className="table">
                                <thead>
                                    <tr>
                                        <th>ID</th>
                                        <th>Vorname</th>
                                        <th>Nachname</th>
                                        <th>E-Mail</th>
                                        <th>Verifiziert</th>
                                        <th>Erstellt</th>
                                        <th>Aktionen</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {users.map(u => (
                                        <tr key={u.id}>
                                            <td>{u.id}</td>
                                            <td>{u.first_name}</td>
                                            <td>{u.last_name}</td>
                                            <td>{u.email}</td>
                                            <td>{u.verified ? <span className="badge badge--success">Ja</span> : <span className="badge badge--warn">Nein</span>}</td>
                                            <td>{new Date(u.created_at).toLocaleString()}</td>
                                            <td><button className="btn" onClick={() => onDelete(u.id)}>Löschen</button></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}


