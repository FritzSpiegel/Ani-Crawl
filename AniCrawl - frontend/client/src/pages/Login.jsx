import { useState } from 'react';
import Header from '../components/Header.jsx';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import '../styles/Auth.css';

const ERRMAP = {
    NO_USER: 'Kein Konto mit dieser E-Mail.',
    BAD_PASS: 'Falsches Passwort.',
    NOT_VERIFIED: 'E-Mail noch nicht bestätigt. Bitte Code eingeben.',
    NETWORK: 'Server nicht erreichbar.'
};

export default function Login() {
    const { login } = useAuth();
    const nav = useNavigate();
    const [form, setForm] = useState({ email: '', password: '' });
    const [err, setErr] = useState(''); const [loading, setLoading] = useState(false);
    function onChange(e) { setForm(p => ({ ...p, [e.target.name]: e.target.value })); }
    async function onSubmit(e) {
        e.preventDefault(); setErr(''); setLoading(true);
        try { await login(form); nav('/'); }
        catch (e) {
            const code = e?.code || '';
            if (code === 'NOT_VERIFIED') { nav(`/verify?email=${encodeURIComponent(form.email)}`); return; }
            setErr(ERRMAP[code] || e.message || 'Anmeldung fehlgeschlagen.');
        } finally { setLoading(false); }
    }
    return (
        <div>
            <Header />
            <main className="container auth-page">
                <div className="auth-card">
                    <h1 className="auth-title">Anmelden</h1>
                    <form className="auth-form" onSubmit={onSubmit}>
                        <div className="form-row">
                            <label className="label" htmlFor="email">E-Mail</label>
                            <input id="email" name="email" type="email" className="input" value={form.email} onChange={onChange} required />
                        </div>
                        <div className="form-row">
                            <label className="label" htmlFor="password">Passwort</label>
                            <input id="password" name="password" type="password" className="input" value={form.password} onChange={onChange} required />
                        </div>
                        {err && <div className="error">{err}</div>}
                        <div className="actions"><button className="button button--primary" type="submit" disabled={loading}>{loading ? 'Bitte warten…' : 'Login'}</button></div>
                        <div className="hint">Noch kein Account? Registriere dich oben rechts.</div>
                    </form>
                </div>
            </main>
        </div>
    );
}
