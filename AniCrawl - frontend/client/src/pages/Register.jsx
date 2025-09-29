import { useState } from 'react';
import Header from '../components/Header.jsx';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import '../styles/Auth.css';

const ERRMAP = {
    EMAIL_EXISTS: 'Diese E-Mail ist bereits registriert.',
    NETWORK: 'Server nicht erreichbar. Läuft der Auth-Server auf http://localhost:4000?'
};

export default function Register() {
    const nav = useNavigate();
    const { register } = useAuth();
    const [form, setForm] = useState({ firstName: '', lastName: '', email: '', password: '' });
    const [err, setErr] = useState(''); const [loading, setLoading] = useState(false);
    function onChange(e) { setForm(p => ({ ...p, [e.target.name]: e.target.value })); }
    function validate() {
        if (!form.firstName.trim()) return 'Vorname fehlt.';
        if (!form.lastName.trim()) return 'Nachname fehlt.';
        if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) return 'E-Mail ist ungültig.';
        if (form.password.length < 6) return 'Passwort muss mind. 6 Zeichen haben.';
        return '';
    }
    async function onSubmit(e) {
        e.preventDefault();
        const v = validate(); if (v) return setErr(v);
        setErr(''); setLoading(true);
        try {
            const res = await register(form); // devCode landet in sessionStorage
            nav(`/verify?email=${encodeURIComponent(res.email)}`);
        } catch (e) { setErr(ERRMAP[e.code] || e.message || 'Registrierung fehlgeschlagen.'); }
        finally { setLoading(false); }
    }
    return (
        <div>
            <Header />
            <main className="container auth-page">
                <div className="auth-card">
                    <h1 className="auth-title">Registrieren</h1>
                    <form className="auth-form" onSubmit={onSubmit}>
                        <div className="form-row form-row--grid">
                            <div><label className="label" htmlFor="firstName">Vorname</label>
                                <input id="firstName" name="firstName" className="input" value={form.firstName} onChange={onChange} /></div>
                            <div><label className="label" htmlFor="lastName">Nachname</label>
                                <input id="lastName" name="lastName" className="input" value={form.lastName} onChange={onChange} /></div>
                        </div>
                        <div className="form-row"><label className="label" htmlFor="email">E-Mail</label>
                            <input id="email" name="email" type="email" className="input" value={form.email} onChange={onChange} /></div>
                        <div className="form-row"><label className="label" htmlFor="password">Passwort</label>
                            <input id="password" name="password" type="password" className="input" value={form.password} onChange={onChange} /></div>
                        {err && <div className="error">{err}</div>}
                        <div className="actions"><button className="button button--primary" type="submit" disabled={loading}>{loading ? 'Bitte warten…' : 'Konto erstellen'}</button></div>
                        <div className="hint">Du erhältst einen 6-stelligen Code per E-Mail.</div>
                    </form>
                </div>
            </main>
        </div>
    );
}
