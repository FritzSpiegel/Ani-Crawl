import { useMemo, useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Header from '../components/Header.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import '../styles/Auth.css';

function useQuery() { const { search } = useLocation(); return useMemo(() => new URLSearchParams(search), [search]); }
const ERRMAP = { INVALID_CODE: 'Code ist ungültig.', CODE_EXPIRED: 'Code abgelaufen. Bitte neu senden.', NO_CODE: 'Kein Code angefordert.', NETWORK: 'Server nicht erreichbar.' };

export default function VerifyEmail() {
    const q = useQuery(); const nav = useNavigate();
    const { resend, verify } = useAuth();
    const [email] = useState(q.get('email') || '');
    const [code, setCode] = useState('');
    const [msg, setMsg] = useState('Wir haben dir einen 6-stelligen Code per E-Mail gesendet.');
    const [err, setErr] = useState(''); const [cooldown, setCooldown] = useState(0); const [loading, setLoading] = useState(false);
    const [devCode, setDevCode] = useState('');

    useEffect(() => {
        const c = sessionStorage.getItem('anicrawl_dev_code');
        if (c) { setDevCode(c); setMsg(prev => `${prev} (DEV: Code ist ${c})`); }
    }, []);

    async function onSubmit(e) {
        e.preventDefault(); setErr(''); setMsg('');
        if (!/^\d{6}$/.test(code)) return setErr('Bitte 6-stelligen Code eingeben.');
        setLoading(true);
        try {
            const ok = await verify(email, code);
            if (ok) { setMsg('E-Mail bestätigt! Weiter zum Login …'); sessionStorage.removeItem('anicrawl_dev_code'); setTimeout(() => nav('/login'), 700); }
            else setErr('Verifizierung fehlgeschlagen.');
        } catch (e) { setErr(ERRMAP[e.code] || e.message || 'Verifizierung fehlgeschlagen.'); }
        finally { setLoading(false); }
    }
    async function resendEmail() {
        setErr(''); setMsg('');
        try {
            await resend(email);
            setMsg(`E-Mail erneut gesendet an ${email}.`);
            setDevCode(''); sessionStorage.removeItem('anicrawl_dev_code');
            setCooldown(30);
            const t = setInterval(() => setCooldown(c => c > 0 ? c - 1 : (clearInterval(t), 0)), 1000);
        } catch (e) { setErr(ERRMAP[e.code] || e.message || 'Fehler beim erneuten Senden.'); }
    }

    return (
        <div>
            <Header />
            <main className="container auth-page">
                <div className="auth-card">
                    <h1 className="auth-title">E-Mail bestätigen</h1>
                    <p className="hint" style={{ marginBottom: 10 }}>
                        Wir haben eine E-Mail an <b>{email}</b> geschickt. Bitte gib den Code hier ein.
                    </p>

                    {devCode && <div className="success">DEV-Hinweis: Code lautet <b>{devCode}</b>.</div>}

                    <form className="auth-form" onSubmit={onSubmit}>
                        <div className="form-row">
                            <label className="label" htmlFor="code">Bestätigungscode</label>
                            <input id="code" className="input" inputMode="numeric" maxLength={6} placeholder="123456"
                                value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} />
                        </div>

                        {err && <div className="error">{err}</div>}
                        {msg && <div className="success">{msg}</div>}

                        <div className="actions">
                            <button className="button button--primary" type="submit" disabled={loading}>
                                {loading ? 'Bitte warten…' : 'Code bestätigen'}
                            </button>
                            <button className="button" type="button" onClick={resendEmail} disabled={cooldown > 0}>
                                {cooldown > 0 ? `Erneut senden (${cooldown}s)` : 'E-Mail erneut senden'}
                            </button>
                        </div>
                    </form>
                </div>
            </main>
        </div>
    );
}
