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
            <main className="container" style={{ padding: "32px 0" }}>
                <h1 className="page-title">E-Mail bestätigen</h1>
                <p>Wir haben eine E-Mail an <b>{email}</b> gesendet. Gib den 6-stelligen Code ein.</p>
                <form onSubmit={onSubmit} className="details__meta" style={{ maxWidth: 320 }}>
                    <input value={code} onChange={e => setCode(e.target.value)} placeholder="123456" className="header-search__input" style={{ border: '1px solid #333', padding: 12, borderRadius: 12 }} />
                    {err && <div style={{ color: '#ff6b6b', fontWeight: 700 }}>{err}</div>}
                    {ok && <div style={{ color: '#4caf50', fontWeight: 700 }}>{ok}</div>}
                    <div className="cta-row"><button className="btn btn--primary" type="submit">Bestätigen</button><button type="button" className="btn" onClick={onResend}>Code erneut senden</button></div>
                </form>
            </main>
        </div>
    );
}
