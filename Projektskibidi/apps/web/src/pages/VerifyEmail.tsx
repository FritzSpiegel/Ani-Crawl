import Header from "../components/Header.jsx";
import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function VerifyEmail() {
    const nav = useNavigate();
    const location = useLocation();
    const email = useMemo(() => new URLSearchParams(location.search).get("email") || "", [location.search]);
    const [code, setCode] = useState("");
    const [err, setErr] = useState("");
    const [ok, setOk] = useState("");
    const { verify, resend } = useAuth();

    async function onSubmit(e: React.FormEvent) {
        e.preventDefault();
        setErr(""); setOk("");
        try {
            await verify({ email, code });
            setOk("E-Mail bestätigt. Bitte einloggen.");
            setTimeout(() => nav("/login"), 800);
        } catch (err: any) {
            setErr(err?.response?.message || "Bestätigung fehlgeschlagen.");
        }
    }

    async function onResend() {
        setErr(""); setOk("");
        try { await resend(email); setOk("Neuer Code gesendet."); } catch { setErr("Senden fehlgeschlagen."); }
    }

    return (
        <div>
            <Header />
            <main className="container auth-page">
                <div className="auth-card">
                    <h1 className="auth-title">E-Mail bestätigen</h1>
                    <p className="hint">Wir haben eine E-Mail an <b>{email}</b> gesendet. Gib den 6-stelligen Code ein.</p>
                    <form onSubmit={onSubmit} className="auth-form" style={{ maxWidth: 360, margin: '0 auto' }}>
                        <div className="form-row">
                            <label className="label">Bestätigungscode</label>
                            <input value={code} onChange={e => setCode(e.target.value)} placeholder="123456" className="input" />
                        </div>
                        {err && <div className="error">{err}</div>}
                        {ok && <div className="hint" style={{ color: '#9ff0b8' }}>{ok}</div>}
                        <div className="actions">
                            <button className="button button--primary" type="submit">Bestätigen</button>
                            <button type="button" className="button" onClick={onResend}>Code erneut senden</button>
                        </div>
                    </form>
                </div>
            </main>
        </div>
    );
}
