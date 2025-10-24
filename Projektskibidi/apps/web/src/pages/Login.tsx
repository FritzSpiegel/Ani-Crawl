import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Header from "../components/Header";
import "../styles/Auth.css";
import { useAuth } from "../context/AuthContext";
import PasswordResetModal from "../components/PasswordResetModal";

export default function Login() {
    const nav = useNavigate();
    const { login } = useAuth();
    const [form, setForm] = useState({ email: "", password: "" });
    const [err, setErr] = useState("");
    const [showPasswordReset, setShowPasswordReset] = useState(false);

    async function onSubmit(e: React.FormEvent) {
        e.preventDefault();
        setErr(""); // Clear previous errors
        try {
            const r = await login(form);
            if (r?.isAdmin) nav("/admin"); else nav("/");
        }
        catch (e: any) {
            console.error("Login error:", e);
            setErr(e?.message || e?.response?.message || "Login fehlgeschlagen.");
        }
    }

    return (
        <div>
            <Header />
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
                        <div style={{ textAlign: 'center', marginTop: '15px' }}>
                            <button 
                                type="button"
                                onClick={() => setShowPasswordReset(true)}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    color: '#007bff',
                                    cursor: 'pointer',
                                    textDecoration: 'underline',
                                    fontSize: '14px'
                                }}
                            >
                                Passwort vergessen?
                            </button>
                        </div>
                    </form>
                </div>
            </main>
            
            <PasswordResetModal
                isOpen={showPasswordReset}
                onClose={() => setShowPasswordReset(false)}
            />
        </div>
    );
}
