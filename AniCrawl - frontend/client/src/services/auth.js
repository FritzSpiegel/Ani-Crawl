const API_BASE = (import.meta.env.VITE_API_BASE) || `http://${window.location.hostname}:4000`;

async function j(path, opts = {}) {
    const res = await fetch(API_BASE + path, {
        method: opts.method || 'GET',
        headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
        credentials: 'include',
        body: opts.body ? JSON.stringify(opts.body) : undefined
    }).catch(() => { const e = new Error('Netzwerkfehler: Server nicht erreichbar.'); e.code = 'NETWORK'; throw e; });
    let data = {}; try { data = await res.json(); } catch { }
    if (!res.ok) { const e = new Error(data.message || 'Request fehlgeschlagen.'); e.code = data.code; throw e; }
    return data;
}

const LS = 'anicrawl_session';
function writeSession(u) { if (!u) return localStorage.removeItem(LS); localStorage.setItem(LS, JSON.stringify(u)); }
export function getCurrentUser() { try { return JSON.parse(localStorage.getItem(LS)) || null } catch { return null } }
export function signOut() { return j('/auth/logout', { method: 'POST' }).finally(() => writeSession(null)); }

export async function registerUser({ firstName, lastName, email, password }) {
    const r = await j('/auth/register', { method: 'POST', body: { firstName, lastName, email, password } });
    // devCode zur Verify-Seite „mitnehmen“, falls vorhanden
    if (r.devCode) sessionStorage.setItem('anicrawl_dev_code', r.devCode);
    return { email: r.email };
}

export async function signIn({ email, password }) {
    try {
        const r = await j('/auth/login', { method: 'POST', body: { email, password } });
        writeSession(r.user); return r.user;
    } catch (e) {
        if (e.code === 'NOT_VERIFIED') writeSession({ email, firstName: '', lastName: '' });
        throw e;
    }
}

export async function resendVerifyCode(email) {
    sessionStorage.removeItem('anicrawl_dev_code'); // nicht alten Code anzeigen
    await j('/auth/resend', { method: 'POST', body: { email } });
    return { email };
}
export async function verifyEmailWithCode(email, code) { const r = await j('/auth/verify-code', { method: 'POST', body: { email, code } }); return r.ok === true; }
export async function checkVerifyStatus(email) { const r = await j(`/auth/status?email=${encodeURIComponent(email)}`); return !!r.verified; }
